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
  SocketMessage,
  WSEventType,
  WSQueryMeta,
} from '../types';

const activeCalls = new Map<string, { callerId: string; calleeId: string; callType: 'audio' | 'video' }>();

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

    connectionManager.broadcast({ type: 'user:online', payload: { userId, username } }, userId);

    console.log(`[WS] ${username} connected. Online: ${connectionManager.getCount()}`);
  },

  async message(rawWs, rawMessage) {
    const ws = rawWs as unknown as SignalingSocket;
    const { userId } = getSocketMeta(ws);
    if (!userId) return;

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
      case 'call:initiate': {
        const { calleeId, callType, offer } = payload as unknown as CallInitiatePayload;

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

        activeCalls.set(call.id, { callerId: userId, calleeId, callType });

        const iceServers = getICEServers(userId);

        // Notify callee via WebSocket
        const sent = connectionManager.sendTo(calleeId, {
          type: 'call:incoming',
          payload: {
            callId: call.id,
            callerId: userId,
            callerName: connectionManager.get(userId)?.username || 'Unknown',
            callType,
            offer,
            iceServers,
          },
        });

        // If callee is offline, send push notification
        if (!sent) {
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
          payload: { callId: call.id, iceServers },
        }));
        break;
      }

      case 'call:accept': {
        const { callId, answer } = payload as unknown as CallResponsePayload;
        const call = activeCalls.get(callId);
        if (!call) return;

        await db
          .update(schema.calls)
          .set({ status: 'active', startedAt: new Date() })
          .where(eq(schema.calls.id, callId));

        const iceServers = getICEServers(userId);

        connectionManager.sendTo(call.callerId, {
          type: 'call:accepted',
          payload: { callId, answer, iceServers },
        });
        break;
      }

      case 'call:reject': {
        const { callId } = payload as unknown as { callId: string };
        const call = activeCalls.get(callId);
        if (!call) return;

        await db
          .update(schema.calls)
          .set({ status: 'rejected', endedAt: new Date() })
          .where(eq(schema.calls.id, callId));

        activeCalls.delete(callId);

        connectionManager.sendTo(call.callerId, {
          type: 'call:rejected',
          payload: { callId },
        });
        break;
      }

      case 'call:end': {
        const { callId } = payload as unknown as { callId: string };
        const call = activeCalls.get(callId);
        if (!call) return;

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

        const otherUserId = call.callerId === userId ? call.calleeId : call.callerId;
        connectionManager.sendTo(otherUserId, {
          type: 'call:ended',
          payload: { callId, duration },
        });
        break;
      }

      case 'webrtc:offer': {
        const { callId, offer: sdpOffer } = payload as unknown as {
          callId: string;
          offer: { type: 'offer' | 'answer'; sdp: string };
        };
        const call = activeCalls.get(callId);
        if (!call) return;

        const targetId = call.callerId === userId ? call.calleeId : call.callerId;
        connectionManager.sendTo(targetId, {
          type: 'webrtc:offer',
          payload: { callId, offer: sdpOffer },
        });
        break;
      }

      case 'webrtc:answer': {
        const { callId, answer: sdpAnswer } = payload as unknown as {
          callId: string;
          answer: { type: 'offer' | 'answer'; sdp: string };
        };
        const call = activeCalls.get(callId);
        if (!call) return;

        const targetId = call.callerId === userId ? call.calleeId : call.callerId;
        connectionManager.sendTo(targetId, {
          type: 'webrtc:answer',
          payload: { callId, answer: sdpAnswer },
        });
        break;
      }

      case 'webrtc:ice-candidate': {
        const { callId, candidate } = payload as unknown as ICECandidatePayload;
        const call = activeCalls.get(callId);
        if (!call) return;

        const targetId = call.callerId === userId ? call.calleeId : call.callerId;
        connectionManager.sendTo(targetId, {
          type: 'webrtc:ice-candidate',
          payload: { callId, candidate },
        });
        break;
      }

      case 'media:toggle-audio':
      case 'media:toggle-video': {
        const { callId, enabled } = payload as unknown as { callId: string; enabled: boolean };
        const call = activeCalls.get(callId);
        if (!call) return;

        const targetId = call.callerId === userId ? call.calleeId : call.callerId;
        connectionManager.sendTo(targetId, {
          type,
          payload: { callId, userId, enabled },
        });
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

    connectionManager.remove(userId);
    connectionManager.broadcast({ type: 'user:offline', payload: { userId } });

    console.log(`[WS] User ${userId} disconnected. Online: ${connectionManager.getCount()}`);
  },
});
