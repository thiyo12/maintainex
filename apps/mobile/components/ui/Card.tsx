import React from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import { colors } from '../../lib/colors'

interface Props {
  children: React.ReactNode
  style?: ViewStyle
  padded?: boolean
  highlighted?: boolean
}

export default function Card({ children, style, padded = true, highlighted }: Props) {
  return (
    <View style={[styles.card, padded && styles.padded, highlighted && styles.highlighted, style]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  padded: { padding: 16 },
  highlighted: {
    backgroundColor: colors.amberBg,
    borderWidth: 1,
    borderColor: colors.amberLight,
  },
})
