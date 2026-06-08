import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { spacing } from '../../lib/tokens'

const GOLD = '#F59E0B'

interface Props {
  stars: number
  size?: number
  onRate?: (rating: number) => void
  readonly?: boolean
  starColor?: string
  emptyColor?: string
}

export default function StarRating({ stars, size = 18, onRate, readonly = false, starColor, emptyColor }: Props) {
  const animValues = useRef(Array.from({ length: 5 }, () => new Animated.Value(1))).current

  useEffect(() => {
    if (!readonly && stars > 0) {
      Animated.spring(animValues[stars - 1], {
        toValue: 1.3,
        friction: 3,
        tension: 100,
        useNativeDriver: true,
      }).start(() => {
        Animated.spring(animValues[stars - 1], {
          toValue: 1,
          friction: 3,
          useNativeDriver: true,
        }).start()
      })
    }
  }, [stars, readonly])

  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((i) => (
        <TouchableOpacity
          key={i}
          onPress={() => onRate?.(i)}
          disabled={readonly}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Animated.View
            style={[
              !readonly && { transform: [{ scale: animValues[i - 1] || 1 }] },
            ]}
          >
            <Text style={[
              styles.star,
              { fontSize: size },
              i <= stars ? { color: starColor || GOLD } : { color: emptyColor || '#E5E7EB' },
            ]}>
              ★
            </Text>
          </Animated.View>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 2 },
  star: {},
})
