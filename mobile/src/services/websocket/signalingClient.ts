import { WS_URL, RECONNECT_DELAY_MS, MAX_RECONNECT_ATTEMPTS } from '../../constants';
import type { WSMessage, WSEventType } from '../../types';

type MessageHandler = (message: WSMessage) => void;

class SignalingClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private userId: string | null = null;
  private username: string | null = null;
  private isIntentionalClose = false;

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

    const params = new URLSearchParams({
      userId: this.userId,
      username: this.username,
    });
    const url = `${WS_URL}?${params.toString()}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      this.reconnectAttempts = 0;
      this.emit('connection:open', { type: 'connection:open', payload: {} });
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        this.emit(message.type, message);
        this.emit('*', message);
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected');
      this.emit('connection:close', { type: 'connection:close', payload: {} });

      if (!this.isIntentionalClose) {
        this.attemptReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WS] Error:', error);
      this.emit('connection:error', { type: 'connection:error', payload: { error } });
    };
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('[WS] Max reconnect attempts reached');
      this.emit('connection:failed', { type: 'connection:failed', payload: {} });
      return;
    }

    this.reconnectAttempts++;
    const delay = RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.createConnection();
    }, delay);
  }

  send(type: WSEventType, payload: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Cannot send - not connected');
      return false;
    }

    this.ws.send(JSON.stringify({ type, payload }));
    return true;
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

  disconnect() {
    this.isIntentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.userId = null;
    this.username = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const signalingClient = new SignalingClient();
