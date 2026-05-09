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
  callType: 'video',
  status: 'idle',
  duration: 0,
  isMuted: false,
  isCameraOff: false,
  isSpeakerOn: true,
  isFrontCamera: true,
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
      callType,
      status: 'outgoing',
      iceServers: iceServers || [],
    }),

  receiveCall: ({ callId, callerId, callerName, callType, offer, iceServers }) =>
    set({
      callId,
      remoteUserId: callerId,
      remoteUsername: callerName,
      remoteOffer: offer ?? null,
      callType,
      status: 'incoming',
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

  updateDuration: (duration) => set({ duration }),

  setIceServers: (iceServers) => set({ iceServers }),

  endCall: () => set({ status: 'ended' }),

  reset: () => set(initialState),
}));
