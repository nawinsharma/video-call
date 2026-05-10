import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { signalingClient } from '../services/websocket/signalingClient';
import { useAuthStore } from '../stores/authStore';
import { WS_EVENTS } from '../constants';
import type { User, WSEventType } from '../types';

function patchCachedUsers(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  patch: Partial<User>
) {
  queryClient.setQueriesData<User[]>({ queryKey: ['contacts'] }, (users) =>
    users?.map((user) => (user.id === userId ? { ...user, ...patch } : user))
  );
  queryClient.setQueriesData<User[]>({ queryKey: ['users', 'search'] }, (users) =>
    users?.map((user) => (user.id === userId ? { ...user, ...patch } : user))
  );
}

export function useSignaling() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const isConnected = useRef(false);
  const userId = user?.id;
  const username = user?.username;

  const publishAppState = useCallback(() => {
    signalingClient.send(
      WS_EVENTS.USER_APP_STATE,
      { appState: AppState.currentState === 'active' ? 'active' : 'background' },
      { queueIfDisconnected: true }
    );
  }, []);

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
    if (!userId || !username) return;

    const offOpen = signalingClient.on('connection:open', () => publishAppState());
    const offOnline = signalingClient.on(WS_EVENTS.USER_ONLINE, (msg) => {
      const incomingUserId = msg.payload.userId;
      if (typeof incomingUserId === 'string') {
        patchCachedUsers(queryClient, incomingUserId, { isOnline: true });
      }
    });
    const offOffline = signalingClient.on(WS_EVENTS.USER_OFFLINE, (msg) => {
      const incomingUserId = msg.payload.userId;
      if (typeof incomingUserId === 'string') {
        patchCachedUsers(queryClient, incomingUserId, { isOnline: false, isBusy: false });
      }
    });
    const offBusy = signalingClient.on(WS_EVENTS.USER_BUSY, (msg) => {
      const incomingUserId = msg.payload.userId;
      const isBusy = msg.payload.isBusy;
      if (typeof incomingUserId === 'string' && typeof isBusy === 'boolean') {
        patchCachedUsers(queryClient, incomingUserId, { isBusy });
      }
    });

    return () => {
      offOpen();
      offOnline();
      offOffline();
      offBusy();
    };
  }, [publishAppState, queryClient, userId, username]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (!userId || !username) return;

      if (state === 'active') {
        signalingClient.connect(userId, username);
        void signalingClient.waitUntilConnected(3000).then(() => publishAppState());
      } else {
        publishAppState();
      }
    });

    return () => subscription.remove();
  }, [publishAppState, userId, username]);

  const sendMessage = useCallback((type: WSEventType, payload: Record<string, unknown>) => {
    return signalingClient.send(type, payload);
  }, []);

  return {
    isConnected: signalingClient.isConnected,
    sendMessage,
  };
}
