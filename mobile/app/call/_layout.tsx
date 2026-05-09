import React from 'react';
import { Stack } from 'expo-router';
import { useAppTheme } from '../../src/theme/colors';

export default function CallLayout() {
  const theme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'fade',
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="outgoing" />
      <Stack.Screen name="incoming" />
      <Stack.Screen name="active" />
    </Stack>
  );
}
