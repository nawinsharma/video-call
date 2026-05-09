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
  streams: MediaStream[];
}

interface PeerConnectionEventHandlers {
  onicecandidate: ((event: IceCandidateEvent) => void) | null;
  ontrack: ((event: TrackEvent) => void) | null;
  onconnectionstatechange: (() => void) | null;
  oniceconnectionstatechange: (() => void) | null;
}

class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingCandidates: RTCIceCandidate[] = [];
  /** Trickled ICE from caller before server assigns real call id (temp_* is not in activeCalls). */
  private pendingLocalIceCandidates: Array<{
    candidate: string;
    sdpMLineIndex: number | null;
    sdpMid: string | null;
  }> = [];
  private callId: string | null = null;

  private onRemoteStream: ((stream: MediaStream) => void) | null = null;
  private onLocalStream: ((stream: MediaStream) => void) | null = null;
  private onConnectionStateChange: ((state: string) => void) | null = null;

  setCallbacks(callbacks: {
    onRemoteStream?: (stream: MediaStream) => void;
    onLocalStream?: (stream: MediaStream) => void;
    onConnectionStateChange?: (state: string) => void;
  }) {
    this.onRemoteStream = callbacks.onRemoteStream || null;
    this.onLocalStream = callbacks.onLocalStream || null;
    this.onConnectionStateChange = callbacks.onConnectionStateChange || null;
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
    this.pendingCandidates = [];
    this.pendingLocalIceCandidates = [];

    const config = {
      iceServers: iceServers || DEFAULT_ICE_SERVERS,
      iceCandidatePoolSize: 10,
    };

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

      signalingClient.send('webrtc:ice-candidate', {
        callId: this.callId,
        candidate: candidatePayload,
      });
    };

    peerConnectionWithHandlers.ontrack = (event: TrackEvent) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.onRemoteStream?.(event.streams[0]);
      }
    };

    peerConnectionWithHandlers.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState || 'unknown';
      console.log('[WebRTC] Connection state:', state);
      this.onConnectionStateChange?.(state);
    };

    peerConnectionWithHandlers.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', this.peerConnection?.iceConnectionState);
    };
  }

  async startLocalStream(isVideo: boolean): Promise<MediaStream> {
    const constraints: {
      audio: boolean;
      video:
        | boolean
        | {
            facingMode: 'user' | 'environment';
            width: { ideal: number };
            height: { ideal: number };
          };
    } = {
      audio: true,
      video: isVideo
        ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
        : false,
    };

    this.localStream = await mediaDevices.getUserMedia(constraints);
    this.onLocalStream?.(this.localStream);

    this.localStream.getTracks().forEach((track: MediaStreamTrack) => {
      this.peerConnection?.addTrack(track, this.localStream!);
    });

    return this.localStream;
  }

  async createOffer(callId: string): Promise<RTCSessionDescription> {
    this.callId = callId;

    const offer = await this.peerConnection!.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await this.peerConnection!.setLocalDescription(offer);
    return offer as RTCSessionDescription;
  }

  async handleOffer(callId: string, offer: RTCSessionDescriptionType): Promise<RTCSessionDescription> {
    this.callId = callId;

    await this.peerConnection!.setRemoteDescription(
      new RTCSessionDescription(offer)
    );

    // Process pending ICE candidates
    for (const candidate of this.pendingCandidates) {
      await this.peerConnection!.addIceCandidate(candidate);
    }
    this.pendingCandidates = [];

    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);

    return answer as RTCSessionDescription;
  }

  setCallId(callId: string) {
    const previousCallId = this.callId;
    this.callId = callId;

    if (previousCallId?.startsWith('temp_') && !callId.startsWith('temp_')) {
      for (const candidate of this.pendingLocalIceCandidates) {
        signalingClient.send('webrtc:ice-candidate', {
          callId,
          candidate,
        });
      }
      this.pendingLocalIceCandidates = [];
    }
  }

  hasRemoteDescription(): boolean {
    return !!this.peerConnection?.remoteDescription;
  }

  async handleAnswer(answer: RTCSessionDescriptionType) {
    await this.peerConnection!.setRemoteDescription(
      new RTCSessionDescription(answer)
    );

    // Process pending ICE candidates
    for (const candidate of this.pendingCandidates) {
      await this.peerConnection!.addIceCandidate(candidate);
    }
    this.pendingCandidates = [];
  }

  async addIceCandidate(candidate: RTCIceCandidateType) {
    const iceCandidate = new RTCIceCandidate(candidate);

    if (this.peerConnection?.remoteDescription) {
      await this.peerConnection.addIceCandidate(iceCandidate);
    } else {
      this.pendingCandidates.push(iceCandidate);
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

  async switchCamera() {
    const videoTrack = this.localStream?.getVideoTracks()[0] as CameraSwitchableTrack | undefined;
    if (videoTrack?._switchCamera) {
      videoTrack._switchCamera();
    }
  }

  cleanup() {
    this.localStream?.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    this.peerConnection?.close();
    this.localStream = null;
    this.remoteStream = null;
    this.peerConnection = null;
    this.pendingCandidates = [];
    this.pendingLocalIceCandidates = [];
    this.callId = null;
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
}

export const webrtcManager = new WebRTCManager();
