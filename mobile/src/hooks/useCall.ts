import { useEffect, useCallback, useState } from 'react';
import { useCallStore } from '../stores/callStore';
import { signalingClient } from '../services/websocket/signalingClient';
import { webrtcManager } from '../services/webrtc/webrtcManager';
import { callsService } from '../services/calls/callsService';
import {
  WS_EVENTS,
  CALL_TIMEOUT_MS,
  CALL_CONNECTION_TIMEOUT_MS,
  ICE_RESTART_DELAY_MS,
  MAX_ICE_RESTART_ATTEMPTS,
} from '../constants';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import { MediaStream } from 'react-native-webrtc';
import type { ICEServer, RTCIceCandidateType } from '../types';
import { ensureCallPermissions } from '../services/permissions/callPermissions';

let callTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let durationInterval: ReturnType<typeof setInterval> | null = null;
let connectionFailureTimer: ReturnType<typeof setTimeout> | null = null;
let connectionSetupTimer: ReturnType<typeof setTimeout> | null = null;
let iceRestartTimer: ReturnType<typeof setTimeout> | null = null;
let iceRestartAttempts = 0;

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

function clearConnectionFailureTimer() {
  if (connectionFailureTimer) {
    clearTimeout(connectionFailureTimer);
    connectionFailureTimer = null;
  }
}

function clearConnectionSetupTimer() {
  if (connectionSetupTimer) {
    clearTimeout(connectionSetupTimer);
    connectionSetupTimer = null;
  }
}

function clearIceRestartTimer() {
  if (iceRestartTimer) {
    clearTimeout(iceRestartTimer);
    iceRestartTimer = null;
  }
}

function cleanupCallState() {
  clearCallTimeout();
  clearConnectionFailureTimer();
  clearConnectionSetupTimer();
  clearIceRestartTimer();
  iceRestartAttempts = 0;
  stopDurationTimer();
  webrtcManager.cleanup();
}

function sendCallEnded(callId: string | null) {
  if (!callId || callId.startsWith('temp_')) return;
  signalingClient.send('call:end', { callId }, { queueIfDisconnected: true });
}

async function sendIceRestart(reason: string) {
  const { callId, role, status } = useCallStore.getState();
  if (!callId || callId.startsWith('temp_') || role !== 'caller') return;
  if (status === 'idle' || status === 'ended' || status === 'incoming' || status === 'outgoing') return;
  if (iceRestartAttempts >= MAX_ICE_RESTART_ATTEMPTS) {
    console.warn('[Call] ICE restart limit reached; ending call');
    sendCallEnded(callId);
    useCallStore.getState().endCall();
    cleanupCallState();
    return;
  }

  iceRestartAttempts++;
  useCallStore.getState().setStatus('reconnecting');

  try {
    console.warn(`[Call] Sending ICE restart (${reason}), attempt ${iceRestartAttempts}`);
    await signalingClient.waitUntilConnected();
    const offer = await webrtcManager.createRestartOffer();
    signalingClient.send(
      'webrtc:renegotiate',
      { callId, offer: { type: offer.type, sdp: offer.sdp } },
      { queueIfDisconnected: true }
    );
  } catch (error) {
    console.warn('[Call] ICE restart failed:', error);
    scheduleIceRestart('restart-failed');
  }
}

function scheduleIceRestart(reason: string, delay = ICE_RESTART_DELAY_MS) {
  if (iceRestartTimer) return;
  iceRestartTimer = setTimeout(() => {
    iceRestartTimer = null;
    void sendIceRestart(reason);
  }, delay);
}

function startConnectionSetupTimer() {
  clearConnectionSetupTimer();
  connectionSetupTimer = setTimeout(() => {
    connectionSetupTimer = null;
    const { callId, status, role } = useCallStore.getState();
    if (status !== 'connecting' && status !== 'reconnecting') return;

    console.warn('[Call] Connection setup timed out');
    if (role === 'caller') {
      scheduleIceRestart('connection-timeout', 0);
      return;
    }

    sendCallEnded(callId);
    useCallStore.getState().endCall();
    cleanupCallState();
  }, CALL_CONNECTION_TIMEOUT_MS);
}

export function useCallEvents() {
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      signalingClient.on(WS_EVENTS.CALL_INITIATE, (msg) => {
        const { callId, iceServers, delivered } = msg.payload as {
          callId: string;
          iceServers?: ICEServer[];
          delivered?: boolean;
        };

        if (useCallStore.getState().status !== 'outgoing') return;
        useCallStore.getState().updateSession({ callId, iceServers });
        webrtcManager.setCallId(callId);

        if (delivered === false) {
          console.warn('[Call] Receiver is not connected to signaling; waiting for push/reconnect fallback');
        }
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
          iceServers?: ICEServer[];
        };
        const currentCall = useCallStore.getState();
        if (currentCall.callId === callId) return;

        if (currentCall.status !== 'idle') {
          signalingClient.send('call:busy', { callId });
          return;
        }

        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        useCallStore.getState().receiveCall({ callId, callerId, callerName, callType, offer, iceServers });
      })
    );

    unsubs.push(
      signalingClient.on(WS_EVENTS.CALL_ACCEPTED, async (msg) => {
        const { callId, answer, iceServers } = msg.payload as {
          callId: string;
          answer: { type: 'offer' | 'answer'; sdp: string };
          iceServers?: ICEServer[];
        };

        if (useCallStore.getState().callId !== callId) return;
        clearCallTimeout();
        useCallStore.getState().setStatus('connecting');
        if (iceServers) useCallStore.getState().setIceServers(iceServers);
        startConnectionSetupTimer();
        try {
          await webrtcManager.handleAnswer(answer);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          console.error('[Call] Failed to handle accepted answer:', error);
          sendCallEnded(callId);
          useCallStore.getState().endCall();
          cleanupCallState();
        }
      })
    );

    unsubs.push(
      signalingClient.on(WS_EVENTS.CALL_REJECTED, (msg) => {
        const { callId } = msg.payload as { callId?: string };
        if (callId && useCallStore.getState().callId !== callId) return;

        clearCallTimeout();
        useCallStore.getState().endCall();
        cleanupCallState();
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      })
    );

    unsubs.push(
      signalingClient.on(WS_EVENTS.CALL_ENDED, (msg) => {
        const { callId } = msg.payload as { callId?: string };
        if (callId && useCallStore.getState().callId !== callId) return;

        useCallStore.getState().endCall();
        cleanupCallState();
      })
    );

    unsubs.push(
      signalingClient.on(WS_EVENTS.CALL_MISSED, (msg) => {
        const { callId } = msg.payload as { callId?: string };
        if (callId && useCallStore.getState().callId !== callId) return;

        useCallStore.getState().endCall();
        cleanupCallState();
      })
    );

    unsubs.push(
      signalingClient.on(WS_EVENTS.WEBRTC_ICE_CANDIDATE, (msg) => {
        const payload = msg.payload as { callId?: string; candidate: RTCIceCandidateType };
        if (payload.callId && useCallStore.getState().callId !== payload.callId) return;
        void webrtcManager.addIceCandidate(payload.candidate);
      })
    );

    const handleRemoteOffer = async (msg: { payload: Record<string, unknown> }) => {
      const payload = msg.payload as {
        callId?: string;
        offer?: { type: 'offer' | 'answer'; sdp: string };
      };
      if (!payload.callId || !payload.offer) return;
      if (useCallStore.getState().callId !== payload.callId) return;

      try {
        useCallStore.getState().setStatus('reconnecting');
        startConnectionSetupTimer();
        const answer = await webrtcManager.handleRemoteOffer(payload.callId, payload.offer);
        signalingClient.send(
          'webrtc:answer',
          { callId: payload.callId, answer: { type: answer.type, sdp: answer.sdp } },
          { queueIfDisconnected: true }
        );
      } catch (error) {
        console.warn('[Call] Failed to handle remote offer:', error);
      }
    };

    unsubs.push(signalingClient.on(WS_EVENTS.WEBRTC_OFFER, handleRemoteOffer));
    unsubs.push(signalingClient.on(WS_EVENTS.WEBRTC_RENEGOTIATE, handleRemoteOffer));

    unsubs.push(
      signalingClient.on(WS_EVENTS.WEBRTC_ANSWER, async (msg) => {
        const payload = msg.payload as {
          callId?: string;
          answer?: { type: 'offer' | 'answer'; sdp: string };
        };
        if (!payload.callId || !payload.answer) return;
        if (useCallStore.getState().callId !== payload.callId) return;

        try {
          await webrtcManager.handleAnswer(payload.answer);
          startConnectionSetupTimer();
        } catch (error) {
          console.warn('[Call] Failed to handle renegotiation answer:', error);
        }
      })
    );

    unsubs.push(
      signalingClient.on('connection:open', () => {
        const { status, role } = useCallStore.getState();
        if ((status === 'reconnecting' || status === 'connecting') && role === 'caller') {
          scheduleIceRestart('signaling-reconnected');
        }
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
    const removeCallbacks = webrtcManager.addCallbacks({
      onRemoteStream: (stream) => setRemoteStream(stream),
      onLocalStream: (stream) => setLocalStream(stream),
      onConnectionStateChange: (state) => {
        if (state === 'connected') {
          clearConnectionFailureTimer();
          clearConnectionSetupTimer();
          clearIceRestartTimer();
          iceRestartAttempts = 0;
          useCallStore.getState().setStatus('active');
          startDurationTimer();
        }
        if (state === 'disconnected') {
          const { status } = useCallStore.getState();
          if (status === 'active' && webrtcManager.hasRemoteDescription()) {
            useCallStore.getState().setStatus('reconnecting');
            startConnectionSetupTimer();
            scheduleIceRestart('disconnected');
          }
        }
        if (state === 'failed') {
          const { status } = useCallStore.getState();
          // RN WebRTC can report `failed` before the callee has answered or before remote SDP lands.
          if (status === 'outgoing' || status === 'connecting' || !webrtcManager.hasRemoteDescription()) {
            console.warn('[WebRTC] Ignoring failed before call is established');
            return;
          }
          if (connectionFailureTimer) return;

          useCallStore.getState().setStatus('reconnecting');
          scheduleIceRestart('failed');
          connectionFailureTimer = setTimeout(() => {
            const { callId } = useCallStore.getState();
            sendCallEnded(callId);
            useCallStore.getState().endCall();
            cleanupCallState();
            setLocalStream(null);
            setRemoteStream(null);
          }, 10000);
        }
      },
    });

    setLocalStream(webrtcManager.getLocalStream());
    setRemoteStream(webrtcManager.getRemoteStream());
    return removeCallbacks;
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

      const signalingReady = await signalingClient.waitUntilConnected();
      if (!signalingReady) {
        throw new Error('Signaling connection unavailable. Please wait a moment and try again.');
      }

      const hasPermissions = await ensureCallPermissions(callType === 'video');
      if (!hasPermissions) {
        throw new Error('Camera/microphone permission was not granted.');
      }

      clearCallTimeout();
      cleanupCallState();

      const iceServers = await fetchIceServers(useCallStore.getState().iceServers);
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
        throw new Error('Signaling connection unavailable. Please wait a moment and try again.');
      }

      // Set timeout for unanswered call
      callTimeoutTimer = setTimeout(() => {
        if (useCallStore.getState().status !== 'outgoing') return;

        sendCallEnded(useCallStore.getState().callId);
        useCallStore.getState().endCall();
        cleanupCallState();
        setLocalStream(null);
        setRemoteStream(null);
      }, CALL_TIMEOUT_MS);
    } catch (error) {
      console.error('[Call] Failed to initiate:', error);
      Alert.alert(
        'Call failed',
        error instanceof Error ? error.message : 'Could not start the call. Please try again.'
      );
      callStore.reset();
      cleanupCallState();
      setLocalStream(null);
      setRemoteStream(null);
    }
  }, [callStore, fetchIceServers]);

  const acceptCall = useCallback(async () => {
    const incomingCallId = useCallStore.getState().callId;

    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      callStore.setStatus('connecting');

      const signalingReady = await signalingClient.waitUntilConnected();
      if (!signalingReady) {
        throw new Error('Signaling connection unavailable');
      }

      const currentCall = useCallStore.getState();
      const hasPermissions = await ensureCallPermissions(currentCall.callType === 'video');
      if (!hasPermissions) {
        throw new Error('Camera/microphone permission was not granted.');
      }

      const iceServers = await fetchIceServers(currentCall.iceServers);
      await webrtcManager.initialize(iceServers);
      await webrtcManager.startLocalStream(currentCall.callType === 'video');

      // The offer should have been received with the incoming call
      const latestCall = useCallStore.getState();
      if (!latestCall.callId || !latestCall.remoteOffer) {
        throw new Error('Missing incoming offer information');
      }
      const answer = await webrtcManager.handleOffer(latestCall.callId, latestCall.remoteOffer);

      const sent = signalingClient.send('call:accept', {
        callId: latestCall.callId,
        answer: { type: answer.type, sdp: answer.sdp },
      });
      if (!sent) {
        throw new Error('Signaling connection unavailable');
      }

      callStore.setStatus('connecting');
      startConnectionSetupTimer();
    } catch (error) {
      console.error('[Call] Failed to accept:', error);
      if (incomingCallId) {
        signalingClient.send('call:reject', { callId: incomingCallId }, { queueIfDisconnected: true });
      }
      callStore.reset();
      cleanupCallState();
      setLocalStream(null);
      setRemoteStream(null);
    }
  }, [callStore, fetchIceServers]);

  const rejectCall = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (callStore.callId) {
      signalingClient.send('call:reject', { callId: callStore.callId }, { queueIfDisconnected: true });
    }
    callStore.reset();
    cleanupCallState();
    setLocalStream(null);
    setRemoteStream(null);
  }, [callStore]);

  const endCall = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearCallTimeout();
    stopDurationTimer();
    sendCallEnded(callStore.callId);
    callStore.endCall();
    cleanupCallState();
    setLocalStream(null);
    setRemoteStream(null);
  }, [callStore]);

  const toggleMute = useCallback(() => {
    const nextMuted = !useCallStore.getState().isMuted;
    callStore.toggleMute();
    webrtcManager.toggleAudio(!nextMuted);
    signalingClient.send('media:toggle-audio', {
      callId: callStore.callId,
      enabled: !nextMuted,
    }, { queueIfDisconnected: true });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [callStore]);

  const toggleCamera = useCallback(() => {
    const nextCameraOff = !useCallStore.getState().isCameraOff;
    callStore.toggleCamera();
    webrtcManager.toggleVideo(!nextCameraOff);
    signalingClient.send('media:toggle-video', {
      callId: callStore.callId,
      enabled: !nextCameraOff,
    }, { queueIfDisconnected: true });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [callStore]);

  const toggleSpeaker = useCallback(() => {
    const nextSpeakerOn = !useCallStore.getState().isSpeakerOn;
    callStore.toggleSpeaker();
    void webrtcManager.setSpeakerOn(nextSpeakerOn);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [callStore]);

  const flipCamera = useCallback(async () => {
    const switched = await webrtcManager.switchCamera();
    if (switched) {
      callStore.flipCamera();
    }
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
    toggleSpeaker,
    flipCamera,
  };
}
