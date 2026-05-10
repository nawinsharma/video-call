import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
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
  isScreenSharing: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
  onToggleScreenShare: () => void;
  onEndCall: () => void;
  onCycleAudioOutput: () => void;
}

const AUDIO_OUTPUT_ICON: Record<AudioOutput, 'volume-high' | 'phone-portrait' | 'bluetooth'> = {
  speaker: 'volume-high',
  earpiece: 'phone-portrait',
  bluetooth: 'bluetooth',
};

export function CallControls({
  isMuted,
  isCameraOff,
  audioOutput,
  isVideoCall,
  isScreenSharing,
  onToggleMute,
  onToggleCamera,
  onFlipCamera,
  onToggleScreenShare,
  onEndCall,
  onCycleAudioOutput,
}: CallControlsProps) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const isNarrow = width < 370;
  const controlSize = isNarrow ? 42 : 46;
  const endSize = isNarrow ? 54 : 58;
  const iconSize = isNarrow ? 21 : 22;
  const audioActive = audioOutput !== 'earpiece';

  return (
    <Animated.View entering={SlideInDown.springify().damping(18)} exiting={SlideOutDown}>
      <GlassmorphicView
        style={styles.container}
        contentStyle={styles.glassContent}
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
            size={controlSize}
            accessibilityLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            accessibilityState={{ selected: isMuted }}
          >
            <Ionicons
              name={isMuted ? 'mic-off' : 'mic'}
              size={iconSize}
              color={isMuted ? 'white' : theme.colors.text}
            />
          </AnimatedButton>

          {isVideoCall && (
            <AnimatedButton
              onPress={onToggleCamera}
              isActive={isCameraOff}
              activeColor={theme.colors.danger}
              inactiveColor={theme.colors.elevated}
              size={controlSize}
              accessibilityLabel={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
              accessibilityState={{ selected: isCameraOff }}
            >
              <Ionicons
                name={isCameraOff ? 'videocam-off' : 'videocam'}
                size={iconSize}
                color={isCameraOff ? 'white' : theme.colors.text}
              />
            </AnimatedButton>
          )}

          {isVideoCall && (
            <AnimatedButton
              onPress={onFlipCamera}
              inactiveColor={theme.colors.elevated}
              size={controlSize}
              disabled={isScreenSharing}
              accessibilityLabel="Switch camera"
            >
              <Ionicons name="camera-reverse" size={iconSize} color={theme.colors.text} />
            </AnimatedButton>
          )}

          {isVideoCall && (
            <AnimatedButton
              onPress={onToggleScreenShare}
              isActive={isScreenSharing}
              activeColor={theme.colors.accentSoft}
              inactiveColor={theme.colors.elevated}
              size={controlSize}
              style={isScreenSharing ? { borderColor: theme.colors.accent } : undefined}
              accessibilityLabel={isScreenSharing ? 'Stop screen sharing' : 'Share screen'}
              accessibilityState={{ selected: isScreenSharing }}
            >
              <Ionicons
                name={isScreenSharing ? 'stop-circle' : 'desktop-outline'}
                size={iconSize}
                color={isScreenSharing ? theme.colors.accent : theme.colors.text}
              />
            </AnimatedButton>
          )}

          <AnimatedButton
            onPress={onCycleAudioOutput}
            isActive={audioActive}
            activeColor={theme.colors.elevated}
            inactiveColor={theme.colors.elevated}
            size={controlSize}
            style={audioActive ? { borderColor: theme.colors.accent } : undefined}
            accessibilityLabel={
              audioOutput === 'speaker'
                ? 'Audio output speaker'
                : audioOutput === 'bluetooth'
                  ? 'Audio output bluetooth'
                  : 'Audio output earpiece'
            }
            accessibilityState={{ selected: audioActive }}
          >
            <Ionicons
              name={AUDIO_OUTPUT_ICON[audioOutput]}
              size={iconSize}
              color={audioActive ? theme.colors.accent : theme.colors.text}
            />
          </AnimatedButton>

          <AnimatedButton
            onPress={onEndCall}
            size={endSize}
            activeColor={theme.colors.danger}
            isActive={true}
            accessibilityLabel="End call"
          >
            <Ionicons name="call" size={26} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
          </AnimatedButton>
        </View>
      </GlassmorphicView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    marginBottom: 30,
  },
  glassContent: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
});
