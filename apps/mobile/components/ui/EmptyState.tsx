import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../lib/ThemeContext'

interface Props {
  icon?: string
  title: string
  subtitle?: string
}

export default function EmptyState({ icon, title, subtitle }: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const bounceAnim = useRef(new Animated.Value(0.9)).current
  const floatAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(bounceAnim, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
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
    <View style={styles.container}>
      <Animated.View style={[styles.iconBox, {
        opacity: fadeAnim,
        transform: [{ scale: bounceAnim }, { translateY: floatY }],
      }]}>
        <Ionicons name={(icon as any) || 'mail-unread-outline'} size={32} color={colors.muted} />
      </Animated.View>
      <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 60 },
  iconBox: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  title:    { fontSize: 18, fontFamily: 'Outfit_800ExtraBold', textAlign: 'center', marginBottom: 8, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, fontFamily: 'Outfit_500Medium', textAlign: 'center', lineHeight: 22 },
})
