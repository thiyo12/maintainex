import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import { useAuth } from '../lib/auth'
import { View, Image, StyleSheet, Animated, Text } from 'react-native'

export default function EntryScreen() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  const [animDone, setAnimDone] = useState(false)

  const sceneOpacity = useRef(new Animated.Value(1)).current
  const markOpacity = useRef(new Animated.Value(0)).current
  const markScale = useRef(new Animated.Value(1.34)).current
  const wordmarkOpacity = useRef(new Animated.Value(0)).current
  const wordmarkY = useRef(new Animated.Value(10)).current
  const revealOpacity = useRef(new Animated.Value(0)).current
  const finalTaglineOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Approved V3.3 splash sequence:
    // Start = mark only → Reveal = wordmark + "Services. Property. Work."
    // → Complete = "One place to get things done."
    Animated.sequence([
      Animated.parallel([
        Animated.timing(markOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(markScale, {
          toValue: 1.34,
          friction: 7,
          tension: 48,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(260),
      Animated.parallel([
        Animated.timing(markScale, { toValue: 1.16, duration: 260, useNativeDriver: true }),
        Animated.timing(wordmarkOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(wordmarkY, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(revealOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]),
      Animated.delay(420),
      Animated.parallel([
        Animated.timing(markScale, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.timing(revealOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(finalTaglineOpacity, { toValue: 1, duration: 260, delay: 100, useNativeDriver: true }),
      ]),
      Animated.delay(650),
    ]).start(() => setAnimDone(true))
  }, [finalTaglineOpacity, markOpacity, markScale, revealOpacity, wordmarkOpacity, wordmarkY])

  useEffect(() => {
    if (!isLoading) setAuthReady(true)
  }, [isLoading])

  useEffect(() => {
    if (!animDone || !authReady) return

    Animated.timing(sceneOpacity, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => {
      if (isAuthenticated) {
        if (user?.role === 'TASKER') router.replace('/(tasker)' as any)
        else if (user?.role === 'COMPANY') router.replace('/(company)' as any)
        else router.replace('/(customer)' as any)
      } else {
        router.replace('/(auth)/welcome')
      }
    })
  }, [animDone, authReady, isAuthenticated, router, sceneOpacity, user])

  return (
    <Animated.View style={[styles.container, { opacity: sceneOpacity }]}>
      <View style={styles.stage}>
        <Animated.View style={{ opacity: markOpacity, transform: [{ scale: markScale }] }}>
          <Image source={require('../assets/logo.png')} style={styles.mark} resizeMode="contain" />
        </Animated.View>

        <Animated.View style={[styles.wordmarkWrap, { opacity: wordmarkOpacity, transform: [{ translateY: wordmarkY }] }]}>
          <Text style={styles.wordmark}>MΛINTΛINEX</Text>
        </Animated.View>

        <View style={styles.taglineSlot}>
          <Animated.Text style={[styles.revealTagline, { opacity: revealOpacity }]}>Services. Property. Work.</Animated.Text>
          <Animated.Text style={[styles.finalTagline, { opacity: finalTaglineOpacity }]}>One place to get things done.</Animated.Text>
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  stage: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '38%',
    alignItems: 'center',
  },
  mark: {
    width: 112,
    height: 60,
  },
  wordmarkWrap: {
    marginTop: 22,
  },
  wordmark: {
    fontSize: 27,
    fontFamily: 'Outfit_900Black',
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  taglineSlot: {
    height: 24,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealTagline: {
    position: 'absolute',
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    color: '#BDBDBD',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  finalTagline: {
    position: 'absolute',
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    color: '#BDBDBD',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
})
