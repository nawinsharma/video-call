import { create } from 'zustand';
import type { CallState, CallStatus, ICEServer, RTCSessionDescriptionType } from '../types';

export type AudioOutput = 'earpiece' | 'speaker' | 'bluetooth';

interface CallStore extends CallState {
  iceServers: ICEServer[];
  audioOutput: AudioOutput;
  isMinimized: boolean;
  startCall: (params: { callId: string; remoteUserId: string; remoteUsername: string; callType: 'audio' | 'video'; iceServers?: ICEServer[] }) => void;
  receiveCall: (params: { callId: string; callerId: string; callerName: string; callType: 'audio' | 'video'; offer?: RTCSessionDescriptionType; iceServers?: ICEServer[] }) => void;
  updateSession: (params: { callId?: string; iceServers?: ICEServer[]; remoteOffer?: RTCSessionDescriptionType | null }) => void;
  setStatus: (status: CallStatus) => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  cycleAudioOutput: () => void;
  setAudioOutput: (output: AudioOutput) => void;
  flipCamera: () => void;
  setRemoteAudioEnabled: (enabled: boolean) => void;
  setRemoteVideoEnabled: (enabled: boolean) => void;
  updateDuration: (duration: number) => void;
  setIceServers: (servers: ICEServer[]) => void;
  endCall: () => void;
  minimize: () => void;
  maximize: () => void;
  reset: () => void;
}

const initialState: CallState & { iceServers: ICEServer[]; audioOutput: AudioOutput; isMinimized: boolean } = {
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
  audioOutput: 'earpiece',
  isMinimized: false,
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
      audioOutput: callType === 'video' ? 'speaker' : 'earpiece',
      isFrontCamera: true,
      remoteAudioEnabled: true,
      remoteVideoEnabled: true,
      isMinimized: false,
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
      audioOutput: callType === 'video' ? 'speaker' : 'earpiece',
      isFrontCamera: true,
      remoteAudioEnabled: true,
      remoteVideoEnabled: true,
      isMinimized: false,
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

  cycleAudioOutput: () =>
    set((state) => {
      const order: AudioOutput[] = ['earpiece', 'speaker', 'bluetooth'];
      const current = order.indexOf(state.audioOutput);
      const next = order[(current + 1) % order.length];
      return { audioOutput: next, isSpeakerOn: next !== 'earpiece' };
    }),

  setAudioOutput: (audioOutput) => set({ audioOutput, isSpeakerOn: audioOutput !== 'earpiece' }),

  flipCamera: () => set((state) => ({ isFrontCamera: !state.isFrontCamera })),

  setRemoteAudioEnabled: (remoteAudioEnabled) => set({ remoteAudioEnabled }),

  setRemoteVideoEnabled: (remoteVideoEnabled) => set({ remoteVideoEnabled }),

  updateDuration: (duration) => set({ duration }),

  setIceServers: (iceServers) => set({ iceServers }),

  endCall: () => set({ status: 'ended', isMinimized: false }),

  minimize: () => set({ isMinimized: true }),

  maximize: () => set({ isMinimized: false }),

  reset: () => set(initialState),
}));
