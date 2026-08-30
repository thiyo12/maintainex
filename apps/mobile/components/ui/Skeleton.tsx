import React, { useEffect } from 'react'
import { View, StyleSheet, StyleProp, ViewStyle, Dimensions } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, interpolate } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { colors, radius } from '../../lib/design'

interface Props {
  width?: number | `${number}%`
  height?: number
  radius?: number
  style?: StyleProp<ViewStyle>
}

export default function Skeleton({ width = '100%', height = 18, radius: r = radius.sm, style }: Props) {
  const progress = useSharedValue(0)
  const screenWidth = Dimensions.get('window').width

  useEffect(() => {
    progress.value = 0
    progress.value = withRepeat(withTiming(1, { duration: 1100 }), -1, false)
  }, [progress])

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [-screenWidth, screenWidth]),
      },
    ],
  }))

  return (
    <View
      style={[
        { width: width as any, height, borderRadius: r, backgroundColor: colors.surface, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, animStyle]}>
        <LinearGradient
          colors={['#15161E', '#2A2D3E', '#15161E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, width: screenWidth }}
        />
      </Animated.View>
    </View>
  )
}