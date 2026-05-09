import type { SocketMessage } from '../types';

interface ConnectedClient {
  userId: string;
  username: string;
  ws: {
    send: (data: string) => void;
  };
}

class ConnectionManager {
  private connections = new Map<string, ConnectedClient>();

  add(
    userId: string,
    username: string,
    ws: {
      send: (data: string) => void;
    }
  ) {
    this.connections.set(userId, { userId, username, ws });
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

  sendTo(userId: string, message: SocketMessage): boolean {
    const client = this.connections.get(userId);
    if (!client) return false;

    try {
      client.ws.send(JSON.stringify(message));
      return true;
    } catch {
      this.remove(userId, client.ws);
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
}

export const connectionManager = new ConnectionManager();
