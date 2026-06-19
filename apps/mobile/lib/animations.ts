import React from 'react'
import { Animated } from 'react-native'

export function useFadeUp(delay = 0) {
  const opacity = React.useRef(new Animated.Value(0)).current
  const translateY = React.useRef(new Animated.Value(24)).current

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, delay, useNativeDriver: true }),
    ]).start()
  }, [])

  return { opacity, translateY }
}

export function usePopIn(delay = 0) {
  const anim = React.useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      friction: 7,
      tension: 60,
      delay,
      useNativeDriver: true,
    }).start()
  }, [])

  return {
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
  }
}

export function useSlideUp(delay = 0) {
  const anim = React.useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 450,
      delay,
      useNativeDriver: true,
    }).start()
  }, [])

  return {
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  }
}

export function useGlowPulse() {
  const opacity = React.useRef(new Animated.Value(0.3)).current

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 1200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])

  return opacity
}

export function useSuccessRing() {
  const scale = React.useRef(new Animated.Value(0)).current
  const opacity = React.useRef(new Animated.Value(0.6)).current

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 2, duration: 600, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start()
  }, [])

  return { scale, opacity }
}

export function useStagger(count: number, baseDelay = 80, increment = 80, trigger?: any) {
  const anims = React.useRef<Animated.Value[]>([])

  while (anims.current.length < count) {
    anims.current.push(new Animated.Value(0))
  }

  React.useEffect(() => {
    const targets = anims.current.slice(0, count)
    targets.forEach(a => a.setValue(0))
    const st = Animated.stagger(
      increment,
      targets.map(v => Animated.spring(v, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }))
    )
    const seq = Animated.sequence([
      Animated.delay(baseDelay),
      st,
    ])
    seq.start()
    return () => seq.stop()
  }, [count, baseDelay, increment, trigger])

  return anims.current.slice(0, count).map(v => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
  }))
}
