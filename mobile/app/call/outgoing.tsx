import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { RTCView } from 'react-native-webrtc';
import { useCallStore } from '../../src/stores/callStore';
import { useCall } from '../../src/hooks/useCall';
import { PulsingRing } from '../../src/components/animations/PulsingRing';
import { AnimatedButton } from '../../src/components/ui/AnimatedButton';
import { ringtoneService } from '../../src/services/calls/ringtoneService';

export default function OutgoingCallScreen() {
  const callStore = useCallStore();
  const { endCall, initiateCall, localStream } = useCall();
  const hasStartedRef = useRef(false);
  const isVideoCall = callStore.callType === 'video';
  const showLocalPreview = isVideoCall && localStream;

  useEffect(() => {
    if (!callStore.remoteUserId || !callStore.remoteUsername || hasStartedRef.current) return;
    hasStartedRef.current = true;
    void initiateCall(callStore.remoteUserId, callStore.remoteUsername, callStore.callType);
    // Outgoing screen mounts once per call with store already populated from HomeScreen.
  }, []);

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
  }, [callStore.status]);

  const handleCancel = () => {
    void ringtoneService.stop();
    endCall();
  };

  return (
    <LinearGradient colors={['#1A1A2E', '#16213E', '#0F3460']} style={styles.gradient}>
      <Animated.View entering={FadeIn} style={styles.container}>
        {showLocalPreview && (
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
        )}

        <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
          <Text style={styles.callingText}>Calling...</Text>
          <Text style={styles.callType}>
            {callStore.callType === 'video' ? 'Video Call' : 'Audio Call'}
          </Text>
        </Animated.View>

        <View style={styles.avatarSection}>
          <PulsingRing size={140} color="rgba(108, 99, 255, 0.4)" delay={0} />
          <PulsingRing size={140} color="rgba(108, 99, 255, 0.3)" delay={500} />
          <PulsingRing size={140} color="rgba(108, 99, 255, 0.2)" delay={1000} />
          <Animated.View entering={ZoomIn.springify()} style={styles.avatar}>
            <Text style={styles.avatarText}>
              {callStore.remoteUsername?.charAt(0).toUpperCase() || '?'}
            </Text>
          </Animated.View>
        </View>

        <Animated.Text entering={FadeInDown.delay(200)} style={styles.remoteName}>
          {callStore.remoteUsername}
        </Animated.Text>

        <Animated.View entering={FadeInDown.delay(400)} style={styles.controls}>
          <AnimatedButton
            onPress={handleCancel}
            size={72}
            activeColor="rgba(255, 59, 48, 1)"
            isActive
          >
            <Ionicons name="call" size={32} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
          </AnimatedButton>
        </Animated.View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 80,
    position: 'relative',
    overflow: 'hidden',
  },
  localPreview: { ...StyleSheet.absoluteFillObject },
  videoScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  header: { alignItems: 'center', zIndex: 1 },
  callingText: { fontSize: 18, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  callType: { fontSize: 14, color: 'rgba(255,255,255,0.3)', marginTop: 4 },
  avatarSection: { alignItems: 'center', justifyContent: 'center', width: 200, height: 200, zIndex: 1 },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(108, 99, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(108, 99, 255, 0.5)',
  },
  avatarText: { fontSize: 48, fontWeight: '700', color: 'white' },
  remoteName: { fontSize: 28, fontWeight: '700', color: 'white', letterSpacing: -0.5, zIndex: 1 },
  controls: { alignItems: 'center', zIndex: 1 },
});
