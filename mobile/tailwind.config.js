/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#6C63FF',
        secondary: '#4834DF',
        success: '#34C759',
        danger: '#FF3B30',
        warning: '#FF9500',
        dark: {
          100: '#1A1A2E',
          200: '#16213E',
          300: '#0F3460',
          900: '#0A0A0F',
        },
      },
    },
  },
  plugins: [],
};
