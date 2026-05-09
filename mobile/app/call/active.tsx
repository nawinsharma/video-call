import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { RTCView } from 'react-native-webrtc';
import type { MediaStream } from 'react-native-webrtc';
import { Ionicons } from '@expo/vector-icons';
import { useCallStore } from '../../src/stores/callStore';
import { useCall } from '../../src/hooks/useCall';
import { CallControls } from '../../src/components/call/CallControls';
import { CallTimer } from '../../src/components/call/CallTimer';
import { ActiveSpeakerGlow } from '../../src/components/call/ActiveSpeakerGlow';
import { MicPulse } from '../../src/components/animations/MicPulse';
import { AppTheme, useAppTheme } from '../../src/theme/colors';

type VideoOwner = 'remote' | 'local';

export default function ActiveCallScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const callStore = useCallStore();
  const {
    localStream,
    remoteStream,
    endCall,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    flipCamera,
  } = useCall();

  const [showControls, setShowControls] = useState(true);
  const [primaryVideo, setPrimaryVideo] = useState<VideoOwner>('remote');
  const controlsOpacity = useSharedValue(1);

  const isVideoCall = callStore.callType === 'video';
  const isActive = callStore.status === 'active';
  const canShowLocalVideo = isVideoCall && Boolean(localStream) && !callStore.isCameraOff;
  const canShowRemoteVideo = isVideoCall && Boolean(remoteStream) && callStore.remoteVideoEnabled;
  const secondaryVideo: VideoOwner = primaryVideo === 'remote' ? 'local' : 'remote';

  useEffect(() => {
    if (callStore.status === 'ended' || callStore.status === 'idle') {
      setTimeout(() => {
        callStore.reset();
        router.replace('/(main)');
      }, 1000);
    }
  }, [callStore.status, callStore.reset]);

  useEffect(() => {
    if (primaryVideo === 'local' && !canShowLocalVideo) {
      setPrimaryVideo('remote');
    }
  }, [canShowLocalVideo, primaryVideo]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (showControls && callStore.status === 'active') {
      timeout = setTimeout(() => {
        setShowControls(false);
        controlsOpacity.value = withTiming(0, { duration: 300 });
      }, 5000);
    }
    return () => clearTimeout(timeout);
  }, [showControls, callStore.status, controlsOpacity]);

  const handleScreenTap = () => {
    setShowControls(true);
    controlsOpacity.value = withTiming(1, { duration: 200 });
  };

  const handleSwapVideo = (owner: VideoOwner) => {
    setPrimaryVideo(owner);
    handleScreenTap();
  };

  const controlsStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  return (
    <Pressable style={styles.container} onPress={handleScreenTap}>
      {isVideoCall ? (
        <View style={styles.videoStage}>
          <VideoSurface
            owner={primaryVideo}
            stream={primaryVideo === 'remote' ? remoteStream : localStream}
            visible={primaryVideo === 'remote' ? canShowRemoteVideo : canShowLocalVideo}
            isFrontCamera={primaryVideo === 'local' && callStore.isFrontCamera}
            username={primaryVideo === 'remote' ? callStore.remoteUsername : 'You'}
            muted={!callStore.remoteAudioEnabled && primaryVideo === 'remote'}
            cameraOff={
              primaryVideo === 'remote'
                ? !callStore.remoteVideoEnabled
                : callStore.isCameraOff
            }
            styles={styles}
            theme={theme}
            zOrder={0}
          />

          {secondaryVideo === 'local' && canShowLocalVideo ? (
            <Pressable
              style={styles.pip}
              onPress={() => handleSwapVideo('local')}
            >
              <View style={styles.pipInner}>
                <VideoSurface
                  owner="local"
                  stream={localStream}
                  visible={canShowLocalVideo}
                  isFrontCamera={callStore.isFrontCamera}
                  username="You"
                  muted={callStore.isMuted}
                  cameraOff={callStore.isCameraOff}
                  styles={styles}
                  theme={theme}
                  zOrder={1}
                  compact
                />
              </View>
            </Pressable>
          ) : null}

          {secondaryVideo === 'remote' ? (
            <Pressable
              style={styles.pip}
              onPress={() => handleSwapVideo('remote')}
            >
              <View style={styles.pipInner}>
                <VideoSurface
                  owner="remote"
                  stream={remoteStream}
                  visible={canShowRemoteVideo}
                  isFrontCamera={false}
                  username={callStore.remoteUsername}
                  muted={!callStore.remoteAudioEnabled}
                  cameraOff={!callStore.remoteVideoEnabled}
                  styles={styles}
                  theme={theme}
                  zOrder={1}
                  compact
                />
              </View>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <AudioCallView
          isActive={isActive}
          username={callStore.remoteUsername}
          isMuted={callStore.isMuted}
          theme={theme}
          styles={styles}
        />
      )}

      <Animated.View style={[styles.topOverlay, controlsStyle]}>
        <View style={styles.topGradient}>
          <View style={styles.topInfo}>
            <Text style={styles.remoteName} numberOfLines={1}>
              {callStore.remoteUsername}
            </Text>
            <CallTimer duration={callStore.duration} status={callStore.status} />
          </View>

          {callStore.status === 'reconnecting' && (
            <Animated.View entering={FadeIn} style={styles.reconnectBanner}>
              <Ionicons name="wifi" size={16} color={theme.colors.accent} />
              <Text style={styles.reconnectText}>Reconnecting...</Text>
            </Animated.View>
          )}
        </View>
      </Animated.View>

      <Animated.View style={[styles.bottomOverlay, controlsStyle]}>
        <CallControls
          isMuted={callStore.isMuted}
          isCameraOff={callStore.isCameraOff}
          isSpeakerOn={callStore.isSpeakerOn}
          isVideoCall={isVideoCall}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onFlipCamera={flipCamera}
          onEndCall={endCall}
          onToggleSpeaker={toggleSpeaker}
        />
      </Animated.View>

      {callStore.status === 'ended' && (
        <Animated.View entering={FadeIn} style={styles.endedOverlay}>
          <Ionicons name="call" size={48} color={theme.colors.danger} style={{ transform: [{ rotate: '135deg' }] }} />
          <Text style={styles.endedText}>Call Ended</Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

function VideoSurface({
  owner,
  stream,
  visible,
  isFrontCamera,
  username,
  muted,
  cameraOff,
  styles,
  theme,
  zOrder,
  compact = false,
}: {
  owner: VideoOwner;
  stream: MediaStream | null;
  visible: boolean;
  isFrontCamera: boolean;
  username: string | null;
  muted: boolean;
  cameraOff: boolean;
  styles: ReturnType<typeof createStyles>;
  theme: AppTheme;
  zOrder: number;
  compact?: boolean;
}) {
  if (visible && stream) {
    return (
      <View style={[styles.surface, compact && styles.surfacePip]}>
        <RTCView
          streamURL={stream.toURL()}
          style={styles.video}
          objectFit="cover"
          mirror={isFrontCamera}
          zOrder={zOrder}
        />
        <View style={compact ? styles.compactBadge : styles.videoBadge}>
          <Ionicons
            name={muted ? 'mic-off' : owner === 'local' ? 'person' : 'person-circle'}
            size={compact ? 13 : 15}
            color={theme.colors.accent}
          />
          <Text style={compact ? styles.compactBadgeText : styles.videoBadgeText} numberOfLines={1}>
            {owner === 'local' ? 'You' : username}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.surface, styles.videoPlaceholder, compact && styles.surfacePip]}>
      <View style={compact ? styles.compactAvatar : styles.avatar}>
        <Text style={compact ? styles.compactAvatarText : styles.avatarText}>
          {(owner === 'local' ? 'Y' : username?.charAt(0) || '?').toUpperCase()}
        </Text>
      </View>
      {!compact ? (
        <Text style={styles.placeholderText}>
          {cameraOff ? 'Camera off' : 'Connecting video...'}
        </Text>
      ) : null}
    </View>
  );
}

function AudioCallView({
  isActive,
  username,
  isMuted,
  theme,
  styles,
}: {
  isActive: boolean;
  username: string | null;
  isMuted: boolean;
  theme: AppTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.audioBackground}>
      <View style={styles.audioCallCenter}>
        <ActiveSpeakerGlow isActive={isActive && !isMuted} size={140} color={theme.colors.accent} />
        <MicPulse isActive={isActive && !isMuted} size={140} color={theme.colors.accent} />
        <View style={styles.audioAvatar}>
          <Text style={styles.audioAvatarText}>
            {username?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    videoStage: { flex: 1, backgroundColor: '#000' },
    surface: { flex: 1, overflow: 'hidden', backgroundColor: theme.colors.background },
    surfacePip: { backgroundColor: '#000' },
    video: { flex: 1 },
    videoPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
    },
    // Single ring: border lives on inner clip so it is not doubled with video/surface edges.
    pip: {
      position: 'absolute',
      top: 74,
      right: 16,
      width: 118,
      height: 164,
      borderRadius: 18,
      backgroundColor: 'transparent',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      elevation: 12,
      zIndex: 20,
    },
    pipInner: {
      flex: 1,
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: theme.colors.accent,
      backgroundColor: '#000',
    },
    avatar: {
      width: 136,
      height: 136,
      borderRadius: 68,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.accent,
    },
    avatarText: { fontSize: 54, fontWeight: '800', color: theme.colors.accent },
    compactAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.accent,
    },
    compactAvatarText: { fontSize: 22, fontWeight: '800', color: theme.colors.accent },
    placeholderText: {
      marginTop: 14,
      fontSize: 16,
      color: theme.colors.muted,
      fontWeight: '700',
    },
    videoBadge: {
      position: 'absolute',
      left: 18,
      bottom: 128,
      maxWidth: 220,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 18,
      backgroundColor: theme.colors.overlay,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    videoBadgeText: { color: theme.colors.text, fontSize: 13, fontWeight: '800', flexShrink: 1 },
    compactBadge: {
      position: 'absolute',
      left: 8,
      right: 8,
      bottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: theme.colors.overlay,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    compactBadgeText: { color: theme.colors.text, fontSize: 11, fontWeight: '800', flexShrink: 1 },
    audioBackground: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
    },
    audioCallCenter: { alignItems: 'center', justifyContent: 'center' },
    audioAvatar: {
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: theme.colors.accent,
    },
    audioAvatarText: { fontSize: 56, fontWeight: '800', color: theme.colors.accent },
    topOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
    },
    topGradient: {
      paddingTop: 58,
      paddingBottom: 12,
      paddingHorizontal: 24,
      backgroundColor: 'transparent',
    },
    topInfo: { alignItems: 'center' },
    remoteName: {
      fontSize: 22,
      fontWeight: '800',
      color: '#ffffff',
      maxWidth: 260,
      textShadowColor: 'rgba(0, 0, 0, 0.55)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 6,
    },
    reconnectBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 12,
      paddingVertical: 6,
      paddingHorizontal: 14,
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 20,
      alignSelf: 'center',
      borderWidth: 1,
      borderColor: theme.colors.accent,
    },
    reconnectText: { color: theme.colors.accent, fontSize: 13, fontWeight: '800' },
    bottomOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 10,
    },
    endedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      zIndex: 100,
    },
    endedText: { fontSize: 24, fontWeight: '800', color: theme.colors.text },
  });
}
