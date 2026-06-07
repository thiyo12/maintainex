import { useEffect, useRef } from 'react'
import { View, StyleSheet, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../lib/ThemeContext'
import { shadows } from '../../lib/tokens'

interface Props {
  type?: 'checkmark' | 'clock' | 'cross'
  size?: number
}

export default function SuccessAnimation({ type = 'checkmark', size = 80 }: Props) {
  const colors = useColors()
  const scaleAnim = useRef(new Animated.Value(0)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  const bgColor = type === 'checkmark' ? colors.success : type === 'cross' ? colors.error : colors.accent

  return (
    <Animated.View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
        shadows.lg,
      ]}
    >
      <Ionicons
        name={type === 'checkmark' ? 'checkmark' : type === 'cross' ? 'close' : 'time'}
        size={size * 0.5}
        color={colors.white}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  circle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
})
