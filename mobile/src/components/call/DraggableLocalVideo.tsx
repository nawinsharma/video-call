import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { RTCView } from 'react-native-webrtc';
import { MediaStream } from 'react-native-webrtc';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const VIDEO_WIDTH = 120;
const VIDEO_HEIGHT = 160;
const PADDING = 16;

interface DraggableLocalVideoProps {
  stream: MediaStream | null;
  isFrontCamera: boolean;
}

export function DraggableLocalVideo({ stream, isFrontCamera }: DraggableLocalVideoProps) {
  const translateX = useSharedValue(SCREEN_WIDTH - VIDEO_WIDTH - PADDING);
  const translateY = useSharedValue(PADDING + 60);
  const contextX = useSharedValue(0);
  const contextY = useSharedValue(0);
  const scale = useSharedValue(1);

  const gesture = Gesture.Pan()
    .onStart(() => {
      contextX.value = translateX.value;
      contextY.value = translateY.value;
      scale.value = withSpring(1.05);
    })
    .onUpdate((event) => {
      translateX.value = contextX.value + event.translationX;
      translateY.value = contextY.value + event.translationY;
    })
    .onEnd(() => {
      scale.value = withSpring(1);

      // Snap to nearest edge
      const snapX =
        translateX.value < SCREEN_WIDTH / 2 - VIDEO_WIDTH / 2
          ? PADDING
          : SCREEN_WIDTH - VIDEO_WIDTH - PADDING;

      translateX.value = withSpring(snapX, { damping: 20 });

      // Clamp Y
      const clampedY = Math.max(
        PADDING,
        Math.min(translateY.value, SCREEN_HEIGHT - VIDEO_HEIGHT - PADDING - 100)
      );
      translateY.value = withSpring(clampedY, { damping: 20 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  if (!stream) return null;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <RTCView
          streamURL={stream.toURL()}
          style={styles.video}
          objectFit="cover"
          mirror={isFrontCamera}
          zOrder={1}
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  video: {
    flex: 1,
  },
});
