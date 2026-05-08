export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface CallState {
  callId: string | null;
  remoteUserId: string | null;
  remoteUsername: string | null;
  remoteOffer: RTCSessionDescriptionType | null;
  callType: 'audio' | 'video';
  status: CallStatus;
  duration: number;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn: boolean;
  isFrontCamera: boolean;
}

export type CallStatus =
  | 'idle'
  | 'outgoing'
  | 'incoming'
  | 'connecting'
  | 'active'
  | 'reconnecting'
  | 'ended';

export interface WSMessage {
  type: WSEventType;
  payload: Record<string, unknown>;
}

export type WSEventType =
  | 'call:initiate'
  | 'call:accept'
  | 'call:reject'
  | 'call:end'
  | 'call:busy'
  | 'webrtc:offer'
  | 'webrtc:answer'
  | 'webrtc:ice-candidate'
  | 'webrtc:renegotiate'
  | 'user:online'
  | 'user:offline'
  | 'call:incoming'
  | 'call:accepted'
  | 'call:rejected'
  | 'call:ended'
  | 'call:missed'
  | 'media:toggle-audio'
  | 'media:toggle-video'
  | 'error'
  | 'connection:open'
  | 'connection:close'
  | 'connection:error'
  | 'connection:failed';

export interface ICEServer {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface IncomingCallPayload {
  callId: string;
  callerId: string;
  callerName: string;
  callType: 'audio' | 'video';
  offer?: RTCSessionDescriptionType;
  iceServers: ICEServer[];
}

export interface RTCSessionDescriptionType {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface RTCIceCandidateType {
  candidate: string;
  sdpMLineIndex: number | null;
  sdpMid: string | null;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ApiErrorResponse {
  error: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
