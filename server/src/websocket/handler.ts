import { Elysia } from 'elysia';
import { connectionManager } from './connections';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { sendCallNotification } from '../services/notifications';
import { getICEServers } from '../services/turn';
import type {
  CallInitiatePayload,
  CallResponsePayload,
  ICECandidatePayload,
  RTCSessionDescriptionInit,
  SocketMessage,
  WSQueryMeta,
} from '../types';

const activeCalls = new Map<string, {
  callerId: string;
  calleeId: string;
  callType: 'audio' | 'video';
  offer?: RTCSessionDescriptionInit;
  createdAt: number;
  acceptedAt?: number;
}>();

const RINGING_CALL_TTL_MS = 60 * 1000;
const ACTIVE_CALL_TTL_MS = 4 * 60 * 60 * 1000;

function userCanAccessCall(userId: string, call: { callerId: string; calleeId: string }) {
  return call.callerId === userId || call.calleeId === userId;
}

function getPeerUserId(userId: string, call: { callerId: string; calleeId: string }) {
  if (call.callerId === userId) return call.calleeId;
  if (call.calleeId === userId) return call.callerId;
  return null;
}

async function cleanupStaleCalls() {
  const now = Date.now();

  for (const [callId, call] of activeCalls) {
    const ttl = call.acceptedAt ? ACTIVE_CALL_TTL_MS : RINGING_CALL_TTL_MS;
    if (now - call.createdAt <= ttl) continue;

    activeCalls.delete(callId);
    updateCallBusyPresence(call);
    await db
      .update(schema.calls)
      .set({
        status: call.acceptedAt ? 'ended' : 'missed',
        endedAt: new Date(),
      })
      .where(eq(schema.calls.id, callId));

    connectionManager.sendTo(call.callerId, {
      type: call.acceptedAt ? 'call:ended' : 'call:missed',
      payload: { callId, reason: 'timeout' },
    }, { queueIfOffline: true });
    connectionManager.sendTo(call.calleeId, {
      type: call.acceptedAt ? 'call:ended' : 'call:missed',
      payload: { callId, reason: 'timeout' },
    }, { queueIfOffline: true });
  }
}

function isUserInTrackedCall(userId: string) {
  for (const call of activeCalls.values()) {
    if (call.callerId === userId || call.calleeId === userId) return true;
  }
  return false;
}

function updateCallBusyPresence(call: { callerId: string; calleeId: string }) {
  for (const userId of [call.callerId, call.calleeId]) {
    const isBusy = isUserInTrackedCall(userId);
    connectionManager.setBusy(userId, isBusy);
    connectionManager.broadcast({ type: 'user:busy', payload: { userId, isBusy } }, userId);
  }
}

async function deliverIncomingCall(callId: string) {
  const call = activeCalls.get(callId);
  if (!call) return false;
  if (call.acceptedAt) return false;

  const iceServers = await getICEServers(call.calleeId);

  return connectionManager.sendTo(call.calleeId, {
    type: 'call:incoming',
    payload: {
      callId,
      callerId: call.callerId,
      callerName: connectionManager.get(call.callerId)?.username || 'Unknown',
      callType: call.callType,
      offer: call.offer,
      iceServers,
    },
  });
}

interface SignalingSocket {
  data?: {
    query?: WSQueryMeta;
  };
  send: (data: string) => void;
  close: () => void;
}

function getSocketMeta(ws: SignalingSocket): WSQueryMeta {
  return ws.data?.query ?? {};
}

function parseSocketMessage(rawMessage: unknown): SocketMessage | null {
  if (typeof rawMessage === 'string') {
    const parsed = JSON.parse(rawMessage) as SocketMessage;
    return parsed;
  }
  if (
    typeof rawMessage === 'object' &&
    rawMessage !== null &&
    'type' in rawMessage &&
    'payload' in rawMessage
  ) {
    return rawMessage as SocketMessage;
  }
  return null;
}

export const websocketHandler = new Elysia({ prefix: '/ws' }).ws('/signaling', {
  open(rawWs) {
    const ws = rawWs as unknown as SignalingSocket;
    const { userId, username } = getSocketMeta(ws);

    if (!userId || !username) {
      ws.close();
      return;
    }

    connectionManager.add(userId, username, ws);
    if (isUserInTrackedCall(userId)) {
      connectionManager.setBusy(userId, true);
    }

    connectionManager.broadcast({ type: 'user:online', payload: { userId, username } }, userId);

    for (const [callId, call] of activeCalls) {
      if (call.calleeId === userId && !call.acceptedAt) {
        void deliverIncomingCall(callId);
      }
    }

    console.log(`[WS] ${username} connected. Online: ${connectionManager.getCount()}`);
  },

  async message(rawWs, rawMessage) {
    const ws = rawWs as unknown as SignalingSocket;
    const { userId } = getSocketMeta(ws);
    if (!userId) return;

    void cleanupStaleCalls();

    let message: SocketMessage | null = null;
    try {
      message = parseSocketMessage(rawMessage);
    } catch {
      ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid JSON' } }));
      return;
    }
    if (!message) {
      ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid message shape' } }));
      return;
    }

    const { type, payload } = message;

    switch (type) {
      case 'connection:ping': {
        ws.send(JSON.stringify({ type: 'connection:pong', payload }));
        break;
      }

      case 'user:app-state': {
        const { appState } = payload as unknown as { appState?: 'active' | 'background' };
        if (appState === 'active' || appState === 'background') {
          connectionManager.setAppState(userId, appState);
        }
        break;
      }

      case 'call:initiate': {
        const { calleeId, callType, offer } = payload as unknown as CallInitiatePayload;

        if (!calleeId || calleeId === userId || !callType || !offer) {
          ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid call initiate payload' } }));
          return;
        }

        if (isUserInTrackedCall(userId) || isUserInTrackedCall(calleeId)) {
          ws.send(JSON.stringify({ type: 'call:rejected', payload: { reason: 'busy' } }));
          return;
        }

        // Create call record
        const [call] = await db
          .insert(schema.calls)
          .values({
            callerId: userId,
            calleeId,
            type: callType,
            status: 'ringing',
          })
          .returning();

        if (!call) {
          ws.send(JSON.stringify({ type: 'error', payload: { message: 'Failed to create call' } }));
          return;
        }

        activeCalls.set(call.id, { callerId: userId, calleeId, callType, offer, createdAt: Date.now() });
        updateCallBusyPresence(activeCalls.get(call.id)!);

        const callerIceServers = await getICEServers(userId);

        // Notify callee via WebSocket
        const sent = await deliverIncomingCall(call.id);

        const shouldSendPush = !sent || connectionManager.getAppState(calleeId) !== 'active';
        if (shouldSendPush) {
          const callee = await db.query.users.findFirst({
            where: eq(schema.users.id, calleeId),
          });

          if (callee?.pushToken) {
            await sendCallNotification({
              pushToken: callee.pushToken,
              callerName: connectionManager.get(userId)?.username || 'Unknown',
              callType,
              callId: call.id,
            });
          }
        }

        // Confirm to caller
        ws.send(JSON.stringify({
          type: 'call:initiate',
          payload: { callId: call.id, iceServers: callerIceServers, delivered: sent },
        }));
        break;
      }

      case 'call:accept': {
        const { callId, answer } = payload as unknown as CallResponsePayload;
        const call = activeCalls.get(callId);
        if (!call) return;
        if (call.calleeId !== userId || !answer) return;

        call.acceptedAt = Date.now();

        await db
          .update(schema.calls)
          .set({ status: 'active', startedAt: new Date() })
          .where(eq(schema.calls.id, callId));

        const iceServers = await getICEServers(userId);

        connectionManager.sendTo(call.callerId, {
          type: 'call:accepted',
          payload: { callId, answer, iceServers },
        }, { queueIfOffline: true });
        break;
      }

      case 'call:reject': {
        const { callId } = payload as unknown as { callId: string };
        const call = activeCalls.get(callId);
        if (!call) return;
        if (!userCanAccessCall(userId, call)) return;

        await db
          .update(schema.calls)
          .set({ status: 'rejected', endedAt: new Date() })
          .where(eq(schema.calls.id, callId));

        activeCalls.delete(callId);
        updateCallBusyPresence(call);

        const targetId = getPeerUserId(userId, call);
        if (!targetId) return;

        connectionManager.sendTo(targetId, {
          type: 'call:rejected',
          payload: { callId },
        }, { queueIfOffline: true });
        break;
      }

      case 'call:busy': {
        const { callId } = payload as unknown as { callId: string };
        const call = activeCalls.get(callId);
        if (!call) return;
        if (call.calleeId !== userId) return;

        await db
          .update(schema.calls)
          .set({ status: 'rejected', endedAt: new Date() })
          .where(eq(schema.calls.id, callId));

        activeCalls.delete(callId);
        updateCallBusyPresence(call);

        connectionManager.sendTo(call.callerId, {
          type: 'call:rejected',
          payload: { callId, reason: 'busy' },
        }, { queueIfOffline: true });
        break;
      }

      case 'call:end': {
        const { callId } = payload as unknown as { callId: string };
        const call = activeCalls.get(callId);
        if (!call) return;
        if (!userCanAccessCall(userId, call)) return;

        const callRecord = await db.query.calls.findFirst({
          where: eq(schema.calls.id, callId),
        });

        const duration = callRecord?.startedAt
          ? Math.floor((Date.now() - callRecord.startedAt.getTime()) / 1000)
          : 0;

        await db
          .update(schema.calls)
          .set({ status: 'ended', endedAt: new Date(), duration })
          .where(eq(schema.calls.id, callId));

        activeCalls.delete(callId);
        updateCallBusyPresence(call);

        const otherUserId = getPeerUserId(userId, call);
        if (!otherUserId) return;
        connectionManager.sendTo(otherUserId, {
          type: 'call:ended',
          payload: { callId, duration },
        }, { queueIfOffline: true });
        break;
      }

      case 'webrtc:offer': {
        const { callId, offer: sdpOffer } = payload as unknown as {
          callId: string;
          offer: { type: 'offer' | 'answer'; sdp: string };
        };
        const call = activeCalls.get(callId);
        if (!call) return;
        if (!userCanAccessCall(userId, call)) return;

        const targetId = getPeerUserId(userId, call);
        if (!targetId) return;
        connectionManager.sendTo(targetId, {
          type: 'webrtc:offer',
          payload: { callId, offer: sdpOffer },
        }, { queueIfOffline: true });
        break;
      }

      case 'webrtc:renegotiate': {
        const { callId, offer: sdpOffer } = payload as unknown as {
          callId: string;
          offer: { type: 'offer' | 'answer'; sdp: string };
        };
        const call = activeCalls.get(callId);
        if (!call) return;
        if (!userCanAccessCall(userId, call)) return;

        const targetId = getPeerUserId(userId, call);
        if (!targetId) return;
        connectionManager.sendTo(targetId, {
          type: 'webrtc:renegotiate',
          payload: { callId, offer: sdpOffer },
        }, { queueIfOffline: true });
        break;
      }

      case 'webrtc:answer': {
        const { callId, answer: sdpAnswer } = payload as unknown as {
          callId: string;
          answer: { type: 'offer' | 'answer'; sdp: string };
        };
        const call = activeCalls.get(callId);
        if (!call) return;
        if (!userCanAccessCall(userId, call)) return;

        const targetId = getPeerUserId(userId, call);
        if (!targetId) return;
        connectionManager.sendTo(targetId, {
          type: 'webrtc:answer',
          payload: { callId, answer: sdpAnswer },
        }, { queueIfOffline: true });
        break;
      }

      case 'webrtc:ice-candidate': {
        const { callId, candidate } = payload as unknown as ICECandidatePayload;
        const call = activeCalls.get(callId);
        if (!call) return;
        if (!userCanAccessCall(userId, call)) return;

        const targetId = getPeerUserId(userId, call);
        if (!targetId) return;
        connectionManager.sendTo(targetId, {
          type: 'webrtc:ice-candidate',
          payload: { callId, candidate },
        }, { queueIfOffline: true });
        break;
      }

      case 'media:toggle-audio':
      case 'media:toggle-video':
      case 'media:screen-share': {
        const { callId, enabled } = payload as unknown as { callId: string; enabled: boolean };
        const call = activeCalls.get(callId);
        if (!call) return;
        if (!userCanAccessCall(userId, call)) return;

        const targetId = getPeerUserId(userId, call);
        if (!targetId) return;
        connectionManager.sendTo(targetId, {
          type,
          payload: { callId, userId, enabled },
        }, { queueIfOffline: true });
        break;
      }

      default:
        ws.send(JSON.stringify({ type: 'error', payload: { message: `Unknown event: ${type}` } }));
    }
  },

  close(rawWs) {
    const ws = rawWs as unknown as SignalingSocket;
    const { userId } = getSocketMeta(ws);
    if (!userId) return;

    const removed = connectionManager.remove(userId, ws);
    if (!removed) return;

    connectionManager.broadcast({ type: 'user:offline', payload: { userId } });

    console.log(`[WS] User ${userId} disconnected. Online: ${connectionManager.getCount()}`);
  },
});
