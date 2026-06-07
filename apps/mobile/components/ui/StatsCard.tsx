import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../lib/ThemeContext'
import { fonts, fontSizes } from '../../lib/fonts'
import { spacing, borderRadius, shadows } from '../../lib/tokens'

interface Props {
  label: string
  value: string | number
  color?: string
  icon?: string
}

export default function StatsCard({ label, value, color: propColor, icon }: Props) {
  const colors = useColors()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const color = propColor || colors.primary

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start()
  }, [])

  return (
    <Animated.View style={[styles.card, { backgroundColor: colors.surface, opacity: fadeAnim }, shadows.md]}>
      {icon ? (
        <Ionicons
          name={icon as any}
          size={24}
          color={color}
          style={styles.icon}
        />
      ) : null}
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  icon: {
    marginBottom: spacing.sm,
  },
  value: {
    fontSize: fontSizes.h2,
    fontFamily: fonts.headingBold,
    marginBottom: spacing.xxs,
  },
  label: {
    fontSize: fontSizes.caption,
    fontFamily: fonts.body,
    textAlign: 'center',
  },
})
