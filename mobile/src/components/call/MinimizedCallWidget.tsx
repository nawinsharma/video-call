import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallStore } from '../../stores/callStore';
import { useCall } from '../../hooks/useCall';
import { useAppTheme } from '../../theme/colors';
import { CallTimer } from './CallTimer';

export function MinimizedCallWidget() {
  const theme = useAppTheme();
  const callStore = useCallStore();
  const { endCall } = useCall();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulseAnim]);

  const handleMaximize = () => {
    callStore.maximize();
    router.replace('/call/active');
  };

  const handleEnd = () => {
    endCall();
  };

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.colors.elevated, transform: [{ scale: pulseAnim }] }]}>
      <Pressable style={styles.main} onPress={handleMaximize}>
        <View style={[styles.dot, { backgroundColor: theme.colors.success }]} />
        <View style={styles.info}>
          <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
            {callStore.remoteUsername}
          </Text>
          <CallTimer duration={callStore.duration} status={callStore.status} compact />
        </View>
        <Ionicons name="chevron-up" size={18} color={theme.colors.muted} style={styles.expandIcon} />
      </Pressable>
      <Pressable style={[styles.endBtn, { backgroundColor: theme.colors.danger }]} onPress={handleEnd}>
        <Ionicons name="call" size={18} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 16,
    zIndex: 999,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '800',
  },
  expandIcon: {
    marginRight: 6,
  },
  endBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
