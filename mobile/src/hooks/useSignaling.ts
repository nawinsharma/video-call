import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
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

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !userId || !username) return;

      signalingClient.connect(userId, username);
      void signalingClient.waitUntilConnected(3000);
    });

    return () => subscription.remove();
  }, [userId, username]);

  const sendMessage = useCallback((type: WSEventType, payload: Record<string, unknown>) => {
    return signalingClient.send(type, payload);
  }, []);

  return {
    isConnected: signalingClient.isConnected,
    sendMessage,
  };
}
