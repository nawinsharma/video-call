import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useCallStore } from '../../src/stores/callStore';
import { useCall } from '../../src/hooks/useCall';
import { PulsingRing } from '../../src/components/animations/PulsingRing';
import { AnimatedButton } from '../../src/components/ui/AnimatedButton';

export default function IncomingCallScreen() {
  const callStore = useCallStore();
  const { acceptCall, rejectCall } = useCall();

  useEffect(() => {
    if (callStore.status === 'active' || callStore.status === 'connecting') {
      router.replace('/call/active');
    }
    if (callStore.status === 'ended' || callStore.status === 'idle') {
      router.back();
    }
  }, [callStore.status]);

  const handleAccept = () => {
    acceptCall();
  };

  const handleReject = () => {
    rejectCall();
    router.back();
  };

  return (
    <LinearGradient colors={['#0F3460', '#16213E', '#1A1A2E']} style={styles.gradient}>
      <Animated.View entering={FadeIn} style={styles.container}>
        <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
          <Text style={styles.incomingText}>Incoming Call</Text>
          <Text style={styles.callType}>
            {callStore.callType === 'video' ? 'Video Call' : 'Audio Call'}
          </Text>
        </Animated.View>

        <View style={styles.avatarSection}>
          <PulsingRing size={140} color="rgba(52, 199, 89, 0.4)" delay={0} />
          <PulsingRing size={140} color="rgba(52, 199, 89, 0.3)" delay={600} />
          <PulsingRing size={140} color="rgba(52, 199, 89, 0.2)" delay={1200} />
          <Animated.View entering={ZoomIn.springify()} style={styles.avatar}>
            <Text style={styles.avatarText}>
              {callStore.remoteUsername?.charAt(0).toUpperCase() || '?'}
            </Text>
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
              activeColor="rgba(255, 59, 48, 1)"
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
              activeColor="rgba(52, 199, 89, 1)"
              isActive
            >
              <Ionicons name="call" size={32} color="white" />
            </AnimatedButton>
            <Text style={styles.controlLabel}>Accept</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 80 },
  header: { alignItems: 'center' },
  incomingText: { fontSize: 18, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  callType: { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  avatarSection: { alignItems: 'center', justifyContent: 'center', width: 200, height: 200 },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(52, 199, 89, 0.5)',
  },
  avatarText: { fontSize: 48, fontWeight: '700', color: 'white' },
  remoteName: { fontSize: 28, fontWeight: '700', color: 'white', letterSpacing: -0.5 },
  controls: { flexDirection: 'row', gap: 80, alignItems: 'center' },
  controlItem: { alignItems: 'center', gap: 12 },
  controlLabel: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
});
