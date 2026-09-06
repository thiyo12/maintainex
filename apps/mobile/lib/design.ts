import type { TextStyle, ViewStyle } from 'react-native'
import { Easing } from 'react-native-reanimated'

export const colors = {
  background:   '#0D0D0D',
  base:         '#141414',
  surface:      '#1C1C1C',
  elevated:     '#242424',
  high:         '#2E2E2E',
  interactive:  '#3A3A3A',

  amber:        '#F5A623',
  amberDark:    '#D48900',
  amberDeep:    '#A86D00',
  amberLight:   '#F7BE5A',
  amberSoft:    '#FDE8B3',
  amberTint:    '#F5A62315',

  textPrimary:  '#FFFFFF',
  textSecond:   '#B3B3B3',
  textMuted:    '#6B6B6B',
  textAmber:    '#F5A623',

  borderSubtle: '#1F1F1F',
  border:       '#2E2E2E',
  borderStrong: '#424242',
  borderFocus:  '#F5A623',

  success:      '#22C55E',
  successBg:    '#0A2E1A',
  error:        '#EF4444',
  errorBg:      '#2E0A0A',
  warning:      '#F5A623',
  warningBg:    '#2E1A00',
  info:         '#3B82F6',
  infoBg:       '#0A1A2E',

  overlay:      '#00000080',
} as const

export type ThemeColors = typeof colors

export const typography: Record<'h1' | 'h2' | 'h3' | 'body' | 'bodyMuted' | 'label' | 'caption', TextStyle> = {
  h1: { fontSize: 32, fontFamily: 'Outfit_700Bold', color: colors.textPrimary },
  h2: { fontSize: 24, fontFamily: 'Outfit_700Bold', color: colors.textPrimary },
  h3: { fontSize: 20, fontFamily: 'Outfit_600SemiBold', color: colors.textPrimary },
  body: { fontSize: 16, fontFamily: 'Outfit_400Regular', color: colors.textPrimary },
  bodyMuted: { fontSize: 16, fontFamily: 'Outfit_400Regular', color: colors.textSecond },
  label: { fontSize: 14, fontFamily: 'Outfit_600SemiBold', color: colors.textSecond },
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
