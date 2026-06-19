import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { useTheme } from '../../lib/ThemeContext'

interface Props {
  label: string
  value: string | number
  color?: string
  icon?: string
  iconName?: string
}

export default function StatsCard({ label, value, color, icon, iconName }: Props) {
  const { colors } = useTheme()
  const accentColor = color || colors.amber
  const fadeAnim  = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.92)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <Animated.View style={[
      styles.card,
      { backgroundColor: colors.white, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
    ]}>
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <View style={[styles.iconBox, { backgroundColor: accentColor + '20' }]}>
        <Text style={{ fontSize: 16 }}>{iconName || icon || '📊'}</Text>
      </View>
      <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1, borderRadius: 16, padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 16, elevation: 4,
    overflow: 'hidden', position: 'relative',
  },
  accentBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3 },
  iconBox:   { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  value:     { fontSize: 20, fontFamily: 'Outfit_900Black', letterSpacing: -0.5, marginBottom: 2 },
  label:     { fontSize: 9,  fontFamily: 'Outfit_700Bold', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
})
