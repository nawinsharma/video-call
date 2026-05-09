import { useEffect, useCallback, useState } from 'react';
import { useCallStore } from '../stores/callStore';
import { signalingClient } from '../services/websocket/signalingClient';
import { webrtcManager } from '../services/webrtc/webrtcManager';
import { callsService } from '../services/calls/callsService';
import { WS_EVENTS, CALL_TIMEOUT_MS } from '../constants';
import * as Haptics from 'expo-haptics';
import { MediaStream } from 'react-native-webrtc';
import type { ICEServer, RTCIceCandidateType } from '../types';

let callTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let durationInterval: ReturnType<typeof setInterval> | null = null;

function clearCallTimeout() {
  if (callTimeoutTimer) {
    clearTimeout(callTimeoutTimer);
    callTimeoutTimer = null;
  }
}

function startDurationTimer() {
  if (durationInterval) return;

  const startTime = Date.now() - useCallStore.getState().duration * 1000;
  durationInterval = setInterval(() => {
    useCallStore.getState().updateDuration(Math.floor((Date.now() - startTime) / 1000));
  }, 1000);
}

function stopDurationTimer() {
  if (durationInterval) {
    clearInterval(durationInterval);
    durationInterval = null;
  }
}

function cleanupCallState() {
  clearCallTimeout();
  stopDurationTimer();
  webrtcManager.cleanup();
}

export function useCallEvents() {
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      signalingClient.on(WS_EVENTS.CALL_INITIATE, (msg) => {
        const { callId, iceServers } = msg.payload as {
          callId: string;
          iceServers?: Array<{ urls: string[]; username?: string; credential?: string }>;
        };

        useCallStore.getState().updateSession({ callId, iceServers });
        webrtcManager.setCallId(callId);
      })
    );

    unsubs.push(
      signalingClient.on(WS_EVENTS.CALL_INCOMING, (msg) => {
        const { callId, callerId, callerName, callType, offer, iceServers } = msg.payload as {
          callId: string;
          callerId: string;
          callerName: string;
          callType: 'audio' | 'video';
          offer?: { type: 'offer' | 'answer'; sdp: string };
          iceServers?: Array<{ urls: string[]; username?: string; credential?: string }>;
        };
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        useCallStore.getState().receiveCall({ callId, callerId, callerName, callType, offer, iceServers });
      })
    );

    unsubs.push(
      signalingClient.on(WS_EVENTS.CALL_ACCEPTED, async (msg) => {
        const { answer, iceServers } = msg.payload as {
          callId: string;
          answer: { type: 'offer' | 'answer'; sdp: string };
          iceServers?: Array<{ urls: string[]; username?: string; credential?: string }>;
        };

        clearCallTimeout();
        useCallStore.getState().setStatus('active');
        if (iceServers) useCallStore.getState().setIceServers(iceServers);
        await webrtcManager.handleAnswer(answer);
        startDurationTimer();
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      })
    );

    unsubs.push(
      signalingClient.on(WS_EVENTS.CALL_REJECTED, () => {
        clearCallTimeout();
        useCallStore.getState().endCall();
        cleanupCallState();
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      })
    );

    unsubs.push(
      signalingClient.on(WS_EVENTS.CALL_ENDED, () => {
        useCallStore.getState().endCall();
        cleanupCallState();
      })
    );

    unsubs.push(
      signalingClient.on(WS_EVENTS.WEBRTC_ICE_CANDIDATE, (msg) => {
        const payload = msg.payload as { candidate: RTCIceCandidateType };
        void webrtcManager.addIceCandidate(payload.candidate);
      })
    );

    unsubs.push(signalingClient.on(WS_EVENTS.MEDIA_TOGGLE_AUDIO, () => {}));
    unsubs.push(signalingClient.on(WS_EVENTS.MEDIA_TOGGLE_VIDEO, () => {}));

    return () => unsubs.forEach((unsub) => unsub());
  }, []);
}

export function useCall() {
  const callStore = useCallStore();
  const [localStream, setLocalStream] = useState<MediaStream | null>(() => webrtcManager.getLocalStream());
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(() => webrtcManager.getRemoteStream());

  useEffect(() => {
    webrtcManager.setCallbacks({
      onRemoteStream: (stream) => setRemoteStream(stream),
      onLocalStream: (stream) => setLocalStream(stream),
      onConnectionStateChange: (state) => {
        if (state === 'connected') {
          useCallStore.getState().setStatus('active');
          startDurationTimer();
        }
        if (state === 'disconnected') useCallStore.getState().setStatus('reconnecting');
        if (state === 'failed') {
          useCallStore.getState().endCall();
          cleanupCallState();
          setLocalStream(null);
          setRemoteStream(null);
        }
      },
    });

    setLocalStream(webrtcManager.getLocalStream());
    setRemoteStream(webrtcManager.getRemoteStream());
  }, []);

  const fetchIceServers = useCallback(async (fallback: ICEServer[]): Promise<ICEServer[]> => {
    try {
      const servers = await callsService.getIceServers();
      if (servers.length > 0) return servers;
    } catch (e) {
      console.warn('[Call] Could not fetch ICE servers from API, using stored fallback:', e);
    }
    return fallback;
  }, []);

  const initiateCall = useCallback(async (remoteUserId: string, remoteUsername: string, callType: 'audio' | 'video') => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const iceServers = await fetchIceServers(callStore.iceServers);
      await webrtcManager.initialize(iceServers);
      await webrtcManager.startLocalStream(callType === 'video');

      const tempCallId = `temp_${Date.now()}`;
      callStore.startCall({ callId: tempCallId, remoteUserId, remoteUsername, callType });

      const offer = await webrtcManager.createOffer(tempCallId);

      const sent = signalingClient.send('call:initiate', {
        calleeId: remoteUserId,
        callType,
        offer: { type: offer.type, sdp: offer.sdp },
      });
      if (!sent) {
        throw new Error('Signaling connection unavailable');
      }

      // Set timeout for unanswered call
      callTimeoutTimer = setTimeout(() => {
        if (useCallStore.getState().status !== 'outgoing') return;

        signalingClient.send('call:end', { callId: useCallStore.getState().callId });
        useCallStore.getState().endCall();
        cleanupCallState();
        setLocalStream(null);
        setRemoteStream(null);
      }, CALL_TIMEOUT_MS);
    } catch (error) {
      console.error('[Call] Failed to initiate:', error);
      callStore.reset();
      cleanupCallState();
      setLocalStream(null);
      setRemoteStream(null);
    }
  }, [callStore, fetchIceServers]);

  const acceptCall = useCallback(async () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      callStore.setStatus('connecting');

      const iceServers = await fetchIceServers(callStore.iceServers);
      await webrtcManager.initialize(iceServers);
      await webrtcManager.startLocalStream(callStore.callType === 'video');

      // The offer should have been received with the incoming call
      if (!callStore.callId || !callStore.remoteOffer) {
        throw new Error('Missing incoming offer information');
      }
      const answer = await webrtcManager.handleOffer(callStore.callId, callStore.remoteOffer);

      const sent = signalingClient.send('call:accept', {
        callId: callStore.callId,
        answer: { type: answer.type, sdp: answer.sdp },
      });
      if (!sent) {
        throw new Error('Signaling connection unavailable');
      }

      callStore.setStatus('active');
      startDurationTimer();
    } catch (error) {
      console.error('[Call] Failed to accept:', error);
      callStore.reset();
      cleanupCallState();
      setLocalStream(null);
      setRemoteStream(null);
    }
  }, [callStore, fetchIceServers]);

  const rejectCall = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    signalingClient.send('call:reject', { callId: callStore.callId });
    callStore.reset();
    cleanupCallState();
    setLocalStream(null);
    setRemoteStream(null);
  }, [callStore]);

  const endCall = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearCallTimeout();
    stopDurationTimer();
    signalingClient.send('call:end', { callId: callStore.callId });
    callStore.endCall();
    cleanupCallState();
    setLocalStream(null);
    setRemoteStream(null);
  }, [callStore]);

  const toggleMute = useCallback(() => {
    callStore.toggleMute();
    webrtcManager.toggleAudio(!callStore.isMuted);
    signalingClient.send('media:toggle-audio', {
      callId: callStore.callId,
      enabled: callStore.isMuted,
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [callStore]);

  const toggleCamera = useCallback(() => {
    callStore.toggleCamera();
    webrtcManager.toggleVideo(!callStore.isCameraOff);
    signalingClient.send('media:toggle-video', {
      callId: callStore.callId,
      enabled: callStore.isCameraOff,
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [callStore]);

  const flipCamera = useCallback(() => {
    callStore.flipCamera();
    webrtcManager.switchCamera();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [callStore]);

  return {
    ...callStore,
    localStream,
    remoteStream,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    flipCamera,
  };
}
