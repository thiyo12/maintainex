import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

const AMBER = '#F5A623'
const DARK_BG = '#0D0D0D'

export default function FindingTaskerScreen() {
  const { t } = useTranslation()
  const pulseRing1 = useRef(new Animated.Value(0.95)).current
  const pulseRing1Op = useRef(new Animated.Value(0.5)).current
  const pulseRing2 = useRef(new Animated.Value(0.95)).current
  const pulseRing2Op = useRef(new Animated.Value(0.5)).current
  const iconScale = useRef(new Animated.Value(0)).current
  const textFade = useRef(new Animated.Value(0)).current
  const textSlide = useRef(new Animated.Value(20)).current

  useEffect(() => {
    Animated.spring(iconScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }).start()

    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(textFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(textSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start()

    const ringAnim = (s: Animated.Value, op: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(s, { toValue: 1.4, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(op, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(s, { toValue: 0.95, duration: 0, useNativeDriver: true }),
          Animated.timing(op, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
      ])).start()

    ringAnim(pulseRing1, pulseRing1Op, 0)
    ringAnim(pulseRing2, pulseRing2Op, 600)
  }, [])

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Animated.View style={[styles.ring, { transform: [{ scale: pulseRing1 }], opacity: pulseRing1Op }]} />
        <Animated.View style={[styles.ring, styles.ring2, { transform: [{ scale: pulseRing2 }], opacity: pulseRing2Op }]} />
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: iconScale }] }]}>
          <Ionicons name="search-outline" size={40} color={AMBER} />
        </Animated.View>
      </View>
      <Animated.View style={{ opacity: textFade, transform: [{ translateY: textSlide }], alignItems: 'center' }}>
        <Text style={styles.title}>{t('components.findingTasker')}</Text>
        <Text style={styles.subtitle}>{t('components.findingTasker')}</Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: 'rgba(245,166,35,0.15)',
  },
  ring2: {
    width: 150,
    height: 150,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245,166,35,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: AMBER,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Outfit_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
})
