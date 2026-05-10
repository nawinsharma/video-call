import React, { useEffect } from 'react';
import { AppState } from 'react-native';
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
import { MinimizedCallWidget } from './call/MinimizedCallWidget';
import { pictureInPicture } from '../services/native/pictureInPicture';

export function AppBootstrap() {
  const { isAuthenticated } = useAuthStore();
  const callStatus = useCallStore((state) => state.status);
  const callType = useCallStore((state) => state.callType);
  const isMinimized = useCallStore((state) => state.isMinimized);
  const segments = useSegments();
  const canUseCallPip =
    isAuthenticated &&
    callType === 'video' &&
    (callStatus === 'active' || callStatus === 'connecting' || callStatus === 'reconnecting');

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
    pictureInPicture.setCallActive(canUseCallPip);
    return () => pictureInPicture.setCallActive(false);
  }, [canUseCallPip]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'background' || !canUseCallPip) return;
      void pictureInPicture.enterPictureInPicture();
    });

    return () => subscription.remove();
  }, [canUseCallPip]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const currentRoute = `/${segments.join('/')}`;

    if (callStatus === 'incoming' && currentRoute !== '/call/incoming') {
      router.replace('/call/incoming');
      return;
    }

    // Do NOT force-redirect to the active call screen while minimized —
    // the user explicitly moved the call to the background.
    if (!isMinimized) {
      if (
        (callStatus === 'connecting' || callStatus === 'active' || callStatus === 'reconnecting') &&
        currentRoute !== '/call/active'
      ) {
        router.replace('/call/active');
      }
    }
  }, [callStatus, isAuthenticated, isMinimized, segments]);

  return null;
}

/**
 * Renders the floating mini call widget on top of the screen stack.
 * Mount this AFTER <Stack> in the root layout so it overlays all screens.
 */
export function MinimizedCallOverlay() {
  const callStatus = useCallStore((state) => state.status);
  const isMinimized = useCallStore((state) => state.isMinimized);
  const callId = useCallStore((state) => state.callId);
  const reset = useCallStore((state) => state.reset);
  const segments = useSegments();

  // If the call ends and we're NOT on the active call screen (e.g. user minimized
  // it and is on /(main) when the remote hangs up), the active screen's reset
  // effect never runs. Clean up here so stale call data doesn't linger.
  useEffect(() => {
    const route = `/${segments.join('/')}`;
    const onCallScreen = route === '/call/active' || route === '/call/incoming';
    if (onCallScreen) return;
    if (callStatus !== 'ended') return;
    if (!callId) return;

    const t = setTimeout(() => reset(), 1000);
    return () => clearTimeout(t);
  }, [callStatus, callId, segments, reset]);

  const showWidget =
    isMinimized &&
    (callStatus === 'active' || callStatus === 'connecting' || callStatus === 'reconnecting');

  return showWidget ? <MinimizedCallWidget /> : null;
}
