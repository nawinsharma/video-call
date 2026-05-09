import type { SocketMessage } from '../types';

interface ConnectedClient {
  userId: string;
  username: string;
  ws: {
    send: (data: string) => void;
  };
}

interface QueuedMessage {
  message: SocketMessage;
  expiresAt: number;
}

const PENDING_MESSAGE_TTL_MS = 2 * 60 * 1000;
const MAX_PENDING_MESSAGES_PER_USER = 100;

class ConnectionManager {
  private connections = new Map<string, ConnectedClient>();
  private pendingMessages = new Map<string, QueuedMessage[]>();

  add(
    userId: string,
    username: string,
    ws: {
      send: (data: string) => void;
    }
  ) {
    this.connections.set(userId, { userId, username, ws });
    this.flushPending(userId);
  }

  remove(
    userId: string,
    ws?: {
      send: (data: string) => void;
    }
  ): boolean {
    const client = this.connections.get(userId);
    if (!client) return false;
    if (ws && client.ws !== ws) return false;

    this.connections.delete(userId);
    return true;
  }

  get(userId: string): ConnectedClient | undefined {
    return this.connections.get(userId);
  }

  isOnline(userId: string): boolean {
    return this.connections.has(userId);
  }

  sendTo(userId: string, message: SocketMessage, options: { queueIfOffline?: boolean } = {}): boolean {
    const client = this.connections.get(userId);
    if (!client) {
      if (options.queueIfOffline) this.queueFor(userId, message);
      return false;
    }

    try {
      client.ws.send(JSON.stringify(message));
      return true;
    } catch {
      this.remove(userId, client.ws);
      if (options.queueIfOffline) this.queueFor(userId, message);
      return false;
    }
  }

  broadcast(message: SocketMessage, excludeUserId?: string) {
    for (const [userId, client] of this.connections) {
      if (userId === excludeUserId) continue;
      try {
        client.ws.send(JSON.stringify(message));
      } catch {
        this.remove(userId, client.ws);
      }
    }
  }

  getOnlineUsers(): string[] {
    return Array.from(this.connections.keys());
  }

  getCount(): number {
    return this.connections.size;
  }

  private queueFor(userId: string, message: SocketMessage) {
    const now = Date.now();
    const queue = (this.pendingMessages.get(userId) ?? []).filter((entry) => entry.expiresAt > now);
    queue.push({ message, expiresAt: now + PENDING_MESSAGE_TTL_MS });
    if (queue.length > MAX_PENDING_MESSAGES_PER_USER) {
      queue.splice(0, queue.length - MAX_PENDING_MESSAGES_PER_USER);
    }
    this.pendingMessages.set(userId, queue);
  }

  private flushPending(userId: string) {
    const queue = this.pendingMessages.get(userId);
    if (!queue?.length) return;

    this.pendingMessages.delete(userId);
    const now = Date.now();

    for (const entry of queue) {
      if (entry.expiresAt <= now) continue;
      this.sendTo(userId, entry.message);
    }
  }
}

export const connectionManager = new ConnectionManager();
