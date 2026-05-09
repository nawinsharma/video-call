import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { RTCView } from 'react-native-webrtc';
import { useCallStore } from '../../src/stores/callStore';
import { useCall } from '../../src/hooks/useCall';
import { PulsingRing } from '../../src/components/animations/PulsingRing';
import { AnimatedButton } from '../../src/components/ui/AnimatedButton';
import { ringtoneService } from '../../src/services/calls/ringtoneService';
import { AppTheme, useAppTheme } from '../../src/theme/colors';

export default function OutgoingCallScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const callStore = useCallStore();
  const { endCall, initiateCall, localStream } = useCall();
  const hasStartedRef = useRef(false);
  const isVideoCall = callStore.callType === 'video';
  const showLocalPreview = isVideoCall && localStream && !callStore.isCameraOff;

  useEffect(() => {
    if (!callStore.remoteUserId || !callStore.remoteUsername || hasStartedRef.current) return;
    hasStartedRef.current = true;
    void initiateCall(callStore.remoteUserId, callStore.remoteUsername, callStore.callType);
  }, [callStore.remoteUserId, callStore.remoteUsername, callStore.callType, initiateCall]);

  useEffect(() => {
    if (callStore.status === 'outgoing') {
      void ringtoneService.playOutgoing();
    } else {
      void ringtoneService.stop();
    }

    return () => {
      void ringtoneService.stop();
    };
  }, [callStore.status]);

  useEffect(() => {
    if (callStore.status === 'connecting' || callStore.status === 'active' || callStore.status === 'reconnecting') {
      router.replace('/call/active');
    }
    if (callStore.status === 'ended' || callStore.status === 'idle') {
      callStore.reset();
      router.back();
    }
  }, [callStore.status, callStore.reset]);

  const handleCancel = () => {
    void ringtoneService.stop();
    endCall();
  };

  return (
    <View style={styles.screen}>
      <Animated.View entering={FadeIn} style={styles.container}>
        {showLocalPreview ? (
          <>
            <RTCView
              streamURL={localStream.toURL()}
              style={styles.localPreview}
              objectFit="cover"
              mirror={callStore.isFrontCamera}
              zOrder={0}
            />
            <View style={styles.videoScrim} />
          </>
        ) : null}

        <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
          <Text style={styles.callingText}>Calling...</Text>
          <Text style={styles.callType}>{isVideoCall ? 'Video Call' : 'Audio Call'}</Text>
        </Animated.View>

        <View style={styles.avatarSection}>
          <PulsingRing size={140} color="rgba(255, 185, 0, 0.42)" delay={0} />
          <PulsingRing size={140} color="rgba(255, 185, 0, 0.28)" delay={500} />
          <PulsingRing size={140} color="rgba(255, 185, 0, 0.16)" delay={1000} />
          <Animated.View entering={ZoomIn.springify()} style={styles.avatar}>
            <Text style={styles.avatarText}>{callStore.remoteUsername?.charAt(0).toUpperCase() || '?'}</Text>
          </Animated.View>
        </View>

        <Animated.Text entering={FadeInDown.delay(200)} style={styles.remoteName} numberOfLines={1}>
          {callStore.remoteUsername}
        </Animated.Text>

        <Animated.View entering={FadeInDown.delay(400)} style={styles.controls}>
          <AnimatedButton
            onPress={handleCancel}
            size={72}
            activeColor={theme.colors.danger}
            isActive
          >
            <Ionicons name="call" size={32} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
          </AnimatedButton>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 80,
      paddingHorizontal: 24,
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: theme.colors.background,
    },
    localPreview: { ...StyleSheet.absoluteFillObject },
    videoScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.scrim },
    header: { alignItems: 'center', zIndex: 1 },
    callingText: { fontSize: 18, color: theme.colors.text, fontWeight: '800' },
    callType: { fontSize: 14, color: theme.colors.muted, marginTop: 4 },
    avatarSection: { alignItems: 'center', justifyContent: 'center', width: 200, height: 200, zIndex: 1 },
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
    remoteName: { fontSize: 28, fontWeight: '800', color: theme.colors.text, zIndex: 1, maxWidth: 280 },
    controls: { alignItems: 'center', zIndex: 1 },
  });
}
