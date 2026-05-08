export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://video-call-server.nawin.xyz';

export const WS_URL =
  process.env.EXPO_PUBLIC_WS_URL ?? 'wss://video-call-server.nawin.xyz/ws/signaling';

export const DEFAULT_ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['stun:stun2.l.google.com:19302', 'stun:stun3.l.google.com:19302'] },
];

export const WS_EVENTS = {
  CALL_INITIATE: 'call:initiate',
  CALL_ACCEPT: 'call:accept',
  CALL_REJECT: 'call:reject',
  CALL_END: 'call:end',
  CALL_INCOMING: 'call:incoming',
  CALL_ACCEPTED: 'call:accepted',
  CALL_REJECTED: 'call:rejected',
  CALL_ENDED: 'call:ended',
  WEBRTC_OFFER: 'webrtc:offer',
  WEBRTC_ANSWER: 'webrtc:answer',
  WEBRTC_ICE_CANDIDATE: 'webrtc:ice-candidate',
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  MEDIA_TOGGLE_AUDIO: 'media:toggle-audio',
  MEDIA_TOGGLE_VIDEO: 'media:toggle-video',
} as const;

export const CALL_TIMEOUT_MS = 45000;
export const RECONNECT_DELAY_MS = 2000;
export const MAX_RECONNECT_ATTEMPTS = 5;
export const ICE_GATHERING_TIMEOUT_MS = 5000;
