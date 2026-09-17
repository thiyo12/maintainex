import React, { useEffect } from 'react'
import { View, StyleSheet, StyleProp, ViewStyle, Dimensions } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, interpolate } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'

interface Props {
  width?: number | `${number}%`
  height?: number
  radius?: number
  style?: StyleProp<ViewStyle>
}

export default function Skeleton({ width = '100%', height = 18, radius: r = 8, style }: Props) {
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
        { width: width as any, height, borderRadius: r, backgroundColor: '#1C1C1C', overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, animStyle]}>
        <LinearGradient
          colors={['#1C1C1C', '#2E2E2E', '#1C1C1C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, width: screenWidth }}
        />
      </Animated.View>
    </View>
  )
}
