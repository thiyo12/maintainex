import { useEffect, useRef } from 'react'
import { View, Text, Image, StyleSheet, Animated, Easing } from 'react-native'
import { useTranslation } from 'react-i18next'

const DARK = '#0B0C12'
const AMBER = '#F59E0B'
const WHITE = '#FFFFFF'

interface Props { onDone?: () => void }

export function LoadingScreen({ onDone }: Props) {
  const { t } = useTranslation()
  const iconScale   = useRef(new Animated.Value(0)).current
  const iconRotate  = useRef(new Animated.Value(-15)).current
  const titleY      = useRef(new Animated.Value(14)).current
  const titleOp     = useRef(new Animated.Value(0)).current
  const subY        = useRef(new Animated.Value(14)).current
  const subOp       = useRef(new Animated.Value(0)).current
  const barW        = useRef(new Animated.Value(0)).current
  const ring1S      = useRef(new Animated.Value(0.95)).current
  const ring1Op     = useRef(new Animated.Value(0.5)).current
  const ring2S      = useRef(new Animated.Value(0.95)).current
  const ring2Op     = useRef(new Animated.Value(0.5)).current
  const d1Op        = useRef(new Animated.Value(0.25)).current
  const d2Op        = useRef(new Animated.Value(0.25)).current
  const d3Op        = useRef(new Animated.Value(0.25)).current

  useEffect(() => {
    const anims: Animated.CompositeAnimation[] = []

    const a1 = Animated.parallel([
      Animated.spring(iconScale,  { toValue: 1, friction: 4, tension: 60, useNativeDriver: false }),
      Animated.timing(iconRotate, { toValue: 0, duration: 600, useNativeDriver: false }),
    ])
    anims.push(a1)
    a1.start()

    const a2 = Animated.sequence([
      Animated.delay(250),
      Animated.parallel([
        Animated.timing(titleOp, { toValue: 1, duration: 450, useNativeDriver: false }),
        Animated.timing(titleY,  { toValue: 0, duration: 450, useNativeDriver: false }),
      ]),
    ])
    anims.push(a2)
    a2.start()

    const a3 = Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(subOp, { toValue: 1, duration: 450, useNativeDriver: false }),
        Animated.timing(subY,  { toValue: 0, duration: 450, useNativeDriver: false }),
      ]),
    ])
    anims.push(a3)
    a3.start()

    const a4 = Animated.loop(
      Animated.sequence([
        Animated.timing(barW, { toValue: 0.9, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(barW, { toValue: 0,   duration: 400,  useNativeDriver: false }),
      ])
    )
    anims.push(a4)
    a4.start()

    const ringAnim = (s: Animated.Value, op: Animated.Value, delay: number) => {
      const a = Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(s,  { toValue: 1.05, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(op, { toValue: 1,    duration: 1500, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(s,  { toValue: 0.95, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(op, { toValue: 0.5,  duration: 1500, useNativeDriver: false }),
        ]),
      ]))
      anims.push(a)
      a.start()
    }
    ringAnim(ring1S, ring1Op, 0)
    ringAnim(ring2S, ring2Op, 500)

    const dotAnim = (op: Animated.Value, delay: number) => {
      const a = Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(op, { toValue: 1,    duration: 400, useNativeDriver: false }),
        Animated.timing(op, { toValue: 0.25, duration: 400, useNativeDriver: false }),
      ]))
      anims.push(a)
      a.start()
    }
    dotAnim(d1Op, 0)
    dotAnim(d2Op, 180)
    dotAnim(d3Op, 360)

    const entranceEnd = setTimeout(onDone || (() => {}), 1000)
    return () => {
      clearTimeout(entranceEnd)
      anims.forEach(a => { try { a.stop() } catch {} })
    }
  }, [onDone])

  const spin = iconRotate.interpolate({ inputRange: [-15, 0], outputRange: ['-15deg', '0deg'] })

  return (
    <View style={s.container}>
      <Animated.View style={[s.ring, s.ring1, { transform: [{ scale: ring1S }], opacity: ring1Op }]} />
      <Animated.View style={[s.ring, s.ring2, { transform: [{ scale: ring2S }], opacity: ring2Op }]} />
      <Animated.View style={[s.logoWrap, { transform: [{ scale: iconScale }, { rotate: spin }] }]}>
        <Image source={require('../../assets/logo.png')} style={s.logo} resizeMode="contain" />
      </Animated.View>
      <Animated.Text style={[s.title, { opacity: titleOp, transform: [{ translateY: titleY }] }]}>
        Maintainex
      </Animated.Text>
      <Animated.Text style={[s.sub, { opacity: subOp, transform: [{ translateY: subY }] }]}>
        FIND WORK · BUILD TRUST
      </Animated.Text>
      <View style={s.barTrack}>
        <Animated.View style={[s.barFill, { width: barW.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] }) }]} />
      </View>
      <View style={s.dots}>
        {[d1Op, d2Op, d3Op].map((op, i) => (
          <Animated.View key={i} style={[s.dot, { opacity: op }]} />
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK, justifyContent: 'center', alignItems: 'center' },
  ring:      { position: 'absolute', borderRadius: 9999, borderWidth: 1, borderColor: 'rgba(245,158,11,0.1)' },
  ring1:     { width: 260, height: 260 },
  ring2:     { width: 180, height: 180 },
  logoWrap: {
    width: 120, height: 120,
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  logo: { width: 120, height: 120, borderRadius: 9999 },
  title:    { fontSize: 22, fontFamily: 'Outfit_900Black', color: WHITE, letterSpacing: -0.5, marginBottom: 6 },
  sub:      { fontSize: 11, fontFamily: 'Outfit_700Bold', color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, marginBottom: 32 },
  barTrack: { width: 150, height: 3, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  barFill:  { height: '100%', backgroundColor: AMBER, borderRadius: 4 },
  dots:     { flexDirection: 'row', gap: 5, marginTop: 14 },
  dot:      { width: 5, height: 5, borderRadius: 3, backgroundColor: AMBER },
})
