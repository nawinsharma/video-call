import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { RTCView } from 'react-native-webrtc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallStore } from '../../stores/callStore';
import { useCall } from '../../hooks/useCall';
import { AppTheme, useAppTheme } from '../../theme/colors';
import { CallTimer } from './CallTimer';

const VIDEO_WIDTH = 132;
const VIDEO_HEIGHT = 184;
const AUDIO_WIDTH = 252;
const AUDIO_HEIGHT = 74;
const EDGE_PADDING = 12;

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

export function MinimizedCallWidget() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const callStore = useCallStore();
  const { localStream, remoteStream, endCall } = useCall();

  const isVideoCall = callStore.callType === 'video';
  const widgetWidth = isVideoCall ? VIDEO_WIDTH : Math.min(AUDIO_WIDTH, width - EDGE_PADDING * 2);
  const widgetHeight = isVideoCall ? VIDEO_HEIGHT : AUDIO_HEIGHT;
  const minX = EDGE_PADDING;
  const maxX = Math.max(EDGE_PADDING, width - widgetWidth - EDGE_PADDING);
  const minY = insets.top + EDGE_PADDING;
  const maxY = Math.max(minY, height - widgetHeight - insets.bottom - EDGE_PADDING);

  const translateX = useSharedValue(maxX);
  const translateY = useSharedValue(minY);
  const startX = useSharedValue(maxX);
  const startY = useSharedValue(minY);

  const canShowRemoteVideo = isVideoCall && Boolean(remoteStream) && callStore.remoteVideoEnabled;
  const canShowLocalVideo =
    isVideoCall && Boolean(localStream) && (!callStore.isCameraOff || callStore.isScreenSharing);
  const displayStream = canShowRemoteVideo ? remoteStream : canShowLocalVideo ? localStream : null;
  const isShowingLocal = Boolean(displayStream) && !canShowRemoteVideo && canShowLocalVideo;
  const isScreenSharing = isShowingLocal ? callStore.isScreenSharing : callStore.remoteScreenSharing;

  useEffect(() => {
    translateX.value = withTiming(clamp(translateX.value, minX, maxX), { duration: 180 });
    translateY.value = withTiming(clamp(translateY.value, minY, maxY), { duration: 180 });
  }, [maxX, maxY, minX, minY, translateX, translateY]);

  const gesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = clamp(startX.value + event.translationX, minX, maxX);
      translateY.value = clamp(startY.value + event.translationY, minY, maxY);
    })
    .onEnd(() => {
      const snapX = translateX.value < width / 2 - widgetWidth / 2 ? minX : maxX;
      translateX.value = withSpring(snapX, { damping: 20 });
      translateY.value = withSpring(clamp(translateY.value, minY, maxY), { damping: 20 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    left: translateX.value,
    top: translateY.value,
    width: widgetWidth,
    height: widgetHeight,
  }));

  const handleMaximize = () => {
    callStore.maximize();
    router.replace('/call/active');
  };

  const handleEnd = () => {
    endCall();
  };

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        {isVideoCall ? (
          <Pressable
            onPress={handleMaximize}
            style={({ pressed }) => [styles.videoCard, pressed ? styles.pressed : null]}
            accessibilityRole="button"
            accessibilityLabel="Return to call"
          >
            {displayStream ? (
              <RTCView
                streamURL={displayStream.toURL()}
                style={styles.video}
                objectFit={isScreenSharing ? 'contain' : 'cover'}
                mirror={isShowingLocal && callStore.isFrontCamera && !isScreenSharing}
                zOrder={0}
                iosPIP={{
                  enabled: true,
                  startAutomatically: true,
                  stopAutomatically: true,
                  preferredSize: { width: 9, height: 16 },
                }}
              />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderInitial}>
                  {(callStore.remoteUsername?.charAt(0) || '?').toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.videoTopBar}>
              <Text style={styles.videoName} numberOfLines={1}>
                {isScreenSharing
                  ? isShowingLocal
                    ? 'Your screen'
                    : `${callStore.remoteUsername || 'Contact'}'s screen`
                  : callStore.remoteUsername}
              </Text>
              <CallTimer duration={callStore.duration} status={callStore.status} compact />
            </View>

            <View style={styles.videoActions}>
              <MiniButton
                icon="expand"
                label="Return to call"
                onPress={handleMaximize}
                color={theme.colors.text}
                backgroundColor={theme.colors.overlay}
              />
              <MiniButton
                icon="call"
                label="End call"
                onPress={handleEnd}
                color="#ffffff"
                backgroundColor={theme.colors.danger}
                rotate
              />
            </View>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleMaximize}
            style={({ pressed }) => [styles.audioCard, pressed ? styles.pressed : null]}
            accessibilityRole="button"
            accessibilityLabel="Return to call"
          >
            <View style={[styles.dot, { backgroundColor: theme.colors.success }]} />
            <View style={styles.audioInfo}>
              <Text style={styles.audioName} numberOfLines={1}>
                {callStore.remoteUsername}
              </Text>
              <CallTimer duration={callStore.duration} status={callStore.status} compact />
            </View>
            <MiniButton
              icon="chevron-up"
              label="Return to call"
              onPress={handleMaximize}
              color={theme.colors.text}
              backgroundColor={theme.colors.surface}
            />
            <MiniButton
              icon="call"
              label="End call"
              onPress={handleEnd}
              color="#ffffff"
              backgroundColor={theme.colors.danger}
              rotate
            />
          </Pressable>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

function MiniButton({
  icon,
  label,
  onPress,
  color,
  backgroundColor,
  rotate = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color: string;
  backgroundColor: string;
  rotate?: boolean;
}) {
  return (
    <Pressable
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={({ pressed }) => [
        stylesStatic.miniButton,
        { backgroundColor },
        pressed ? stylesStatic.pressed : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons
        name={icon}
        size={18}
        color={color}
        style={rotate ? stylesStatic.rotatedIcon : undefined}
      />
    </Pressable>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      position: 'absolute',
      zIndex: 999,
      borderRadius: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 18,
    },
    videoCard: {
      flex: 1,
      overflow: 'hidden',
      borderRadius: 20,
      backgroundColor: '#000',
      borderWidth: 2,
      borderColor: theme.colors.accent,
    },
    video: {
      flex: 1,
      backgroundColor: '#000',
    },
    placeholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    placeholderInitial: {
      color: theme.colors.accent,
      fontSize: 36,
      fontWeight: '800',
    },
    videoTopBar: {
      position: 'absolute',
      top: 8,
      left: 8,
      right: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: theme.colors.overlay,
    },
    videoName: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    videoActions: {
      position: 'absolute',
      left: 8,
      right: 8,
      bottom: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    audioCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 22,
      paddingHorizontal: 12,
      backgroundColor: theme.colors.elevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    audioInfo: {
      flex: 1,
      minWidth: 0,
    },
    audioName: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    pressed: {
      opacity: 0.86,
    },
  });
}

const stylesStatic = StyleSheet.create({
  miniButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  pressed: {
    opacity: 0.75,
  },
  rotatedIcon: {
    transform: [{ rotate: '135deg' }],
  },
});
