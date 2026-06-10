import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useCountry } from '../lib/country'

export default function CountryChangeBanner() {
  const { countryChanged, detectedCountry, dismissCountryChange } = useCountry()
  const slideAnim = useRef(new Animated.Value(-80)).current

  useEffect(() => {
    if (countryChanged && detectedCountry) {
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }).start()
      const timer = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -80,
          duration: 300,
          useNativeDriver: true,
        }).start(() => dismissCountryChange())
      }, 5000)
      return () => clearTimeout(timer)
    } else {
      slideAnim.setValue(-80)
    }
  }, [countryChanged, detectedCountry])

  if (!countryChanged || !detectedCountry) return null

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.content}>
        <Ionicons name="globe-outline" size={18} color="#FFFFFF" />
        <Text style={styles.text}>
          You're now in <Text style={styles.bold}>{detectedCountry.name}</Text>. Browse local services available here.
        </Text>
      </View>
      <TouchableOpacity onPress={dismissCountryChange} style={styles.closeBtn}>
        <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: '#F59E0B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontSize: 13, color: '#FFFFFF', flex: 1, lineHeight: 18 },
  bold: { fontWeight: '700' },
  closeBtn: { padding: 4 },
})
