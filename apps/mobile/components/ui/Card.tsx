import React from 'react'
import { View, StyleProp, ViewStyle } from 'react-native'
import PressableScale from './PressableScale'
import { useColors } from '../../lib/theme'
import { borderRadius, shadows, spacing } from '../../lib/tokens'

interface CardProps {
  children: React.ReactNode
  onPress?: () => void
  padded?: boolean
  elevated?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Canonical V2 card. Surface background with subtle border; optional press. */
export default function Card({ children, onPress, padded = true, elevated = false, style, testID }: CardProps) {
  const colors = useColors()
  const body = (
    <View
      testID={onPress ? undefined : testID}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.card,
          borderWidth: 1,
          borderColor: colors.border,
          ...(padded ? { padding: spacing.lg } : null),
          ...(elevated ? shadows.md : null),
        },
        style,
      ]}
    >
      {children}
    </View>
  )

  if (!onPress) return body
  return (
    <PressableScale onPress={onPress} testID={testID}>
      {body}
    </PressableScale>
  )
}
