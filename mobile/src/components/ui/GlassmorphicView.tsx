import React from 'react';
import { View, StyleSheet, StyleProp, ViewProps, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface GlassmorphicViewProps extends ViewProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  borderRadius?: number;
  contentStyle?: StyleProp<ViewStyle>;
}

export function GlassmorphicView({
  children,
  intensity = 40,
  tint = 'dark',
  borderRadius = 24,
  contentStyle,
  style,
  ...props
}: GlassmorphicViewProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={[styles.container, { borderRadius }, style]}
      {...props}
    >
      <BlurView intensity={intensity} tint={tint} style={[styles.blur, { borderRadius }]}>
        <View
          style={[
            styles.overlay,
            { borderRadius },
            tint === 'light' ? styles.lightOverlay : styles.darkOverlay,
            contentStyle,
          ]}
        >
          {children}
        </View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  blur: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    padding: 16,
  },
  darkOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  lightOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
  },
});
