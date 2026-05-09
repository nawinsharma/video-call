import { useColorScheme } from 'react-native';

export const brand = {
  amber400: '#ffb900',
  amber400Oklch: 'oklch(82.8% 0.189 84.429)',
};

export type AppTheme = ReturnType<typeof createTheme>;

function createTheme(isDark: boolean) {
  return {
    isDark,
    colors: {
      background: isDark ? '#1a1a1a' : '#ffffff',
      surface: isDark ? '#242424' : '#f7f7f5',
      elevated: isDark ? '#2d2d2d' : '#ffffff',
      text: isDark ? '#f7f4ec' : '#1a1a1a',
      muted: isDark ? '#b7b0a3' : '#66615a',
      subtle: isDark ? '#817a70' : '#8d877e',
      border: isDark ? '#3a3a3a' : '#e2ded6',
      accent: brand.amber400,
      accentSoft: isDark ? 'rgba(255, 185, 0, 0.14)' : 'rgba(255, 185, 0, 0.2)',
      accentText: '#1a1a1a',
      danger: '#ef4444',
      success: '#22c55e',
      overlay: isDark ? 'rgba(0,0,0,0.58)' : 'rgba(255,255,255,0.72)',
      scrim: isDark ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.24)',
      input: isDark ? '#242424' : '#f4f2ed',
    },
  };
}

export function useAppTheme() {
  const scheme = useColorScheme();
  return createTheme(scheme !== 'light');
}
