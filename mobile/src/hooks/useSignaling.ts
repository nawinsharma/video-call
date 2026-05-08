import { useEffect, useRef, useCallback } from 'react';
import { signalingClient } from '../services/websocket/signalingClient';
import { useAuthStore } from '../stores/authStore';
import type { WSEventType } from '../types';

export function useSignaling() {
  const { user } = useAuthStore();
  const isConnected = useRef(false);

  useEffect(() => {
    if (user && !isConnected.current) {
      signalingClient.connect(user.id, user.username);
      isConnected.current = true;
    }

    return () => {
      if (isConnected.current) {
        signalingClient.disconnect();
        isConnected.current = false;
      }
    };
  }, [user]);

  const sendMessage = useCallback((type: WSEventType, payload: Record<string, unknown>) => {
    return signalingClient.send(type, payload);
  }, []);

  return {
    isConnected: signalingClient.isConnected,
    sendMessage,
  };
}
