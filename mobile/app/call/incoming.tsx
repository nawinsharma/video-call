import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useCallStore } from '../../src/stores/callStore';
import { useCall } from '../../src/hooks/useCall';
import { PulsingRing } from '../../src/components/animations/PulsingRing';
import { AnimatedButton } from '../../src/components/ui/AnimatedButton';
import { ringtoneService } from '../../src/services/calls/ringtoneService';
import { AppTheme, useAppTheme } from '../../src/theme/colors';
import { getPendingCallNotification } from '../../src/services/notifications/pushHandler';

export default function IncomingCallScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const callStore = useCallStore();
  const { acceptCall, rejectCall } = useCall();

  // When the app opens from a push notification, the callStore might still be empty
  // (status === 'idle') while we wait for the WebSocket to deliver call:incoming.
  // Show a loading state during that window instead of immediately going back.
  const isWaitingForCallData = callStore.status === 'idle' && getPendingCallNotification() !== null;

  useEffect(() => {
    if (callStore.status === 'incoming') {
      void ringtoneService.playIncoming();
    } else {
      void ringtoneService.stop();
    }

    if (callStore.status === 'active' || callStore.status === 'connecting') {
      router.replace('/call/active');
      return;
    }

    // Only navigate away when idle if we are NOT waiting for call data from the push.
    if (callStore.status === 'ended' || (callStore.status === 'idle' && !isWaitingForCallData)) {
      callStore.reset();
      router.back();
    }

    return () => {
      void ringtoneService.stop();
    };
  }, [callStore.status, isWaitingForCallData]);

  const handleAccept = () => {
    void ringtoneService.stop();
    acceptCall();
  };

  const handleReject = () => {
    void ringtoneService.stop();
    rejectCall();
  };

  if (isWaitingForCallData) {
    const pending = getPendingCallNotification();
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center', gap: 20 }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={{ color: theme.colors.muted, fontSize: 15, fontWeight: '600' }}>
          {pending?.callerName ? `${pending.callerName} is calling…` : 'Connecting…'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Animated.View entering={FadeIn} style={styles.container}>
        <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
          <Text style={styles.incomingText}>Incoming Call</Text>
          <Text style={styles.callType}>{callStore.callType === 'video' ? 'Video Call' : 'Audio Call'}</Text>
        </Animated.View>

        <View style={styles.avatarSection}>
          <PulsingRing size={140} color="rgba(255, 185, 0, 0.42)" delay={0} />
          <PulsingRing size={140} color="rgba(255, 185, 0, 0.28)" delay={600} />
          <PulsingRing size={140} color="rgba(255, 185, 0, 0.16)" delay={1200} />
          <Animated.View entering={ZoomIn.springify()} style={styles.avatar}>
            <Text style={styles.avatarText}>{callStore.remoteUsername?.charAt(0).toUpperCase() || '?'}</Text>
          </Animated.View>
        </View>

        <Animated.Text entering={FadeInDown.delay(200)} style={styles.remoteName}>
          {callStore.remoteUsername}
        </Animated.Text>

        <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.controls}>
          <View style={styles.controlItem}>
            <AnimatedButton
              onPress={handleReject}
              size={72}
              activeColor={theme.colors.danger}
              isActive
            >
              <Ionicons name="call" size={32} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
            </AnimatedButton>
            <Text style={styles.controlLabel}>Decline</Text>
          </View>

          <View style={styles.controlItem}>
            <AnimatedButton
              onPress={handleAccept}
              size={72}
              activeColor={theme.colors.success}
              isActive
            >
              <Ionicons name="call" size={32} color="white" />
            </AnimatedButton>
            <Text style={styles.controlLabel}>Accept</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    container: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 80 },
    header: { alignItems: 'center' },
    incomingText: { fontSize: 18, color: theme.colors.text, fontWeight: '800' },
    callType: { fontSize: 14, color: theme.colors.muted, marginTop: 4 },
    avatarSection: { alignItems: 'center', justifyContent: 'center', width: 200, height: 200 },
    avatar: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: theme.colors.accent,
    },
    avatarText: { fontSize: 48, fontWeight: '800', color: theme.colors.accent },
    remoteName: { fontSize: 28, fontWeight: '800', color: theme.colors.text },
    controls: { flexDirection: 'row', gap: 80, alignItems: 'center' },
    controlItem: { alignItems: 'center', gap: 12 },
    controlLabel: { fontSize: 14, color: theme.colors.muted, fontWeight: '700' },
  });
}
