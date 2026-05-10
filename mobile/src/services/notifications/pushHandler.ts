import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { signalingClient } from '../websocket/signalingClient';
import { useCallStore } from '../../stores/callStore';

// Pending notification data stored when the app opens from a background notification.
// The actual call data will arrive via WebSocket; we use this to know we should route
// to the incoming screen once the call:incoming event is received.
let pendingCallNotification: {
  callId: string;
  callerName: string;
  callType: string;
} | null = null;

export function getPendingCallNotification() {
  return pendingCallNotification;
}

export function clearPendingCallNotification() {
  pendingCallNotification = null;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return;

  // High-importance call channel — shows heads-up notification, plays ringtone,
  // and (with USE_FULL_SCREEN_INTENT permission) launches a full-screen activity.
  await Notifications.setNotificationChannelAsync('incoming-calls', {
    name: 'Incoming Calls',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400],
    lightColor: '#FFB900',
    sound: 'incoming.mp3',
    enableVibrate: true,
    showBadge: false,
    bypassDnd: true,
  });

  await Notifications.setNotificationChannelAsync('calls', {
    name: 'Call Alerts',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'incoming.mp3',
  });
}

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Set up channels before requesting permission so the system is ready.
    await ensureAndroidChannels();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn('[Push] Missing Expo projectId, skipping push registration');
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch {
    return null;
  }
}

export function setupNotificationListeners() {
  // Check if the app was launched from a notification (killed state).
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (!response) return;
    handleNotificationTap(response.notification.request.content.data);
  });

  // Fired when the user taps a notification while the app is in background/foreground.
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    handleNotificationTap(response.notification.request.content.data);
  });

  // When a notification arrives while the app is in the FOREGROUND, the WebSocket
  // should already be connected and the call:incoming WS event arrives before or at
  // the same time, so we don't need to do anything extra here.
  const receivedListener = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data;
    if (data?.type === 'incoming_call' && AppState.currentState !== 'active') {
      storePendingCall(data);
    }
  });

  return () => {
    responseListener.remove();
    receivedListener.remove();
  };
}

function storePendingCall(data: Record<string, unknown>) {
  if (typeof data.callId !== 'string') return;
  pendingCallNotification = {
    callId: data.callId as string,
    callerName: (data.callerName as string) || 'Unknown',
    callType: (data.callType as string) || 'audio',
  };
}

const PENDING_CALL_TIMEOUT_MS = 15000;

function handleNotificationTap(data: Record<string, unknown>) {
  if (data?.type !== 'incoming_call') return;

  storePendingCall(data);

  const callStore = useCallStore.getState();

  if (callStore.status === 'incoming') {
    // Call already delivered via WebSocket — go straight to the screen.
    router.replace('/call/incoming');
    return;
  }

  // The app just opened from a killed/background state. The WebSocket will reconnect
  // and the server will re-deliver the call:incoming event via the open handler.
  // Route to incoming screen immediately — the call store will be populated shortly.
  router.replace('/call/incoming');

  if (!pendingCallNotification) return;

  // Poll for the WS to reconnect and deliver call data. If it never arrives
  // (call was missed/cancelled), clear the pending state so the incoming screen
  // can navigate back to the main app.
  let attempts = 0;
  const startedAt = Date.now();
  const check = setInterval(() => {
    attempts++;
    const state = useCallStore.getState();

    if (state.status === 'incoming' || state.status !== 'idle') {
      clearInterval(check);
      return;
    }

    if (Date.now() - startedAt >= PENDING_CALL_TIMEOUT_MS) {
      clearInterval(check);
      pendingCallNotification = null;
      // Force a navigation refresh so the incoming screen re-evaluates and exits.
      if (useCallStore.getState().status === 'idle') {
        router.replace('/(main)');
      }
      return;
    }

    // If signaling isn't connected, nudge it. If it is, just wait — the server
    // re-delivers call:incoming on (re)connect via the open handler.
    if (!signalingClient.isConnected) {
      signalingClient.reconnect();
    }
  }, 500);
}
