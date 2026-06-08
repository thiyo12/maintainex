import { type ReactNode } from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { useColors } from '../../lib/ThemeContext'
import { spacing, borderRadius, shadows } from '../../lib/tokens'

interface Props {
  children: ReactNode
  variant?: 'default' | 'elevated' | 'pressable'
  onPress?: () => void
  style?: any
  padded?: boolean
}

export default function Card({ children, variant = 'default', onPress, style, padded }: Props) {
  const colors = useColors()

  const cardStyle = [
    styles.base,
    {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
    },
    variant === 'elevated' && shadows.lg,
    variant !== 'elevated' && shadows.md,
    padded === false && { padding: 0 },
    style,
  ]

  if (variant === 'pressable' && onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={cardStyle}>
        {children}
      </TouchableOpacity>
    )
  }

  return <View style={cardStyle}>{children}</View>
}

const styles = StyleSheet.create({
  base: {
    padding: spacing.lg,
  },
})
