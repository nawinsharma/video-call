import { create } from 'zustand';
import type { CallState, CallStatus, ICEServer, RTCSessionDescriptionType } from '../types';

interface CallStore extends CallState {
  iceServers: ICEServer[];
  startCall: (params: { callId: string; remoteUserId: string; remoteUsername: string; callType: 'audio' | 'video'; iceServers?: ICEServer[] }) => void;
  receiveCall: (params: { callId: string; callerId: string; callerName: string; callType: 'audio' | 'video'; offer?: RTCSessionDescriptionType; iceServers?: ICEServer[] }) => void;
  updateSession: (params: { callId?: string; iceServers?: ICEServer[]; remoteOffer?: RTCSessionDescriptionType | null }) => void;
  setStatus: (status: CallStatus) => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleSpeaker: () => void;
  flipCamera: () => void;
  setRemoteAudioEnabled: (enabled: boolean) => void;
  setRemoteVideoEnabled: (enabled: boolean) => void;
  updateDuration: (duration: number) => void;
  setIceServers: (servers: ICEServer[]) => void;
  endCall: () => void;
  reset: () => void;
}

const initialState: CallState & { iceServers: ICEServer[] } = {
  callId: null,
  remoteUserId: null,
  remoteUsername: null,
  remoteOffer: null,
  role: null,
  callType: 'video',
  status: 'idle',
  duration: 0,
  isMuted: false,
  isCameraOff: false,
  isSpeakerOn: true,
  isFrontCamera: true,
  remoteAudioEnabled: true,
  remoteVideoEnabled: true,
  iceServers: [],
};

export const useCallStore = create<CallStore>((set) => ({
  ...initialState,

  startCall: ({ callId, remoteUserId, remoteUsername, callType, iceServers }) =>
    set({
      callId,
      remoteUserId,
      remoteUsername,
      remoteOffer: null,
      role: 'caller',
      callType,
      status: 'outgoing',
      isMuted: false,
      isCameraOff: false,
      isSpeakerOn: callType === 'video',
      isFrontCamera: true,
      remoteAudioEnabled: true,
      remoteVideoEnabled: true,
      iceServers: iceServers || [],
    }),

  receiveCall: ({ callId, callerId, callerName, callType, offer, iceServers }) =>
    set({
      callId,
      remoteUserId: callerId,
      remoteUsername: callerName,
      remoteOffer: offer ?? null,
      role: 'callee',
      callType,
      status: 'incoming',
      isMuted: false,
      isCameraOff: false,
      isSpeakerOn: callType === 'video',
      isFrontCamera: true,
      remoteAudioEnabled: true,
      remoteVideoEnabled: true,
      iceServers: iceServers || [],
    }),

  updateSession: ({ callId, iceServers, remoteOffer }) =>
    set((state) => ({
      callId: callId ?? state.callId,
      iceServers: iceServers ?? state.iceServers,
      remoteOffer: remoteOffer === undefined ? state.remoteOffer : remoteOffer,
    })),

  setStatus: (status) => set({ status }),

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

  toggleCamera: () => set((state) => ({ isCameraOff: !state.isCameraOff })),

  toggleSpeaker: () => set((state) => ({ isSpeakerOn: !state.isSpeakerOn })),

  flipCamera: () => set((state) => ({ isFrontCamera: !state.isFrontCamera })),

  setRemoteAudioEnabled: (remoteAudioEnabled) => set({ remoteAudioEnabled }),

  setRemoteVideoEnabled: (remoteVideoEnabled) => set({ remoteVideoEnabled }),

  updateDuration: (duration) => set({ duration }),

  setIceServers: (iceServers) => set({ iceServers }),

  endCall: () => set({ status: 'ended' }),

  reset: () => set(initialState),
}));
