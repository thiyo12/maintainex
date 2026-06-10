import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Logo from './Logo'
import { spacing } from '../../lib/tokens'

const DARK_BG = '#0B0B14'
const LOGO_SIZE = 84
const RING_COUNT = 4
const ORBIT_COUNT = 12

function ExpandingRing({ index }: { index: number }) {
  const scaleAnim = useRef(new Animated.Value(0.2)).current
  const opacityAnim = useRef(new Animated.Value(0.6)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(index * 600),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 4,
            duration: 2500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 2500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
        Animated.timing(scaleAnim, {
          toValue: 0.2,
          duration: 0,
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.6,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: LOGO_SIZE,
          height: LOGO_SIZE,
          borderRadius: LOGO_SIZE / 2,
          borderColor: 'rgba(245,158,11,0.4)',
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
          borderWidth: 2,
        },
      ]}
    />
  )
}

function SoftGlow({ index }: { index: number }) {
  const xAnim = useRef(new Animated.Value(0)).current
  const yAnim = useRef(new Animated.Value(0)).current
  const breatheAnim = useRef(new Animated.Value(0)).current
  const { width: W, height: H } = Dimensions.get('window')

  useEffect(() => {
    const driftX = Animated.loop(
      Animated.sequence([
        Animated.timing(xAnim, { toValue: 1, duration: 12000 + index * 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(xAnim, { toValue: 0, duration: 12000 + index * 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    )
    const driftY = Animated.loop(
      Animated.sequence([
        Animated.timing(yAnim, { toValue: 1, duration: 14000 + index * 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(yAnim, { toValue: 0, duration: 14000 + index * 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    )
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1, duration: 6000 + index * 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(breatheAnim, { toValue: 0, duration: 6000 + index * 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    )
    Animated.parallel([driftX, driftY, breathe]).start()
    return () => { driftX.stop(); driftY.stop(); breathe.stop() }
  }, [])

  const x = xAnim.interpolate({ inputRange: [0, 1], outputRange: [-50 - index * 20, 50 + index * 20] })
  const y = yAnim.interpolate({ inputRange: [0, 1], outputRange: [-30 - index * 20, 30 + index * 20] })
  const breatheScale = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] })
  const breatheOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] })

  const glowSize = 380 + index * 80
  const layers = [
    { size: glowSize, opacity: 0.04 },
    { size: glowSize * 0.72, opacity: 0.07 },
    { size: glowSize * 0.52, opacity: 0.10 },
    { size: glowSize * 0.36, opacity: 0.14 },
    { size: glowSize * 0.22, opacity: 0.18 },
    { size: glowSize * 0.12, opacity: 0.22 },
  ]

  const glowPositions = [
    { x: -40, y: -30 },
    { x: W - glowSize * 0.6, y: -40 },
    { x: (W - glowSize * 0.5) / 2 - 30, y: H - glowSize * 0.5 + 20 },
  ]

  return (
    <View style={[styles.glowWrap, { left: glowPositions[index].x, top: glowPositions[index].y }]}>
      <Animated.View style={{ opacity: breatheOpacity, transform: [{ translateX: x }, { translateY: y }, { scale: breatheScale }] }}>
        {layers.map((layer, i) => (
          <View key={i} style={{ position: 'absolute', width: layer.size, height: layer.size, borderRadius: layer.size / 2, backgroundColor: '#F59E0B', opacity: layer.opacity }} />
        ))}
      </Animated.View>
    </View>
  )
}

function OrbitingDot({ index, progress, spread }: { index: number; progress: Animated.Value; spread: Animated.Value }) {
  const angle = (index / ORBIT_COUNT) * Math.PI * 2
  const radius = 100 + (index % 4) * 30

  const x = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * radius] })
  const y = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * radius] })

  const dotSize = 4 + (index % 3) * 2
  const dotOpacity = progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0, 1] })
  const dotScale = spread.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] })

  return (
    <Animated.View style={{ position: 'absolute', width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: '#F59E0B', opacity: dotOpacity, transform: [{ translateX: x }, { translateY: y }, { scale: dotScale }] }} />
  )
}

export function LoadingScreen({ onDone }: { onDone: () => void }) {
  const barWidth = useRef(new Animated.Value(0)).current
  const worldProgress = useRef(new Animated.Value(0)).current
  const worldScale = useRef(new Animated.Value(0)).current
  const worldOpacity = useRef(new Animated.Value(0)).current
  const loadingOpacity = useRef(new Animated.Value(1)).current
  const orbitSpread = useRef(new Animated.Value(0)).current
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    Animated.sequence([
      Animated.timing(barWidth, { toValue: 0.85, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(barWidth, { toValue: 0.95, duration: 200, easing: Easing.linear, useNativeDriver: false }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(loadingOpacity, { toValue: 0, duration: 200, useNativeDriver: false }),
        Animated.sequence([
          Animated.delay(80),
          Animated.timing(worldProgress, { toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: false }),
        ]),
      ]).start(() => {
        onDoneRef.current()
      })
    })
  }, [])

  const titleOpacity = loadingOpacity

  const worldGlowScale = worldScale.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2] })
  const worldGlowOpacity = worldScale.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0.6] })
  const worldLogoScale = worldScale.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] })
  const worldLogoOpacity = worldScale.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.5, 0] })
  const containerScale = worldProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] })
  const containerOpacity = worldProgress.interpolate({ inputRange: [0, 0.92, 1], outputRange: [1, 1, 0] })

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0B0B14', '#0E0808', '#0B0B14']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <SoftGlow index={0} />
      <SoftGlow index={1} />
      <SoftGlow index={2} />

      <Animated.View style={[styles.centerArea, { opacity: containerOpacity, transform: [{ scale: containerScale }] }]}>
        {Array.from({ length: RING_COUNT }, (_, i) => (
          <ExpandingRing key={i} index={i} />
        ))}
        <View style={styles.logoGlow} />
        <Animated.View style={[styles.logoRound, { opacity: worldLogoOpacity, transform: [{ scale: worldLogoScale }] }]}>
          <Logo size={LOGO_SIZE} />
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.worldContainer, { opacity: worldOpacity }]}>
        <Animated.View style={[styles.worldGlobe, { opacity: worldGlowOpacity, transform: [{ scale: worldGlowScale }] }]} />
        <View style={styles.worldCore}><Logo size={60} /></View>
        {Array.from({ length: ORBIT_COUNT }, (_, i) => (
          <OrbitingDot key={i} index={i} progress={worldProgress} spread={orbitSpread} />
        ))}
      </Animated.View>

      <Animated.Text style={[styles.title, { opacity: titleOpacity }]}>Maintainex</Animated.Text>
      <Animated.Text style={[styles.subtitle, { opacity: titleOpacity }]}>Find work  ·  Build trust</Animated.Text>

      <View style={styles.bar}>
        <Animated.View style={[styles.barFill, { width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
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
        Animated.timing(anim, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])
  const scale = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.7, 1.3, 0.7] })
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.25, 1, 0.25] })
  return <Animated.View style={[styles.dot, { opacity, transform: [{ scale }] }]} />
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl, position: 'relative', overflow: 'hidden' },
  glowWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  centerArea: { width: LOGO_SIZE * 3, height: LOGO_SIZE * 3, alignItems: 'center', justifyContent: 'center', marginBottom: 24, zIndex: 1 },
  ring: { position: 'absolute', borderWidth: 1 },
  logoGlow: { position: 'absolute', width: LOGO_SIZE + 36, height: LOGO_SIZE + 36, borderRadius: (LOGO_SIZE + 36) / 2, backgroundColor: 'rgba(245,158,11,0.10)' },
  logoRound: { width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: LOGO_SIZE / 2, overflow: 'hidden', backgroundColor: DARK_BG, borderWidth: 2, borderColor: 'rgba(245,158,11,0.3)' },
  title: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 6, zIndex: 1 },
  subtitle: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 36, zIndex: 1 },
  bar: { width: 160, height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', zIndex: 1 },
  barFill: { height: '100%', backgroundColor: '#F59E0B', borderRadius: 4 },
  dots: { flexDirection: 'row', gap: 5, marginTop: 16, zIndex: 1 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#F59E0B' },
  worldContainer: { position: 'absolute', width: 200, height: 200, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  worldGlobe: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(245,158,11,0.15)' },
  worldCore: { width: 60, height: 60, borderRadius: 30, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(245,158,11,0.4)', backgroundColor: DARK_BG },
})
