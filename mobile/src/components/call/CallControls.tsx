import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassmorphicView } from '../ui/GlassmorphicView';
import { AnimatedButton } from '../ui/AnimatedButton';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useAppTheme } from '../../theme/colors';
import type { AudioOutput } from '../../stores/callStore';

interface CallControlsProps {
  isMuted: boolean;
  isCameraOff: boolean;
  audioOutput: AudioOutput;
  isVideoCall: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
  onEndCall: () => void;
  onCycleAudioOutput: () => void;
  onMinimize: () => void;
}

const AUDIO_OUTPUT_ICON: Record<AudioOutput, 'volume-high' | 'volume-mute' | 'bluetooth'> = {
  speaker: 'volume-high',
  earpiece: 'volume-mute',
  bluetooth: 'bluetooth',
};

export function CallControls({
  isMuted,
  isCameraOff,
  audioOutput,
  isVideoCall,
  onToggleMute,
  onToggleCamera,
  onFlipCamera,
  onEndCall,
  onCycleAudioOutput,
  onMinimize,
}: CallControlsProps) {
  const theme = useAppTheme();

  return (
    <Animated.View entering={SlideInDown.springify().damping(18)} exiting={SlideOutDown}>
      <GlassmorphicView
        style={styles.container}
        intensity={50}
        borderRadius={32}
        tint={theme.isDark ? 'dark' : 'light'}
      >
        <View style={styles.controls}>
          <AnimatedButton
            onPress={onToggleMute}
            isActive={isMuted}
            activeColor={theme.colors.danger}
            inactiveColor={theme.colors.elevated}
          >
            <Ionicons
              name={isMuted ? 'mic-off' : 'mic'}
              size={24}
              color={isMuted ? 'white' : theme.colors.text}
            />
          </AnimatedButton>

          {isVideoCall && (
            <AnimatedButton
              onPress={onToggleCamera}
              isActive={isCameraOff}
              activeColor={theme.colors.danger}
              inactiveColor={theme.colors.elevated}
            >
              <Ionicons
                name={isCameraOff ? 'videocam-off' : 'videocam'}
                size={24}
                color={isCameraOff ? 'white' : theme.colors.text}
              />
            </AnimatedButton>
          )}

          {isVideoCall && (
            <AnimatedButton onPress={onFlipCamera} inactiveColor={theme.colors.elevated}>
              <Ionicons name="camera-reverse" size={24} color={theme.colors.text} />
            </AnimatedButton>
          )}

          <AnimatedButton
            onPress={onCycleAudioOutput}
            isActive={audioOutput === 'speaker' || audioOutput === 'bluetooth'}
            activeColor={theme.colors.accent}
            inactiveColor={theme.colors.elevated}
          >
            <Ionicons
              name={AUDIO_OUTPUT_ICON[audioOutput]}
              size={24}
              color={audioOutput !== 'earpiece' ? theme.colors.accent : theme.colors.text}
            />
          </AnimatedButton>

          <AnimatedButton
            onPress={onMinimize}
            inactiveColor={theme.colors.elevated}
          >
            <Ionicons name="chevron-down" size={24} color={theme.colors.text} />
          </AnimatedButton>

          <AnimatedButton
            onPress={onEndCall}
            size={64}
            activeColor={theme.colors.danger}
            isActive={true}
          >
            <Ionicons name="call" size={28} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
          </AnimatedButton>
        </View>
      </GlassmorphicView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 40,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 4,
  },
});
