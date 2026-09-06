import { useEffect, useRef } from 'react'
import { useRouter } from 'expo-router'
import { useAuth } from '../lib/auth'
import { View, Image, StyleSheet, Animated } from 'react-native'

export default function EntryScreen() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()

  const logoScale = useRef(new Animated.Value(0.85)).current
  const logoOp = useRef(new Animated.Value(0)).current
  const titleOp = useRef(new Animated.Value(0)).current
  const titleY = useRef(new Animated.Value(16)).current
  const subOp = useRef(new Animated.Value(0)).current
  const fadeOut = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
        Animated.timing(logoOp, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(titleOp, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.delay(200),
      Animated.timing(subOp, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start()

    const timer = setTimeout(() => {
      Animated.timing(fadeOut, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        if (isLoading) return
        if (isAuthenticated) {
          if (user?.role === 'TASKER' && user?.needsOnboarding) router.replace('/(auth)/onboarding/tasker-services')
          else if (user?.role === 'COMPANY' && user?.needsOnboarding) router.replace('/(auth)/onboarding/company-setup')
          else if (user?.role === 'TASKER') router.replace('/(tasker)')
          else if (user?.role === 'COMPANY') router.replace('/(company)')
          else router.replace('/(customer)')
        } else {
          router.replace('/(auth)/welcome')
        }
      })
    }, 5000)

    return () => clearTimeout(timer)
  }, [isAuthenticated, isLoading, user, router])

  return (
    <Animated.View style={[styles.container, { opacity: fadeOut }]}>
      <View style={styles.center}>
        <Animated.View style={[styles.logoWrap, { opacity: logoOp, transform: [{ scale: logoScale }] }]}>
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        </Animated.View>

        <Animated.Text style={[styles.title, { opacity: titleOp, transform: [{ translateY: titleY }] }]}>
          MΛINTΛINEX
        </Animated.Text>

        <Animated.Text style={[styles.sub, { opacity: subOp }]}>
          FIND WORK · BUILD TRUST
        </Animated.Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0D0D0D', justifyContent: 'center', alignItems: 'center',
  },
  center: { alignItems: 'center' },
  logoWrap: { marginBottom: 0 },
  logo: { width: 140, height: 140 },
  title: {
    fontSize: 22, fontFamily: 'Outfit_800ExtraBold', color: '#FFFFFF',
    letterSpacing: 5, marginBottom: 2,
  },
  sub: {
    fontSize: 10, fontFamily: 'Outfit_600SemiBold', color: 'rgba(255,255,255,0.25)',
    letterSpacing: 2.5, marginTop: 2,
  },
})
