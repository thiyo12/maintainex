import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { useColors } from '../../lib/ThemeContext'
import { fonts, fontSizes } from '../../lib/fonts'
import { spacing } from '../../lib/tokens'

interface Props {
  icon?: string
  title: string
  subtitle?: string
}

export default function EmptyState({ icon = '📭', title, subtitle }: Props) {
  const colors = useColors()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const bounceAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(bounceAnim, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: bounceAnim }] }}>
        <Text style={styles.icon}>{icon}</Text>
      </Animated.View>
      <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.xxxxl,
  },
  icon: { fontSize: 64, marginBottom: spacing.lg },
  title: { fontSize: fontSizes.h3, fontFamily: fonts.headingBold, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { fontSize: fontSizes.bodySmall, fontFamily: fonts.body, textAlign: 'center', lineHeight: 20 },
})
