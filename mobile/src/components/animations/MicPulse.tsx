import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface MicPulseProps {
  isActive?: boolean;
  color?: string;
  size?: number;
}

export function MicPulse({ isActive = true, color = '#34C759', size = 48 }: MicPulseProps) {
  const scale1 = useSharedValue(1);
  const scale2 = useSharedValue(1);
  const opacity1 = useSharedValue(0.6);
  const opacity2 = useSharedValue(0.3);

  useEffect(() => {
    if (isActive) {
      scale1.value = withRepeat(
        withSequence(
          withTiming(1.4, { duration: 600, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.in(Easing.ease) })
        ),
        -1
      );
      scale2.value = withRepeat(
        withSequence(
          withTiming(1.7, { duration: 800, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.in(Easing.ease) })
        ),
        -1
      );
      opacity1.value = withRepeat(
        withSequence(
          withTiming(0.2, { duration: 600 }),
          withTiming(0.6, { duration: 600 })
        ),
        -1
      );
      opacity2.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 800 }),
          withTiming(0.3, { duration: 800 })
        ),
        -1
      );
    } else {
      scale1.value = withTiming(1);
      scale2.value = withTiming(1);
      opacity1.value = withTiming(0);
      opacity2.value = withTiming(0);
    }
  }, [isActive]);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale1.value }],
    opacity: opacity1.value,
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale2.value }],
    opacity: opacity2.value,
  }));

  return (
    <View style={[styles.container, { width: size * 2, height: size * 2 }]}>
      <Animated.View
        style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: color }, ring2Style]}
      />
      <Animated.View
        style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: color }, ring1Style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
});
