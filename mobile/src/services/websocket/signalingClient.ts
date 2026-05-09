import {
  WS_URL,
  RECONNECT_DELAY_MS,
  MAX_RECONNECT_ATTEMPTS,
  SIGNALING_HEARTBEAT_INTERVAL_MS,
  SIGNALING_HEARTBEAT_TIMEOUT_MS,
  SIGNALING_MAX_PENDING_MESSAGES,
} from '../../constants';
import type { WSMessage, WSEventType } from '../../types';

type MessageHandler = (message: WSMessage) => void;
type SendOptions = {
  queueIfDisconnected?: boolean;
};

class SignalingClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private pendingMessages: WSMessage[] = [];
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private userId: string | null = null;
  private username: string | null = null;
  private isIntentionalClose = false;
  private connectionId = 0;

  connect(userId: string, username: string) {
    if (
      this.userId === userId &&
      this.username === username &&
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.userId = userId;
    this.username = username;
    this.isIntentionalClose = false;
    this.createConnection();
  }

  private createConnection() {
    if (!this.userId || !this.username) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const connectionId = ++this.connectionId;
    const params = new URLSearchParams({
      userId: this.userId,
      username: this.username,
    });
    const url = `${WS_URL}?${params.toString()}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      if (connectionId !== this.connectionId) return;
      console.log('[WS] Connected');
      this.reconnectAttempts = 0;
      this.flushPendingMessages();
      this.startHeartbeat();
      this.emit('connection:open', { type: 'connection:open', payload: {} });
    };

    this.ws.onmessage = (event) => {
      if (connectionId !== this.connectionId) return;
      try {
        const message: WSMessage = JSON.parse(event.data);
        if (message.type === 'connection:pong') {
          this.clearHeartbeatTimeout();
        }
        this.emit(message.type, message);
        this.emit('*', message);
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    this.ws.onclose = () => {
      if (connectionId !== this.connectionId) return;
      console.log('[WS] Disconnected');
      this.stopHeartbeat();
      this.emit('connection:close', { type: 'connection:close', payload: {} });

      if (!this.isIntentionalClose) {
        this.attemptReconnect();
      }
    };

    this.ws.onerror = (error) => {
      if (connectionId !== this.connectionId) return;
      console.error('[WS] Error:', error);
      this.emit('connection:error', { type: 'connection:error', payload: { error } });
    };
  }

  private attemptReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('[WS] Max fast reconnect attempts reached; continuing slow retry loop');
      this.emit('connection:failed', { type: 'connection:failed', payload: {} });
    }

    this.reconnectAttempts++;
    const exponent = Math.min(this.reconnectAttempts - 1, MAX_RECONNECT_ATTEMPTS - 1);
    const delay = Math.min(RECONNECT_DELAY_MS * Math.pow(2, exponent), 30000);

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.createConnection();
    }, delay);
  }

  send(type: WSEventType, payload: Record<string, unknown>, options: SendOptions = {}) {
    const message = { type, payload };

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (options.queueIfDisconnected) {
        this.queueMessage(message);
        this.createConnection();
      } else {
        console.warn('[WS] Cannot send - not connected:', type);
      }
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.warn('[WS] Send failed:', type, error);
      if (options.queueIfDisconnected) {
        this.queueMessage(message);
      }
      this.forceReconnect();
      return false;
    }
  }

  waitUntilConnected(timeoutMs = 7000): Promise<boolean> {
    if (this.isConnected) return Promise.resolve(true);
    if (!this.userId || !this.username) return Promise.resolve(false);

    this.createConnection();

    return new Promise((resolve) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout>;
      let offOpen = () => {};
      let offFailed = () => {};
      let offClose = () => {};

      const finish = (connected: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        offOpen();
        offFailed();
        offClose();
        resolve(connected);
      };

      timeout = setTimeout(() => finish(this.isConnected), timeoutMs);
      offOpen = this.on('connection:open', () => finish(true));
      offFailed = this.on('connection:failed', () => finish(false));
      offClose = this.on('connection:close', () => {
        if (this.isIntentionalClose) finish(false);
      });
    });
  }

  on(event: string, handler: MessageHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: MessageHandler) {
    this.handlers.get(event)?.delete(handler);
  }

  private emit(event: string, message: WSMessage) {
    this.handlers.get(event)?.forEach((handler) => handler(message));
  }

  private queueMessage(message: WSMessage) {
    this.pendingMessages.push(message);
    if (this.pendingMessages.length > SIGNALING_MAX_PENDING_MESSAGES) {
      this.pendingMessages.shift();
    }
  }

  private flushPendingMessages() {
    if (!this.isConnected || this.pendingMessages.length === 0) return;

    const messages = [...this.pendingMessages];
    this.pendingMessages = [];

    for (const message of messages) {
      this.send(message.type, message.payload, { queueIfDisconnected: true });
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.isConnected) return;
      this.send('connection:ping', { ts: Date.now() });
      this.clearHeartbeatTimeout();
      this.heartbeatTimeoutTimer = setTimeout(() => {
        console.warn('[WS] Heartbeat timed out; reconnecting');
        this.forceReconnect();
      }, SIGNALING_HEARTBEAT_TIMEOUT_MS);
    }, SIGNALING_HEARTBEAT_INTERVAL_MS);
  }

  private clearHeartbeatTimeout() {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.clearHeartbeatTimeout();
  }

  reconnect() {
    if (!this.userId || !this.username) return;
    this.isIntentionalClose = false;
    this.createConnection();
  }

  forceReconnect() {
    if (!this.userId || !this.username || this.isIntentionalClose) return;
    const socket = this.ws;
    this.ws = null;
    this.connectionId++;
    this.stopHeartbeat();
    try {
      socket?.close();
    } catch {
      /* ignore */
    }
    this.attemptReconnect();
  }

  disconnect() {
    this.isIntentionalClose = true;
    this.connectionId++;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
    this.userId = null;
    this.username = null;
    this.pendingMessages = [];
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const signalingClient = new SignalingClient();
