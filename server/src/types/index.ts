export interface JWTPayload {
  userId: string;
  username: string;
}

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
  | 'error';

export interface CallInitiatePayload {
  calleeId: string;
  callType: 'audio' | 'video';
  offer?: RTCSessionDescriptionInit;
}

export interface CallResponsePayload {
  callId: string;
  answer?: RTCSessionDescriptionInit;
}

export interface ICECandidatePayload {
  callId: string;
  candidate: RTCIceCandidateInit;
}

export interface RTCSessionDescriptionInit {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface RTCIceCandidateInit {
  candidate: string;
  sdpMLineIndex: number | null;
  sdpMid: string | null;
}

export interface ConnectedUser {
  userId: string;
  ws: {
    send: (data: string) => void;
  };
  username: string;
}

export interface SocketMessage {
  type: WSEventType;
  payload: Record<string, unknown>;
}

export interface WSQueryMeta {
  userId?: string;
  username?: string;
}
