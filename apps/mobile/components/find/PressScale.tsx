import { ReactNode, useRef } from 'react'
import { Animated, Pressable, StyleProp, ViewStyle } from 'react-native'

interface Props {
  onPress?: () => void
  onLongPress?: () => void
  style?: StyleProp<ViewStyle>
  children: ReactNode
  scaleTo?: number
}

export default function PressScale({ onPress, onLongPress, style, children, scaleTo = 0.95 }: Props) {
  const scale = useRef(new Animated.Value(1)).current

  const animateIn = () => {
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      friction: 8,
      tension: 150,
    }).start()
  }

  const animateOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 150,
    }).start()
  }

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} onPressIn={animateIn} onPressOut={animateOut}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  )
}
