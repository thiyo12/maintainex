import React, { useEffect } from 'react'
import { View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { colors } from '../../lib/theme'
import { animations } from '../../lib/theme'

interface Props {
  name: keyof typeof Ionicons.glyphMap
  focused: boolean
  activeColor?: string
  inactiveColor?: string
}

export default function TabIcon({
  name,
  focused,
  activeColor = colors.accent,
  inactiveColor = colors.textMuted,
}: Props) {
  const scale = useSharedValue(1)

  useEffect(() => {
    scale.value = withSpring(focused ? 1.18 : 1, animations.spring)
  }, [focused, scale])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={animatedStyle}>
        <Ionicons name={name} size={23} color={focused ? activeColor : inactiveColor} />
      </Animated.View>
      {focused ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: activeColor, marginTop: 3 }} /> : null}
    </View>
  )
}