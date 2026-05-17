import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  white: '#FFFFFF',
}

interface Props {
  stars: number
  size?: number
  onRate?: (rating: number) => void
  readonly?: boolean
}

export default function StarRating({ stars, size = 32, onRate, readonly = false }: Props) {
  const animValues = useRef(stars.map(() => new Animated.Value(1))).current

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
  }, [stars])

  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((i) => (
        <TouchableOpacity
          key={i}
          onPress={() => onRate?.(i)}
          disabled={readonly}
          activeOpacity={0.7}
        >
          <Animated.View
            style={[
              styles.starWrap,
              readonly && i <= stars && styles.starFilled,
              !readonly && { transform: [{ scale: animValues[i - 1] || 1 }] },
            ]}
          >
            <Text style={[styles.star, { fontSize: size }, i <= stars && styles.starActive]}>
              {i <= stars ? '★' : '☆'}
            </Text>
          </Animated.View>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 4 },
  starWrap: { padding: 2 },
  starFilled: { opacity: 1 },
  star: { color: colors.gray },
  starActive: { color: '#F59E0B' },
})
