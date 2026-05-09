import { useEffect, useRef, useCallback } from 'react';
import { signalingClient } from '../services/websocket/signalingClient';
import { useAuthStore } from '../stores/authStore';
import type { WSEventType } from '../types';

export function useSignaling() {
  const user = useAuthStore((state) => state.user);
  const isConnected = useRef(false);
  const userId = user?.id;
  const username = user?.username;

  useEffect(() => {
    if (userId && username && !isConnected.current) {
      signalingClient.connect(userId, username);
      isConnected.current = true;
    }

    return () => {
      if (isConnected.current) {
        signalingClient.disconnect();
        isConnected.current = false;
      }
    };
  }, [userId, username]);

  const sendMessage = useCallback((type: WSEventType, payload: Record<string, unknown>) => {
    return signalingClient.send(type, payload);
  }, []);

  return {
    isConnected: signalingClient.isConnected,
    sendMessage,
  };
}
