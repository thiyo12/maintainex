import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../lib/ThemeContext'
import { fonts, fontSizes } from '../../lib/fonts'
import { spacing, borderRadius, shadows } from '../../lib/tokens'

interface Props {
  icon?: string
  title: string
  subtitle?: string
  actionLabel?: string
  actionIcon?: string
  onAction?: () => void
}

export default function EmptyState({ icon, title, subtitle, actionLabel, actionIcon = 'options-outline', onAction }: Props) {
  const colors = useColors()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const floatAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(floatAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ])
      ),
    ]).start()
  }, [])

  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  })

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.surface }, shadows.md]}>
      <Animated.View style={[styles.iconWrap, { borderColor: colors.border, backgroundColor: colors.background, opacity: fadeAnim, transform: [{ translateY: floatY }] }]}>
        <Ionicons name={(icon || 'inbox-outline') as any} size={32} color={colors.muted} />
      </Animated.View>
      <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.inkLight }]}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
          onPress={onAction}
        >
          <Ionicons name={actionIcon as any} size={14} color={colors.inkLight} />
          <Text style={[styles.actionText, { color: colors.ink }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 18,
    padding: spacing.xxxl,
    alignItems: 'center',
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 17,
    fontFamily: fonts.headingBold,
    marginBottom: spacing.xs,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: fontSizes.caption,
    fontFamily: fonts.bodyMedium,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  actionText: {
    fontSize: fontSizes.captionSmall,
    fontFamily: fonts.label,
  },
})
