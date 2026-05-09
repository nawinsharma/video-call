import React, { useMemo, useState } from 'react';
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
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import {
  useLoginMutation,
  useRegisterMutation,
  useSendRegistrationOtpMutation,
} from '../../src/hooks/queries/useAuthMutations';
import { AppTheme, useAppTheme } from '../../src/theme/colors';

type AuthMode = 'login' | 'register';
type RegisterStep = 'details' | 'otp';

export default function LoginScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [mode, setMode] = useState<AuthMode>('login');
  const [registerStep, setRegisterStep] = useState<RegisterStep>('details');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  const setAuth = useAuthStore((s) => s.setAuth);
  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();
  const sendOtpMutation = useSendRegistrationOtpMutation();
  const isLoading = loginMutation.isPending || registerMutation.isPending || sendOtpMutation.isPending;

  const resetFormMessage = () => setError('');

  const switchMode = () => {
    resetFormMessage();
    setMode((current) => (current === 'login' ? 'register' : 'login'));
    setRegisterStep('details');
    setOtp('');
  };

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      setError('Enter your email or username and password.');
      return;
    }

    setError('');
    try {
      const result = await loginMutation.mutateAsync({
        identifier: identifier.trim(),
        password,
      });
      await setAuth(result.user, result.token);
      router.replace('/(main)');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
    }
  };

  const handleSendOtp = async () => {
    if (!displayName.trim() || !username.trim() || !email.trim() || !password.trim()) {
      setError('Fill in your name, username, email, and password.');
      return;
    }

    if (!email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }

    setError('');
    try {
      await sendOtpMutation.mutateAsync({
        username: username.trim(),
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      });
      setRegisterStep('otp');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not send verification code.');
    }
  };

  const handleRegister = async () => {
    if (!otp.trim()) {
      setError('Enter the verification code from your email.');
      return;
    }

    setError('');
    try {
      const result = await registerMutation.mutateAsync({
        username: username.trim(),
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        otp: otp.trim(),
      });
      await setAuth(result.user, result.token);
      router.replace('/(main)');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not create your account.');
    }
  };

  const handleSubmit = () => {
    if (mode === 'login') {
      void handleLogin();
      return;
    }

    if (registerStep === 'details') {
      void handleSendOtp();
      return;
    }

    void handleRegister();
  };

  const primaryLabel =
    mode === 'login' ? 'Sign In' : registerStep === 'details' ? 'Send Code' : 'Verify & Create Account';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.screen}
    >
      <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="videocam" size={42} color={theme.colors.accent} />
        </View>
        <Text style={styles.title}>VideoCall</Text>
        <Text style={styles.subtitle}>
          {mode === 'login' ? 'Sign in with email or username' : 'Verify your email to get started'}
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.form}>
        {mode === 'register' && registerStep === 'details' && (
          <>
            <LabeledInput
              label="Display name"
              icon="person"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Nawin"
              autoCapitalize="words"
              theme={theme}
            />
            <LabeledInput
              label="Username"
              icon="at"
              value={username}
              onChangeText={setUsername}
              placeholder="nawin"
              autoCapitalize="none"
              autoCorrect={false}
              theme={theme}
            />
            <LabeledInput
              label="Email"
              icon="mail"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              theme={theme}
            />
          </>
        )}

        {mode === 'register' && registerStep === 'otp' && (
          <>
            <View style={styles.notice}>
              <Ionicons name="mail-unread" size={18} color={theme.colors.accent} />
              <Text style={styles.noticeText}>Code sent to {email.trim()}</Text>
            </View>
            <LabeledInput
              label="Verification code"
              icon="keypad"
              value={otp}
              onChangeText={setOtp}
              placeholder="123456"
              keyboardType="number-pad"
              autoCapitalize="none"
              theme={theme}
            />
          </>
        )}

        {mode === 'login' && (
          <LabeledInput
            label="Email or username"
            icon="person-circle"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="you@example.com or username"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            theme={theme}
          />
        )}

        {(mode === 'login' || registerStep === 'details') && (
          <LabeledInput
            label="Password"
            icon="lock-closed"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            textContentType={mode === 'login' ? 'password' : 'newPassword'}
            theme={theme}
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && !isLoading ? styles.buttonPressed : null,
            isLoading ? styles.buttonDisabled : null,
          ]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={theme.colors.accentText} />
          ) : (
            <Text style={styles.buttonText}>{primaryLabel}</Text>
          )}
        </Pressable>

        {mode === 'register' && registerStep === 'otp' && (
          <Pressable onPress={() => setRegisterStep('details')} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Change registration details</Text>
          </Pressable>
        )}

        <Pressable onPress={switchMode} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>
            {mode === 'register' ? 'Already have an account? Sign in' : "Don't have an account? Register"}
          </Text>
        </Pressable>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

type LabeledInputProps = React.ComponentProps<typeof TextInput> & {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme: AppTheme;
};

function LabeledInput({ label, icon, theme, style, ...props }: LabeledInputProps) {
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <Ionicons name={icon} size={20} color={theme.colors.subtle} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={theme.colors.subtle}
          selectionColor={theme.colors.accent}
          {...props}
        />
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 28,
      backgroundColor: theme.colors.background,
    },
    header: { alignItems: 'center', marginBottom: 38 },
    iconContainer: {
      width: 88,
      height: 88,
      borderRadius: 24,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.accent,
    },
    title: { fontSize: 32, fontWeight: '800', color: theme.colors.text },
    subtitle: { fontSize: 15, color: theme.colors.muted, marginTop: 6, textAlign: 'center' },
    form: { gap: 14 },
    field: { gap: 8 },
    label: { fontSize: 13, color: theme.colors.muted, fontWeight: '600' },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.input,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 14,
      minHeight: 54,
    },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, fontSize: 16, color: theme.colors.text, paddingVertical: 12 },
    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.colors.accent,
    },
    noticeText: { color: theme.colors.text, fontSize: 13, flex: 1 },
    error: { color: theme.colors.danger, fontSize: 14, textAlign: 'center' },
    button: {
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      marginTop: 6,
      backgroundColor: theme.colors.accent,
    },
    buttonPressed: { opacity: 0.86 },
    buttonDisabled: { opacity: 0.7 },
    buttonText: { color: theme.colors.accentText, fontSize: 17, fontWeight: '800' },
    secondaryButton: { alignItems: 'center', paddingVertical: 12 },
    secondaryText: { color: theme.colors.muted, fontSize: 14, fontWeight: '600' },
  });
}
