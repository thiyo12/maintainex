export const colors = {
  // Brand palette (exact spec values)
  primary: '#F59E0B',       // Amber — buttons, CTAs, active states
  primaryDark: '#D97706',   // Amber Dark — pressed states, prices
  primaryLight: '#FDE68A',  // Amber Light — highlights, fills
  ink: '#0F0A00',           // Near-black — primary text, dark headers
  cream: '#FFFBF0',         // Warm white — main background
  muted: '#8B7355',         // Warm brown — secondary text, captions
  white: '#FFFFFF',         // Cards, inputs
  surface: '#FFF8E6',       // Slightly amber-tinted surface
  border: 'rgba(245,158,11,0.18)', // Amber-tinted borders
  success: '#10B981',       // Green — online, confirmed, completed
  info: '#3B82F6',          // Blue — customer accent
  company: '#8B5CF6',       // Purple — company accent
  error: '#DC2626',

  // Legacy aliases (existing non-V2 screens still compile)
  amber: '#F59E0B',
  amberDark: '#D97706',
  amberLight: '#FDE68A',
  amberBg: '#FEF3CD',
  creamDarker: '#F5EDD6',
  dark: '#0F0A00',
  darkMid: '#0F0A00',
  darkLight: '#8B7355',
  gray: '#8B7355',
  lightGray: 'rgba(245,158,11,0.18)',
  background: '#FFFBF0',
  green: '#10B981',
  teal: '#10B981',
  warning: '#F59E0B',
  red: '#DC2626',

  // Role accents — aligned with spec: customer=blue, tasker=amber, company=purple
  customerAccent: '#3B82F6',
  taskerAccent: '#F59E0B',
  companyAccent: '#8B5CF6',
}

export type ColorKey = keyof typeof colors
