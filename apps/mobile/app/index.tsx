import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import { useAuth } from '../lib/auth'
import { View, Image, StyleSheet, Animated, Dimensions, Text } from 'react-native'

const { width: SCREEN_W } = Dimensions.get('window')

export default function EntryScreen() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  const [animDone, setAnimDone] = useState(false)

  const markScale = useRef(new Animated.Value(0.92)).current
  const markOp = useRef(new Animated.Value(0)).current
  const markScaleMid = useRef(new Animated.Value(1)).current
  const wordmarkOp = useRef(new Animated.Value(0)).current
  const wordmarkY = useRef(new Animated.Value(12)).current
  const taglineOp = useRef(new Animated.Value(0)).current
  const fadeOut = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(markOp, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(markScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
      ]),
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(markScaleMid, { toValue: 0.82, duration: 300, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(wordmarkOp, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(wordmarkY, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
        Animated.delay(100),
        Animated.timing(taglineOp, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.delay(800),
    ]).start(() => setAnimDone(true))
  }, [])

  useEffect(() => {
    if (isLoading) return
    setAuthReady(true)
  }, [isLoading])

  useEffect(() => {
    if (!animDone || !authReady) return

    const timer = setTimeout(() => {
      Animated.timing(fadeOut, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => {
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
    }, 400)

    return () => clearTimeout(timer)
  }, [animDone, authReady, isAuthenticated, user, router])

  return (
    <Animated.View style={[styles.container, { opacity: fadeOut }]}>
      <View style={styles.center}>
        <Animated.View style={[
          styles.markWrap,
          { opacity: markOp, transform: [{ scale: Animated.multiply(markScale, markScaleMid) }] },
        ]}>
          <Image source={require('../assets/logo.png')} style={styles.mark} resizeMode="contain" />
        </Animated.View>

        <Animated.View style={[styles.wordmarkWrap, { opacity: wordmarkOp, transform: [{ translateY: wordmarkY }] }]}>
          <Text style={styles.wordmark}>MΛINTΛINEX</Text>
        </Animated.View>

        <Animated.View style={[styles.taglineWrap, { opacity: taglineOp }]}>
          <Text style={styles.tagline}>One place to get things done.</Text>
        </Animated.View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: { alignItems: 'center' },
  markWrap: { marginBottom: 24 },
  mark: { width: 100, height: 100 },
  wordmarkWrap: { marginTop: 8 },
  wordmark: {
    fontSize: 28,
    fontFamily: 'Outfit_900Black',
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  taglineWrap: { marginTop: 10 },
  tagline: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    fontWeight: '650',
    color: '#BDBDBD',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
})
