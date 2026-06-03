export const colors = {
  // Brand palette (V2+)
  amber: '#F59E0B',
  amberDark: '#D97706',
  amberLight: '#FDE68A',
  amberBg: '#FEF3CD',
  ink: '#0F0A00',
  cream: '#FFFBF0',
  creamDarker: '#F5EDD6',
  muted: '#8B7355',

  // Legacy (keep for existing screens)
  primary: '#FFC300',
  primaryDark: '#D97706',
  primaryLight: '#FEF3C7',
  dark: '#1F2937',
  darkMid: '#374151',
  darkLight: '#4B5563',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  background: '#F9FAFB',

  white: '#FFFFFF',
  error: '#DC2626',
  success: '#059669',
  warning: '#F59E0B',
  teal: '#0D9488',
  green: '#059669',
  red: '#DC2626',

  border: '#E8DDCC',
  customerAccent: '#7C3AED',
  taskerAccent: '#0D9488',
  companyAccent: '#F97316',
}

export type ColorKey = keyof typeof colors
