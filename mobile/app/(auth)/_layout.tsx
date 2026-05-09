import React from 'react';
import { Stack } from 'expo-router';
import { useAppTheme } from '../../src/theme/colors';

export default function AuthLayout() {
  const theme = useAppTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
