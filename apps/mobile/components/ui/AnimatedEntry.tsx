import React from 'react'
import { StyleProp, ViewStyle } from 'react-native'
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated'

interface Props {
  children: React.ReactNode
  delay?: number
  animation?: 'slideUp' | 'fadeIn' | 'scaleIn'
  style?: StyleProp<ViewStyle>
}

export default function AnimatedEntry({
  children,
  delay = 0,
  animation = 'slideUp',
  style,
}: Props) {
  const entering =
    animation === 'fadeIn'
      ? FadeIn.delay(delay).duration(300)
      : animation === 'scaleIn'
        ? ZoomIn.delay(delay).springify().damping(14).stiffness(200)
        : FadeInDown.delay(delay).springify().damping(20).stiffness(300)

  return <Animated.View entering={entering} style={style}>{children}</Animated.View>
}