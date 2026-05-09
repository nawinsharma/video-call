import { useEffect } from 'react';
import { router, useSegments } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { useCallStore } from '../stores/callStore';
import { useSignaling } from '../hooks/useSignaling';
import { useCallEvents } from '../hooks/useCall';
import {
  registerForPushNotifications,
  setupNotificationListeners,
} from '../services/notifications/pushHandler';
import { authService } from '../services/auth/authService';

export function AppBootstrap() {
  const { isAuthenticated } = useAuthStore();
  const callStatus = useCallStore((state) => state.status);
  const segments = useSegments();

  useSignaling();
  useCallEvents();

  useEffect(() => {
    const cleanup = setupNotificationListeners();
    return cleanup;
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    let isCancelled = false;

    const syncPushToken = async () => {
      const token = await registerForPushNotifications();
      if (!token || isCancelled) return;

      try {
        await authService.updatePushToken(token);
      } catch (error) {
        console.warn('[Push] Failed to sync push token:', error);
      }
    };

    void syncPushToken();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const currentRoute = `/${segments.join('/')}`;

    if (callStatus === 'incoming' && currentRoute !== '/call/incoming') {
      router.replace('/call/incoming');
      return;
    }

    if (callStatus === 'active' && currentRoute !== '/call/active') {
      router.replace('/call/active');
    }
  }, [callStatus, isAuthenticated, segments]);

  return null;
}
