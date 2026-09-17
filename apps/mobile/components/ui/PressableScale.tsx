import React, { useCallback } from 'react'
import { Pressable, StyleProp, ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'

interface Props {
  children: React.ReactNode
  onPress?: () => void
  onLongPress?: () => void
  style?: StyleProp<ViewStyle>
  pressedStyle?: StyleProp<ViewStyle>
  scaleTo?: number
  disabled?: boolean
  activeOpacity?: never
}

const SPRING_CONFIG = { damping: 20, stiffness: 300 }

export default function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  pressedStyle,
  scaleTo = 0.96,
  disabled,
}: Props) {
  const scale = useSharedValue(1)
  const disabledRef = React.useRef(disabled)
  disabledRef.current = disabled

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const onPressIn = useCallback(() => {
    if (disabledRef.current) return
    scale.value = withSpring(scaleTo, SPRING_CONFIG)
  }, [scale, scaleTo])

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG)
  }, [scale])

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      style={style}
    >
      <Animated.View style={[animatedStyle, pressedStyle]}>{children}</Animated.View>
    </Pressable>
  )
}
