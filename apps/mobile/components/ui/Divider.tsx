import React from 'react'
import { View, StyleProp, ViewStyle } from 'react-native'
import { useColors } from '../../lib/theme'
import { spacing } from '../../lib/tokens'

interface DividerProps {
  vertical?: boolean
  spacing?: number
  style?: StyleProp<ViewStyle>
}

/** Canonical V2 hairline divider. */
export default function Divider({ vertical = false, spacing: gap, style }: DividerProps) {
  const colors = useColors()
  const margin = gap ?? spacing.lg

  if (vertical) {
    return <View style={[{ width: 1, alignSelf: 'stretch', backgroundColor: colors.border, marginHorizontal: margin }, style]} />
  }
  return <View style={[{ height: 1, backgroundColor: colors.border, marginVertical: margin }, style]} />
}
