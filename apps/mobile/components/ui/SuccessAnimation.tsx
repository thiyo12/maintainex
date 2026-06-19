import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../lib/ThemeContext'

const DARK_BG = '#0F0F1A'

interface Props {
  type?: 'checkmark' | 'clock' | 'cross'
  size?: number
  title?: string
  subtitle?: string
  buttonLabel?: string
  onButtonPress?: () => void
}

export default function SuccessAnimation({ type = 'checkmark', size = 80, title, subtitle, buttonLabel, onButtonPress }: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const scaleAnim = useRef(new Animated.Value(0)).current
  const opacityAnim = useRef(new Animated.Value(0)).current
  const ringAnim = useRef(new Animated.Value(0)).current
  const contentFade = useRef(new Animated.Value(0)).current
  const ringScale = useRef(new Animated.Value(1)).current
  const ringOp = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(contentFade, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
    ]).start()

    Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(ringScale, { toValue: 1.6, duration: 1000, useNativeDriver: true }),
        Animated.timing(ringOp, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(ringScale, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.timing(ringOp, { toValue: 0.4, duration: 0, useNativeDriver: true }),
      ]),
    ])).start()
  }, [])

  const ringScaleInterp = ringAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 2, 1],
  })
  const ringOpacityInterp = ringAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.4, 0, 0.4],
  })

  const bgColor = type === 'checkmark' ? '#10B981' : type === 'cross' ? '#EF4444' : '#F59E0B'
  const iconName = type === 'checkmark' ? 'checkmark' : type === 'cross' ? 'close' : 'time'

  return (
    <View style={styles.container}>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{
          position: 'absolute',
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: bgColor,
          transform: [{ scale: ringScale }],
          opacity: ringOp,
        }} />
        <Animated.View
          style={[
            styles.ring,
            {
              width: 200, height: 200, borderRadius: 100,
              opacity: ringOpacityInterp,
              transform: [{ scale: ringScaleInterp }],
              borderColor: bgColor,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.circle,
            {
              width: size, height: size, borderRadius: size / 2,
              backgroundColor: bgColor,
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          <Ionicons name={iconName as any} size={size * 0.45} color="#FFFFFF" />
        </Animated.View>
      </View>
      {title ? (
        <Animated.Text style={[styles.title, { opacity: contentFade }]}>{title}</Animated.Text>
      ) : null}
      {subtitle ? (
        <Animated.Text style={[styles.subtitle, { opacity: contentFade }]}>{subtitle}</Animated.Text>
      ) : null}
      {buttonLabel && onButtonPress ? (
        <Animated.View style={{ opacity: contentFade }}>
          <TouchableOpacity style={styles.button} onPress={onButtonPress}>
            <Ionicons name="arrow-back" size={16} color="#111" />
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : null}
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: DARK_BG,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
  },
  circle: {
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Outfit_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    zIndex: 1,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 20,
    zIndex: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 14,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 6,
    zIndex: 1,
  },
  buttonText: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    color: '#111',
  },
})
