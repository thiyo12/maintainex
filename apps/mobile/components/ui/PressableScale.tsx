import React, { useCallback } from 'react'
import { Pressable, StyleProp, ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { animations } from '../../lib/design'

interface Props {
  children: React.ReactNode
  onPress?: () => void
  onLongPress?: () => void
  style?: StyleProp<ViewStyle>
  pressedStyle?: StyleProp<ViewStyle>
  scaleTo?: number
  disabled?: boolean
  activeOpacity?: never
  testID?: string
}

export default function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  pressedStyle,
  scaleTo = 0.96,
  disabled,
  testID,
}: Props) {
  const scale = useSharedValue(1)
  const disabledRef = React.useRef(disabled)
  disabledRef.current = disabled

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const onPressIn = useCallback(() => {
    if (disabledRef.current) return
    scale.value = withSpring(scaleTo, animations.spring)
  }, [scale, scaleTo])

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, animations.spring)
  }, [scale])

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      testID={testID}
      style={style}
    >
      <Animated.View style={[animatedStyle, pressedStyle]}>{children}</Animated.View>
    </Pressable>
  )
}