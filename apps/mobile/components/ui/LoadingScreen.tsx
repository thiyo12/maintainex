import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import Logo from './Logo'
import { fonts } from '../../lib/fonts'
import { spacing } from '../../lib/tokens'

const DARK_BG = '#0F0F1A'

export function LoadingScreen() {
  const rotAnim1 = useRef(new Animated.Value(0)).current
  const rotAnim2 = useRef(new Animated.Value(0)).current
  const barWidth = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const spin1 = Animated.loop(
      Animated.timing(rotAnim1, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    const spin2 = Animated.loop(
      Animated.timing(rotAnim2, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    spin1.start()
    spin2.start()

    Animated.sequence([
      Animated.timing(barWidth, {
        toValue: 0.85,
        duration: 2500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(barWidth, {
        toValue: 0.95,
        duration: 500,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ]).start()

    return () => { spin1.stop(); spin2.stop() }
  }, [])

  const spinInterp1 = rotAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })
  const spinInterp2 = rotAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  })

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.ring1, { transform: [{ rotate: spinInterp1 }] }]} />
      <Animated.View style={[styles.ring2, { transform: [{ rotate: spinInterp2 }] }]} />
      <View style={styles.logoGlow} />
      <View style={styles.logoWrap}>
        <Logo size={84} />
      </View>
      <Text style={styles.title}>Maintainex</Text>
      <Text style={styles.subtitle}>Find work  ·  Build trust</Text>
      <View style={styles.bar}>
        <Animated.View
          style={[
            styles.barFill,
            { width: barWidth.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            })},
          ]}
        />
      </View>
      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <AnimatedDot key={i} index={i} />
        ))}
      </View>
    </View>
  )
}

function AnimatedDot({ index }: { index: number }) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(index * 180),
        Animated.timing(anim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])

  const scale = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.7, 1.3, 0.7],
  })
  const opacity = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.25, 1, 0.25],
  })

  return (
    <Animated.View
      style={[
        styles.dot,
        { opacity, transform: [{ scale }] },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    position: 'relative',
    overflow: 'hidden',
  },
  ring1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.08)',
  },
  ring2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.12)',
  },
  logoWrap: {
    marginBottom: 24,
    zIndex: 1,
    opacity: 0.95,
  },
  logoGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(245,158,11,0.12)',
    top: '50%',
    marginTop: -60,
    zIndex: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 6,
    zIndex: 1,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 36,
    zIndex: 1,
  },
  bar: {
    width: 160,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    zIndex: 1,
  },
  barFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 16,
    zIndex: 1,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
})
