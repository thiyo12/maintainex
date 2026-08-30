import type { TextStyle, ViewStyle } from 'react-native'
import { Easing } from 'react-native-reanimated'

export const colors = {
  background: '#0B0C12',
  surface: '#15161E',
  surfaceHigh: '#1E2030',
  border: '#2A2D3E',
  accent: '#F59E0B',
  accentSoft: '#F59E0B20',
  accentDim: '#D97706',
  success: '#10B981',
  successSoft: '#10B98115',
  error: '#EF4444',
  errorSoft: '#EF444415',
  info: '#6366F1',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#4B5563',
  overlay: '#00000080',
} as const

export type ThemeColors = typeof colors

export const typography: Record<'h1' | 'h2' | 'h3' | 'body' | 'bodyMuted' | 'label' | 'caption', TextStyle> = {
  h1: { fontSize: 32, fontFamily: 'Outfit_700Bold', color: colors.textPrimary },
  h2: { fontSize: 24, fontFamily: 'Outfit_700Bold', color: colors.textPrimary },
  h3: { fontSize: 20, fontFamily: 'Outfit_600SemiBold', color: colors.textPrimary },
  body: { fontSize: 16, fontFamily: 'Outfit_400Regular', color: colors.textPrimary },
  bodyMuted: { fontSize: 16, fontFamily: 'Outfit_400Regular', color: colors.textSecondary },
  label: { fontSize: 14, fontFamily: 'Outfit_600SemiBold', color: colors.textSecondary },
  caption: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: colors.textMuted },
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  full: 9999,
} as const

export const shadows: Record<'card', ViewStyle> = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
}

export const animations = {
  spring: { damping: 20, stiffness: 300 },
  smooth: { duration: 300, easing: Easing.out(Easing.cubic) },
} as const