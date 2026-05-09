import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useLoginMutation, useRegisterMutation } from '../../src/hooks/queries/useAuthMutations';

export default function LoginScreen() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const setAuth = useAuthStore((s) => s.setAuth);
  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please fill all fields');
      return;
    }

    setError('');

    try {
      setIsLoading(true);
      let result;
      if (isRegister) {
        result = await registerMutation.mutateAsync({
          username: username.trim(),
          password,
          displayName: displayName.trim() || username.trim(),
        });
      } else {
        result = await loginMutation.mutateAsync({
          username: username.trim(),
          password,
        });
      }

      await setAuth(result.user, result.token);
      router.replace('/(main)');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0A0A0F', '#1A1A2E', '#16213E']} style={styles.gradient}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="videocam" size={48} color="#6C63FF" />
          </View>
          <Text style={styles.title}>VideoCall</Text>
          <Text style={styles.subtitle}>Premium video & audio calls</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.form}>
          {isRegister && (
            <View style={styles.inputContainer}>
              <Ionicons name="person" size={20} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Display Name"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Ionicons name="at" size={20} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.button} onPress={handleSubmit} disabled={isLoading}>
            <LinearGradient
              colors={['#6C63FF', '#4834DF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>{isRegister ? 'Create Account' : 'Sign In'}</Text>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable onPress={() => setIsRegister(!isRegister)} style={styles.switchButton}>
            <Text style={styles.switchText}>
              {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
            </Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  header: { alignItems: 'center', marginBottom: 48 },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: 'rgba(108, 99, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.3)',
  },
  title: { fontSize: 32, fontWeight: '700', color: 'white', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  form: { gap: 16 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: 'white' },
  error: { color: '#FF3B30', fontSize: 14, textAlign: 'center' },
  button: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  buttonGradient: { height: 56, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: 'white', fontSize: 17, fontWeight: '600' },
  switchButton: { alignItems: 'center', paddingVertical: 16 },
  switchText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
});
