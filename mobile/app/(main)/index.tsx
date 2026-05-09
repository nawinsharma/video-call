import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useCallStore } from '../../src/stores/callStore';
import { signalingClient } from '../../src/services/websocket/signalingClient';
import type { User } from '../../src/types';
import * as Haptics from 'expo-haptics';
import {
  useAddContactMutation,
  useUserSearchQuery,
  useUsersQuery,
} from '../../src/hooks/queries/useUsersQuery';
import { AppTheme, useAppTheme } from '../../src/theme/colors';

export default function HomeScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const authStore = useAuthStore();
  const callStore = useCallStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const normalizedSearch = searchQuery.trim();
  const isSearching = normalizedSearch.length >= 2;
  const { data: contacts = [], isRefetching, refetch } = useUsersQuery();
  const { data: searchResults = [], isFetching: isSearchFetching } = useUserSearchQuery(searchQuery);
  const addContactMutation = useAddContactMutation();

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

  const handleAddContact = async (user: User) => {
    setError('');
    try {
      await addContactMutation.mutateAsync(user.id);
      setSearchQuery('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not add contact.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign out?', 'You will stop receiving calls on this device until you sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          signalingClient.disconnect();
          await authStore.logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const visibleUsers = isSearching ? searchResults : contacts;
  const emptyIcon = isSearching ? 'search' : 'person-add';
  const emptyText = isSearching
    ? isSearchFetching
      ? 'Searching...'
      : 'No matching user found'
    : 'Add contacts by searching their email or username';

  const renderUser = ({ item, index }: { item: User; index: number }) => {
    const canCall = !isSearching || item.isContact;

    return (
      <Animated.View entering={FadeInDown.delay(index * 35).springify()}>
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.displayName.charAt(0).toUpperCase()}</Text>
            {item.isOnline && <View style={styles.onlineIndicator} />}
          </View>

          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>{item.displayName}</Text>
            <Text style={styles.userStatus} numberOfLines={1}>
              @{item.username}{item.email ? `  ·  ${item.email}` : ''}
            </Text>
          </View>

          {canCall ? (
            <View style={styles.callButtons}>
              <IconButton
                icon="call"
                color={theme.colors.success}
                onPress={() => handleCall(item, 'audio')}
                styles={styles}
              />
              <IconButton
                icon="videocam"
                color={theme.colors.accent}
                onPress={() => handleCall(item, 'video')}
                styles={styles}
              />
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.addButton, pressed ? styles.pressed : null]}
              onPress={() => void handleAddContact(item)}
              disabled={addContactMutation.isPending}
            >
              {addContactMutation.isPending ? (
                <ActivityIndicator color={theme.colors.accentText} />
              ) : (
                <Ionicons name="person-add" size={20} color={theme.colors.accentText} />
              )}
            </Pressable>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.screen}>
      <Animated.View entering={FadeIn} style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Signed in as</Text>
            <Text style={styles.displayName} numberOfLines={1}>{authStore.user?.displayName}</Text>
          </View>
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color={theme.colors.muted} />
          </Pressable>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.colors.subtle} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search email or username"
            placeholderTextColor={theme.colors.subtle}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            selectionColor={theme.colors.accent}
          />
          {isSearchFetching && <ActivityIndicator color={theme.colors.accent} />}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{isSearching ? 'Search Results' : 'Contacts'}</Text>
          {isSearching ? (
            <Pressable onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <FlatList
          data={visibleUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name={emptyIcon} size={46} color={theme.colors.subtle} />
              <Text style={styles.emptyText}>{emptyText}</Text>
            </View>
          }
        />
      </Animated.View>
    </View>
  );
}

function IconButton({
  icon,
  color,
  onPress,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.callButton, pressed ? styles.pressed : null]} onPress={onPress}>
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    container: { flex: 1, paddingTop: 58, paddingHorizontal: 20 },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
      gap: 16,
    },
    headerText: { flex: 1 },
    greeting: { fontSize: 15, color: theme.colors.muted },
    displayName: { fontSize: 30, fontWeight: '800', color: theme.colors.text },
    logoutButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.input,
      borderRadius: 14,
      paddingHorizontal: 16,
      height: 54,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 10,
    },
    searchInput: { flex: 1, color: theme.colors.text, fontSize: 16 },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
    clearButton: { paddingVertical: 8, paddingHorizontal: 10 },
    clearText: { color: theme.colors.accent, fontWeight: '700' },
    error: { color: theme.colors.danger, marginBottom: 10, textAlign: 'center' },
    list: { paddingBottom: 30, flexGrow: 1 },
    userCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      position: 'relative',
      borderWidth: 1,
      borderColor: theme.colors.accent,
    },
    avatarText: { fontSize: 20, fontWeight: '800', color: theme.colors.accent },
    onlineIndicator: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 13,
      height: 13,
      borderRadius: 7,
      backgroundColor: theme.colors.success,
      borderWidth: 2,
      borderColor: theme.colors.surface,
    },
    userInfo: { flex: 1, minWidth: 0 },
    userName: { fontSize: 17, fontWeight: '800', color: theme.colors.text },
    userStatus: { fontSize: 13, color: theme.colors.muted, marginTop: 3 },
    callButtons: { flexDirection: 'row', gap: 8, marginLeft: 8 },
    callButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    addButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
    pressed: { opacity: 0.72 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
    emptyText: { color: theme.colors.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  });
}
