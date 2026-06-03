import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { colors } from '../../lib/colors'
import { fonts } from '../../lib/fonts'

interface Props {
  icon?: string
  title: string
  subtitle?: string
}

export default function EmptyState({ icon = '📭', title, subtitle }: Props) {
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
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  icon: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.ink, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: fonts.body, color: colors.muted, textAlign: 'center', lineHeight: 20 },
})
