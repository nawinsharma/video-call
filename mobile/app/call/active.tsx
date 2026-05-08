import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { RTCView } from 'react-native-webrtc';
import { Ionicons } from '@expo/vector-icons';
import { useCallStore } from '../../src/stores/callStore';
import { useCall } from '../../src/hooks/useCall';
import { CallControls } from '../../src/components/call/CallControls';
import { DraggableLocalVideo } from '../../src/components/call/DraggableLocalVideo';
import { CallTimer } from '../../src/components/call/CallTimer';
import { ActiveSpeakerGlow } from '../../src/components/call/ActiveSpeakerGlow';
import { MicPulse } from '../../src/components/animations/MicPulse';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ActiveCallScreen() {
  const callStore = useCallStore();
  const {
    localStream,
    remoteStream,
    endCall,
    toggleMute,
    toggleCamera,
    flipCamera,
  } = useCall();

  const [showControls, setShowControls] = useState(true);
  const controlsOpacity = useSharedValue(1);

  useEffect(() => {
    if (callStore.status === 'ended' || callStore.status === 'idle') {
      setTimeout(() => {
        callStore.reset();
        router.replace('/(main)');
      }, 1000);
    }
  }, [callStore.status]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (showControls && callStore.status === 'active') {
      timeout = setTimeout(() => {
        setShowControls(false);
        controlsOpacity.value = withTiming(0, { duration: 300 });
      }, 5000);
    }
    return () => clearTimeout(timeout);
  }, [showControls, callStore.status]);

  const handleScreenTap = () => {
    setShowControls(true);
    controlsOpacity.value = withTiming(1, { duration: 200 });
  };

  const controlsStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  const isVideoCall = callStore.callType === 'video';
  const isActive = callStore.status === 'active';

  return (
    <Pressable style={styles.container} onPress={handleScreenTap}>
      {/* Remote Video / Audio Background */}
      {isVideoCall && remoteStream ? (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.remoteVideo}
          objectFit="cover"
          zOrder={0}
        />
      ) : (
        <LinearGradient
          colors={['#0A0A0F', '#1A1A2E', '#16213E', '#0F3460']}
          style={styles.audioBackground}
        >
          <View style={styles.audioCallCenter}>
            <ActiveSpeakerGlow isActive={isActive && !callStore.isMuted} size={140} />
            <MicPulse isActive={isActive && !callStore.isMuted} size={140} />
            <View style={styles.audioAvatar}>
              <Text style={styles.audioAvatarText}>
                {callStore.remoteUsername?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          </View>
        </LinearGradient>
      )}

      {/* Top Overlay - Name + Timer */}
      <Animated.View style={[styles.topOverlay, controlsStyle]}>
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'transparent']}
          style={styles.topGradient}
        >
          <View style={styles.topInfo}>
            <Text style={styles.remoteName}>{callStore.remoteUsername}</Text>
            <CallTimer duration={callStore.duration} status={callStore.status} />
          </View>

          {callStore.status === 'reconnecting' && (
            <Animated.View entering={FadeIn} style={styles.reconnectBanner}>
              <Ionicons name="wifi" size={16} color="#FF9500" />
              <Text style={styles.reconnectText}>Reconnecting...</Text>
            </Animated.View>
          )}
        </LinearGradient>
      </Animated.View>

      {/* Local Video (Draggable PiP) */}
      {isVideoCall && localStream && (
        <DraggableLocalVideo stream={localStream} isFrontCamera={callStore.isFrontCamera} />
      )}

      {/* Bottom Controls */}
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
          onToggleSpeaker={() => {}}
        />
      </Animated.View>

      {/* Call Ended Overlay */}
      {callStore.status === 'ended' && (
        <Animated.View entering={FadeIn} style={styles.endedOverlay}>
          <Ionicons name="call" size={48} color="rgba(255,59,48,0.8)" style={{ transform: [{ rotate: '135deg' }] }} />
          <Text style={styles.endedText}>Call Ended</Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  remoteVideo: { flex: 1, width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  audioBackground: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  audioCallCenter: { alignItems: 'center', justifyContent: 'center' },
  audioAvatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(108, 99, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(108, 99, 255, 0.4)',
  },
  audioAvatarText: { fontSize: 56, fontWeight: '700', color: 'white' },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topGradient: { paddingTop: 60, paddingBottom: 40, paddingHorizontal: 24 },
  topInfo: { alignItems: 'center' },
  remoteName: { fontSize: 22, fontWeight: '700', color: 'white', letterSpacing: -0.3 },
  reconnectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 149, 0, 0.2)',
    borderRadius: 20,
    alignSelf: 'center',
  },
  reconnectText: { color: '#FF9500', fontSize: 13, fontWeight: '500' },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  endedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    zIndex: 100,
  },
  endedText: { fontSize: 24, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
});
