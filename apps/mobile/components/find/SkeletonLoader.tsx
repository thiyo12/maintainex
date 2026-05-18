import { View, Animated, StyleSheet, useWindowDimensions } from 'react-native'
import { useEffect, useRef } from 'react'

interface Props {
  count?: number
  height?: number
}

export default function SkeletonLoader({ count = 5, height = 80 }: Props) {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [])

  const { width } = useWindowDimensions()

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View key={i} style={[styles.skeleton, { height, opacity, width: width - 32 }]} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, gap: 10, paddingTop: 8 },
  skeleton: { backgroundColor: '#E5E7EB', borderRadius: 12 },
})
