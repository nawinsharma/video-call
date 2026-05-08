import { useEffect, useRef, useCallback } from 'react';
import { useCallStore } from '../stores/callStore';
import { signalingClient } from '../services/websocket/signalingClient';
import { webrtcManager } from '../services/webrtc/webrtcManager';
import { callsService } from '../services/calls/callsService';
import { WS_EVENTS, CALL_TIMEOUT_MS } from '../constants';
import * as Haptics from 'expo-haptics';
import { MediaStream } from 'react-native-webrtc';
import { useState } from 'react';
import type { ICEServer, RTCIceCandidateType } from '../types';

export function useCall() {
  const callStore = useCallStore();
  const callTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const unsubs: (() => void)[] = [];

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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        callStore.receiveCall({ callId, callerId, callerName, callType, offer, iceServers });
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
        callStore.setStatus('active');
        if (iceServers) callStore.setIceServers(iceServers);
        await webrtcManager.handleAnswer(answer);
        startDurationTimer();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      })
    );

    unsubs.push(
      signalingClient.on(WS_EVENTS.CALL_REJECTED, () => {
        clearCallTimeout();
        callStore.endCall();
        webrtcManager.cleanup();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      })
    );

    unsubs.push(
      signalingClient.on(WS_EVENTS.CALL_ENDED, () => {
        clearCallTimeout();
        stopDurationTimer();
        callStore.endCall();
        webrtcManager.cleanup();
        setLocalStream(null);
        setRemoteStream(null);
      })
    );

    unsubs.push(
      signalingClient.on(WS_EVENTS.WEBRTC_ICE_CANDIDATE, (msg) => {
        const payload = msg.payload as { candidate: RTCIceCandidateType };
        webrtcManager.addIceCandidate(payload.candidate);
      })
    );

    unsubs.push(
      signalingClient.on(WS_EVENTS.MEDIA_TOGGLE_AUDIO, (msg) => {
        // Remote user toggled their audio
      })
    );

    unsubs.push(
      signalingClient.on(WS_EVENTS.MEDIA_TOGGLE_VIDEO, (msg) => {
        // Remote user toggled their video
      })
    );

    return () => unsubs.forEach((unsub) => unsub());
  }, []);

  const clearCallTimeout = () => {
    if (callTimeout.current) {
      clearTimeout(callTimeout.current);
      callTimeout.current = null;
    }
  };

  const startDurationTimer = () => {
    const startTime = Date.now();
    durationInterval.current = setInterval(() => {
      callStore.updateDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
  };

  const stopDurationTimer = () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
  };

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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      webrtcManager.setCallbacks({
        onRemoteStream: (stream) => setRemoteStream(stream),
        onLocalStream: (stream) => setLocalStream(stream),
        onConnectionStateChange: (state) => {
          if (state === 'connected') callStore.setStatus('active');
          if (state === 'disconnected') callStore.setStatus('reconnecting');
          if (state === 'failed') endCall();
        },
      });

      const iceServers = await fetchIceServers(callStore.iceServers);
      await webrtcManager.initialize(iceServers);
      await webrtcManager.startLocalStream(callType === 'video');

      const tempCallId = `temp_${Date.now()}`;
      callStore.startCall({ callId: tempCallId, remoteUserId, remoteUsername, callType });

      const offer = await webrtcManager.createOffer(tempCallId);

      signalingClient.send('call:initiate', {
        calleeId: remoteUserId,
        callType,
        offer: { type: offer.type, sdp: offer.sdp },
      });

      // Set timeout for unanswered call
      callTimeout.current = setTimeout(() => {
        if (callStore.status === 'outgoing') {
          endCall();
        }
      }, CALL_TIMEOUT_MS);
    } catch (error) {
      console.error('[Call] Failed to initiate:', error);
      callStore.reset();
      webrtcManager.cleanup();
    }
  }, []);

  const acceptCall = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      callStore.setStatus('connecting');

      webrtcManager.setCallbacks({
        onRemoteStream: (stream) => setRemoteStream(stream),
        onLocalStream: (stream) => setLocalStream(stream),
        onConnectionStateChange: (state) => {
          if (state === 'connected') {
            callStore.setStatus('active');
            startDurationTimer();
          }
          if (state === 'disconnected') callStore.setStatus('reconnecting');
          if (state === 'failed') endCall();
        },
      });

      const iceServers = await fetchIceServers(callStore.iceServers);
      await webrtcManager.initialize(iceServers);
      await webrtcManager.startLocalStream(callStore.callType === 'video');

      // The offer should have been received with the incoming call
      if (!callStore.callId || !callStore.remoteOffer) {
        throw new Error('Missing incoming offer information');
      }
      const answer = await webrtcManager.handleOffer(callStore.callId, callStore.remoteOffer);

      signalingClient.send('call:accept', {
        callId: callStore.callId,
        answer: { type: answer.type, sdp: answer.sdp },
      });

      callStore.setStatus('active');
      startDurationTimer();
    } catch (error) {
      console.error('[Call] Failed to accept:', error);
      callStore.reset();
      webrtcManager.cleanup();
    }
  }, []);

  const rejectCall = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    signalingClient.send('call:reject', { callId: callStore.callId });
    callStore.reset();
    webrtcManager.cleanup();
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  const endCall = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearCallTimeout();
    stopDurationTimer();
    signalingClient.send('call:end', { callId: callStore.callId });
    callStore.endCall();
    webrtcManager.cleanup();
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  const toggleMute = useCallback(() => {
    callStore.toggleMute();
    webrtcManager.toggleAudio(!callStore.isMuted);
    signalingClient.send('media:toggle-audio', {
      callId: callStore.callId,
      enabled: callStore.isMuted,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const toggleCamera = useCallback(() => {
    callStore.toggleCamera();
    webrtcManager.toggleVideo(!callStore.isCameraOff);
    signalingClient.send('media:toggle-video', {
      callId: callStore.callId,
      enabled: callStore.isCameraOff,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const flipCamera = useCallback(() => {
    callStore.flipCamera();
    webrtcManager.switchCamera();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

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
