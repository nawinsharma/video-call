import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AnimatedButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  activeColor?: string;
  inactiveColor?: string;
  isActive?: boolean;
  size?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityState?: { disabled?: boolean; selected?: boolean; checked?: boolean };
}

export function AnimatedButton({
  onPress,
  children,
  style,
  activeColor = 'rgba(255, 59, 48, 1)',
  inactiveColor = 'rgba(255, 255, 255, 0.15)',
  isActive = false,
  size = 56,
  disabled = false,
  accessibilityLabel,
  accessibilityState,
}: AnimatedButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: isActive ? activeColor : inactiveColor,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, ...accessibilityState }}
      style={[
        styles.button,
        disabled ? styles.disabled : null,
        { width: size, height: size, borderRadius: size / 2 },
        animatedStyle,
        style,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  disabled: {
    opacity: 0.45,
  },
});
