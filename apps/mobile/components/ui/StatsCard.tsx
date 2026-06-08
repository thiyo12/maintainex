import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../lib/ThemeContext'
import { fonts, fontSizes } from '../../lib/fonts'
import { spacing, borderRadius, shadows } from '../../lib/tokens'

const iconMap: Record<string, { name: keyof typeof Ionicons.glyphMap; bg: string; iconColor: string }> = {
  default: { name: 'briefcase-outline', bg: '#FEF3C7', iconColor: '#D97706' },
}

interface Props {
  label: string
  value: string | number
  color?: string
  icon?: string
  iconBg?: string
  iconColor?: string
}

export default function StatsCard({ label, value, color: propColor, icon, iconBg, iconColor: propIconColor }: Props) {
  const colors = useColors()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const color = propColor || colors.primary
  const ic = iconMap[icon || 'default'] || iconMap.default

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start()
  }, [])

  return (
    <Animated.View style={[styles.card, { backgroundColor: colors.surface, opacity: fadeAnim }, shadows.md]}>
      <View style={[styles.bottomBar, { backgroundColor: color }]} />
      <View style={[styles.iconWrap, { backgroundColor: iconBg || ic.bg }]}>
        <Ionicons
          name={(icon || ic.name) as any}
          size={16}
          color={propIconColor || ic.iconColor}
        />
      </View>
      <Text style={[styles.value, { color: colors.ink }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  value: {
    fontSize: fontSizes.h3,
    fontFamily: fonts.headingBold,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: fonts.label,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
})
