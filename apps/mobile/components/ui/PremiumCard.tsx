import React from 'react'
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import PressableScale from './PressableScale'

interface Props {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  onPress?: () => void
  glowColor?: string
}

export default function PremiumCard({ children, style, onPress, glowColor = '#F5A623' }: Props) {
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
    borderRadius: 16,
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  glass: {
    borderRadius: 16,
    backgroundColor: 'rgba(30,32,48,0.55)',
    borderWidth: 1,
    borderColor: '#2E2E2E',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
})
