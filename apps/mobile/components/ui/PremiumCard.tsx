import React from 'react'
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import PressableScale from './PressableScale'
import { colors, radius, shadows } from '../../lib/theme'

interface Props {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  onPress?: () => void
  glowColor?: string
}

export default function PremiumCard({ children, style, onPress, glowColor = colors.accent }: Props) {
  const content = (
    <View style={[styles.glass, style]}>{children}</View>
  )

  if (onPress) {
    return (
      <PressableScale onPress={onPress} scaleTo={0.98} style={[styles.glow, { shadowColor: glowColor }]}>
        {content}
      </PressableScale>
    )
  }
  return <View style={[styles.glow, { shadowColor: glowColor }]}>{content}</View>
}

const styles = StyleSheet.create({
  glow: {
    borderRadius: radius.md,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  glass: {
    borderRadius: radius.md,
    backgroundColor: 'rgba(30,32,48,0.55)',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
})