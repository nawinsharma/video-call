import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useCallStore } from '../../src/stores/callStore';
import { signalingClient } from '../../src/services/websocket/signalingClient';
import type { User } from '../../src/types';
import * as Haptics from 'expo-haptics';
import { useUsersQuery } from '../../src/hooks/queries/useUsersQuery';

export default function HomeScreen() {
  const authStore = useAuthStore();
  const callStore = useCallStore();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: users = [], isRefetching, refetch } = useUsersQuery();

  const handleCall = (user: User, type: 'audio' | 'video') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    callStore.startCall({
      callId: `temp_${Date.now()}`,
      remoteUserId: user.id,
      remoteUsername: user.displayName,
      callType: type,
    });
    router.push('/call/outgoing');
  };

  const handleLogout = async () => {
    signalingClient.disconnect();
    await authStore.logout();
    router.replace('/(auth)/login');
  };

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [users, searchQuery]
  );

  const renderUser = ({ item, index }: { item: User; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.displayName.charAt(0).toUpperCase()}
          </Text>
          {item.isOnline && <View style={styles.onlineIndicator} />}
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.displayName}</Text>
          <Text style={styles.userStatus}>
            {item.isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>

        <View style={styles.callButtons}>
          <Pressable
            style={styles.callButton}
            onPress={() => handleCall(item, 'audio')}
          >
            <Ionicons name="call" size={20} color="#34C759" />
          </Pressable>
          <Pressable
            style={styles.callButton}
            onPress={() => handleCall(item, 'video')}
          >
            <Ionicons name="videocam" size={20} color="#6C63FF" />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <LinearGradient colors={['#0A0A0F', '#1A1A2E']} style={styles.gradient}>
      <Animated.View entering={FadeIn} style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.displayName}>{authStore.user?.displayName}</Text>
          </View>
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="rgba(255,255,255,0.6)" />
          </Pressable>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <Text style={styles.sectionTitle}>Contacts</Text>

        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6C63FF" />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyText}>No contacts found</Text>
            </View>
          }
        />
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingTop: 60 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  displayName: { fontSize: 28, fontWeight: '700', color: 'white', letterSpacing: -0.5 },
  logoutButton: { padding: 8 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 24,
    paddingHorizontal: 16,
    borderRadius: 14,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16, color: 'white' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 12,
  },
  list: { paddingHorizontal: 24, paddingBottom: 40 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(108, 99, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '600', color: '#6C63FF' },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#0A0A0F',
  },
  userInfo: { flex: 1, marginLeft: 14 },
  userName: { fontSize: 16, fontWeight: '600', color: 'white' },
  userStatus: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  callButtons: { flexDirection: 'row', gap: 8 },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 16, color: 'rgba(255,255,255,0.3)' },
});
