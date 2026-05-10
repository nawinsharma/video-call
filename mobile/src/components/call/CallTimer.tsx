import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAppTheme } from '../../theme/colors';

interface CallTimerProps {
  duration: number;
  status: string;
  compact?: boolean;
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function CallTimer({ duration, status, compact = false }: CallTimerProps) {
  const theme = useAppTheme();
  const getStatusText = () => {
    switch (status) {
      case 'outgoing':
        return 'Calling...';
      case 'incoming':
        return 'Incoming call';
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'active':
        return formatDuration(duration);
      case 'ended':
        return 'Call ended';
      default:
        return '';
    }
  };

  if (compact) {
    return (
      <Text style={[styles.timerCompact, { color: theme.colors.success }]}>
        {getStatusText()}
      </Text>
    );
  }

  return (
    <Animated.View entering={FadeIn} style={styles.container}>
      <Text style={styles.timer}>{getStatusText()}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 8,
  },
  timer: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.92)',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  timerCompact: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
