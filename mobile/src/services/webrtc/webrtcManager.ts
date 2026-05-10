import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
  MediaStreamTrack,
} from 'react-native-webrtc';
import { DEFAULT_ICE_SERVERS } from '../../constants';
import { signalingClient } from '../websocket/signalingClient';
import type { ICEServer, RTCIceCandidateType, RTCSessionDescriptionType } from '../../types';

type CameraSwitchableTrack = MediaStreamTrack & { _switchCamera?: () => void };

interface IceCandidateEvent {
  candidate: RTCIceCandidateType | null;
}

interface TrackEvent {
  streams?: MediaStream[];
  track?: MediaStreamTrack;
}

interface PeerConnectionEventHandlers {
  onicecandidate: ((event: IceCandidateEvent) => void) | null;
  onicecandidateerror: ((event: unknown) => void) | null;
  ontrack: ((event: TrackEvent) => void) | null;
  onconnectionstatechange: (() => void) | null;
  oniceconnectionstatechange: (() => void) | null;
  onicegatheringstatechange: (() => void) | null;
  onsignalingstatechange: (() => void) | null;
}

interface WebRTCCallbacks {
  onRemoteStream?: (stream: MediaStream | null) => void;
  onLocalStream?: (stream: MediaStream | null) => void;
  onConnectionStateChange?: (state: string) => void;
}

class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingRemoteCandidates: RTCIceCandidate[] = [];
  /** Trickled ICE from caller before server assigns real call id (temp_* is not in activeCalls). */
  private pendingLocalIceCandidates: Array<{
    candidate: string;
    sdpMLineIndex: number | null;
    sdpMid: string | null;
  }> = [];
  private callId: string | null = null;
  private callbacks = new Map<number, WebRTCCallbacks>();
  private nextCallbackId = 1;
  private isSpeakerOn = true;
  private audioModeGeneration = 0;

  constructor() {
    signalingClient.on('connection:open', () => {
      this.flushPendingLocalIceCandidates();
    });
  }

  addCallbacks(callbacks: WebRTCCallbacks) {
    const id = this.nextCallbackId++;
    this.callbacks.set(id, callbacks);

    if (this.localStream) callbacks.onLocalStream?.(this.localStream);
    if (this.remoteStream) callbacks.onRemoteStream?.(this.remoteStream);
    if (this.peerConnection) {
      callbacks.onConnectionStateChange?.(this.peerConnection.connectionState || 'new');
    }

    return () => {
      this.callbacks.delete(id);
    };
  }

  setCallbacks(callbacks: WebRTCCallbacks) {
    this.callbacks.clear();
    this.addCallbacks(callbacks);
  }

  async initialize(iceServers?: ICEServer[]) {
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {
        /* ignore */
      }
    }
    this.peerConnection = null;
    this.pendingLocalIceCandidates = [];

    const configuredIceServers: ICEServer[] = iceServers && iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS;
    const config = {
      iceServers: configuredIceServers,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle' as const,
      rtcpMuxPolicy: 'require' as const,
    };

    console.log('[WebRTC] Creating peer connection:', {
      iceServers: config.iceServers.map((server) => ({
        urls: server.urls,
        hasCredential: 'credential' in server && Boolean(server.credential),
      })),
    });

    this.peerConnection = new RTCPeerConnection(config);

    const peerConnectionWithHandlers = this.peerConnection as RTCPeerConnection & PeerConnectionEventHandlers;

    peerConnectionWithHandlers.onicecandidate = (event: IceCandidateEvent) => {
      if (!event.candidate || !this.callId) return;

      const candidatePayload = {
        candidate: event.candidate.candidate,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
        sdpMid: event.candidate.sdpMid,
      };

      if (this.callId.startsWith('temp_')) {
        this.pendingLocalIceCandidates.push(candidatePayload);
        return;
      }

      this.sendIceCandidate(candidatePayload);
    };

    peerConnectionWithHandlers.onicecandidateerror = (event: unknown) => {
      console.warn('[WebRTC] ICE candidate error:', event);
    };

    peerConnectionWithHandlers.ontrack = (event: TrackEvent) => {
      const stream = event.streams?.[0] ?? this.buildRemoteStreamFromTrack(event.track);
      if (!stream) return;

      this.remoteStream = stream;
      console.log('[WebRTC] Remote stream received:', {
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length,
      });
      this.emitRemoteStream(stream);
    };

    peerConnectionWithHandlers.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState || 'unknown';
      console.log('[WebRTC] Connection state:', state);
      this.emitConnectionState(state);
    };

    peerConnectionWithHandlers.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', this.peerConnection?.iceConnectionState);
    };

    peerConnectionWithHandlers.onicegatheringstatechange = () => {
      console.log('[WebRTC] ICE gathering state:', this.peerConnection?.iceGatheringState);
    };

    peerConnectionWithHandlers.onsignalingstatechange = () => {
      console.log('[WebRTC] Signaling state:', this.peerConnection?.signalingState);
    };
  }

  async startLocalStream(isVideo: boolean): Promise<MediaStream> {
    if (!this.peerConnection) {
      throw new Error('Peer connection is not initialized');
    }

    const constraints: {
      audio:
        | boolean
        | {
            echoCancellation: boolean;
            noiseSuppression: boolean;
            autoGainControl: boolean;
          };
      video:
        | boolean
        | {
            facingMode: 'user' | 'environment';
            width: { ideal: number };
            height: { ideal: number };
            frameRate: { ideal: number; max: number };
          };
    } = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: isVideo
        ? {
            facingMode: 'user',
            width: { ideal: 960 },
            height: { ideal: 540 },
            frameRate: { ideal: 24, max: 30 },
          }
        : false,
    };

    // RN WebRTC's TypeScript type omits standard audio processing constraints
    // that the native WebRTC layer accepts for echo control.
    this.localStream = await mediaDevices.getUserMedia(
      constraints as unknown as Parameters<typeof mediaDevices.getUserMedia>[0]
    );
    console.log('[WebRTC] Local stream started:', {
      audioTracks: this.localStream.getAudioTracks().length,
      videoTracks: this.localStream.getVideoTracks().length,
    });
    this.emitLocalStream(this.localStream);

    this.localStream.getTracks().forEach((track: MediaStreamTrack) => {
      this.peerConnection?.addTrack(track, this.localStream!);
    });

    return this.localStream;
  }

  async createOffer(callId: string): Promise<RTCSessionDescription> {
    this.callId = callId;

    if (!this.peerConnection) {
      throw new Error('Peer connection is not initialized');
    }

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await this.peerConnection.setLocalDescription(offer);
    return offer as RTCSessionDescription;
  }

  async createRestartOffer(): Promise<RTCSessionDescription> {
    if (!this.peerConnection || !this.callId) {
      throw new Error('Cannot restart ICE without an active peer connection');
    }

    try {
      this.peerConnection.restartIce();
    } catch (error) {
      console.warn('[WebRTC] restartIce failed; using iceRestart offer only:', error);
    }

    const offer = await this.peerConnection.createOffer({
      iceRestart: true,
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await this.peerConnection.setLocalDescription(offer);
    console.log('[WebRTC] ICE restart offer created');
    return offer as RTCSessionDescription;
  }

  async handleOffer(callId: string, offer: RTCSessionDescriptionType): Promise<RTCSessionDescription> {
    return this.handleRemoteOffer(callId, offer);
  }

  async handleRemoteOffer(callId: string, offer: RTCSessionDescriptionType): Promise<RTCSessionDescription> {
    this.callId = callId;

    if (!this.peerConnection) {
      throw new Error('Peer connection is not initialized');
    }

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    await this.flushPendingRemoteCandidates();

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    return answer as RTCSessionDescription;
  }

  setCallId(callId: string) {
    const previousCallId = this.callId;
    this.callId = callId;

    if (previousCallId?.startsWith('temp_') && !callId.startsWith('temp_')) {
      this.flushPendingLocalIceCandidates();
    }
  }

  hasRemoteDescription(): boolean {
    return !!this.peerConnection?.remoteDescription;
  }

  async handleAnswer(answer: RTCSessionDescriptionType) {
    if (!this.peerConnection) {
      throw new Error('Peer connection is not initialized');
    }

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    await this.flushPendingRemoteCandidates();
  }

  async addIceCandidate(candidate: RTCIceCandidateType) {
    const iceCandidate = new RTCIceCandidate(candidate);

    if (this.peerConnection?.remoteDescription) {
      try {
        await this.peerConnection.addIceCandidate(iceCandidate);
      } catch (error) {
        console.warn('[WebRTC] Failed to add ICE candidate:', error);
      }
    } else {
      this.pendingRemoteCandidates.push(iceCandidate);
      console.log('[WebRTC] Queued remote ICE candidate:', this.pendingRemoteCandidates.length);
    }
  }

  toggleAudio(enabled: boolean) {
    this.localStream?.getAudioTracks().forEach((track: MediaStreamTrack) => {
      track.enabled = enabled;
    });
  }

  toggleVideo(enabled: boolean) {
    this.localStream?.getVideoTracks().forEach((track: MediaStreamTrack) => {
      track.enabled = enabled;
    });
  }

  async setSpeakerOn(enabled: boolean) {
    this.isSpeakerOn = enabled;
    await this.applyAudioOutput(enabled ? 'speaker' : 'earpiece');
  }

  async setAudioOutput(output: 'earpiece' | 'speaker' | 'bluetooth') {
    this.isSpeakerOn = output !== 'earpiece';
    await this.applyAudioOutput(output);
  }

  private async applyAudioOutput(output: 'earpiece' | 'speaker' | 'bluetooth') {
    // For 'bluetooth' and 'speaker', we do NOT force earpiece (letting the system
    // route to the best available output — Bluetooth if connected, speaker otherwise).
    // For 'earpiece', we force the earpiece route.
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: output === 'earpiece',
      staysActiveInBackground: true,
    });
  }

  async switchCamera(): Promise<boolean> {
    const videoTrack = this.localStream?.getVideoTracks()[0] as CameraSwitchableTrack | undefined;
    if (!videoTrack?._switchCamera) return false;

    videoTrack._switchCamera();
    return true;
  }

  cleanup() {
    this.localStream?.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    this.peerConnection?.close();
    this.localStream = null;
    this.remoteStream = null;
    this.peerConnection = null;
    this.pendingRemoteCandidates = [];
    this.pendingLocalIceCandidates = [];
    this.callId = null;
    this.emitLocalStream(null);
    this.emitRemoteStream(null);
    this.scheduleAudioModeReset();
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  getConnectionState(): string {
    return this.peerConnection?.connectionState || 'closed';
  }

  private buildRemoteStreamFromTrack(track?: MediaStreamTrack) {
    if (!track) return null;

    if (!this.remoteStream) {
      this.remoteStream = new MediaStream([track]);
      return this.remoteStream;
    }

    const existingTrack = this.remoteStream.getTracks().some((streamTrack) => streamTrack.id === track.id);
    if (!existingTrack) {
      this.remoteStream.addTrack(track);
    }

    return this.remoteStream;
  }

  private scheduleAudioModeReset() {
    const generation = ++this.audioModeGeneration;
    setTimeout(() => {
      if (generation !== this.audioModeGeneration || this.peerConnection || this.localStream) return;
      void this.resetAudioMode();
    }, 250);
  }

  private async resetAudioMode() {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
    } catch (error) {
      console.warn('[WebRTC] Failed to reset audio mode:', error);
    }
  }

  private sendIceCandidate(candidate: RTCIceCandidateType) {
    if (!this.callId) return;

    signalingClient.send(
      'webrtc:ice-candidate',
      {
        callId: this.callId,
        candidate,
      },
      { queueIfDisconnected: true }
    );
  }

  private flushPendingLocalIceCandidates() {
    if (!this.callId || this.callId.startsWith('temp_') || this.pendingLocalIceCandidates.length === 0) {
      return;
    }

    const candidates = [...this.pendingLocalIceCandidates];
    this.pendingLocalIceCandidates = [];

    for (const candidate of candidates) {
      this.sendIceCandidate(candidate);
    }
  }

  private async flushPendingRemoteCandidates() {
    if (!this.peerConnection?.remoteDescription || this.pendingRemoteCandidates.length === 0) return;

    const candidates = [...this.pendingRemoteCandidates];
    this.pendingRemoteCandidates = [];

    for (const candidate of candidates) {
      try {
        await this.peerConnection.addIceCandidate(candidate);
      } catch (error) {
        console.warn('[WebRTC] Failed to flush ICE candidate:', error);
      }
    }
  }

  private emitLocalStream(stream: MediaStream | null) {
    this.callbacks.forEach((callbacks) => callbacks.onLocalStream?.(stream));
  }

  private emitRemoteStream(stream: MediaStream | null) {
    this.callbacks.forEach((callbacks) => callbacks.onRemoteStream?.(stream));
  }

  private emitConnectionState(state: string) {
    this.callbacks.forEach((callbacks) => callbacks.onConnectionStateChange?.(state));
  }
}

export const webrtcManager = new WebRTCManager();
