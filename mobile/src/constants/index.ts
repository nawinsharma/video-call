export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://video-call-server.nawin.xyz';

export const WS_URL =
  process.env.EXPO_PUBLIC_WS_URL ?? 'wss://video-call-server.nawin.xyz/ws/signaling';

export const DEFAULT_ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['stun:stun2.l.google.com:19302', 'stun:stun3.l.google.com:19302'] },
];

export const WS_EVENTS = {
  CONNECTION_PING: 'connection:ping',
  CONNECTION_PONG: 'connection:pong',
  CALL_INITIATE: 'call:initiate',
  CALL_ACCEPT: 'call:accept',
  CALL_REJECT: 'call:reject',
  CALL_END: 'call:end',
  CALL_INCOMING: 'call:incoming',
  CALL_ACCEPTED: 'call:accepted',
  CALL_REJECTED: 'call:rejected',
  CALL_ENDED: 'call:ended',
  CALL_MISSED: 'call:missed',
  WEBRTC_OFFER: 'webrtc:offer',
  WEBRTC_ANSWER: 'webrtc:answer',
  WEBRTC_ICE_CANDIDATE: 'webrtc:ice-candidate',
  WEBRTC_RENEGOTIATE: 'webrtc:renegotiate',
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  MEDIA_TOGGLE_AUDIO: 'media:toggle-audio',
  MEDIA_TOGGLE_VIDEO: 'media:toggle-video',
} as const;

export const CALL_TIMEOUT_MS = 45000;
export const CALL_CONNECTION_TIMEOUT_MS = 20000;
export const ICE_RESTART_DELAY_MS = 1500;
export const MAX_ICE_RESTART_ATTEMPTS = 2;
export const RECONNECT_DELAY_MS = 2000;
export const MAX_RECONNECT_ATTEMPTS = 12;
export const SIGNALING_HEARTBEAT_INTERVAL_MS = 15000;
export const SIGNALING_HEARTBEAT_TIMEOUT_MS = 10000;
export const SIGNALING_MAX_PENDING_MESSAGES = 100;
export const ICE_GATHERING_TIMEOUT_MS = 5000;
