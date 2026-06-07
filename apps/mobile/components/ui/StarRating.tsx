import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { useColors } from '../../lib/ThemeContext'
import { spacing } from '../../lib/tokens'

interface Props {
  stars: number
  size?: number
  onRate?: (rating: number) => void
  readonly?: boolean
}

const GOLD = '#EAB308'

export default function StarRating({ stars, size = 32, onRate, readonly = false }: Props) {
  const colors = useColors()
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
        >
          <Animated.View
            style={[
              styles.starWrap,
              !readonly && { transform: [{ scale: animValues[i - 1] || 1 }] },
            ]}
          >
            <Text style={[styles.star, { fontSize: size }, i <= stars && { color: GOLD },
              i > stars && { color: colors.muted },
            ]}>
              {i <= stars ? '★' : '☆'}
            </Text>
          </Animated.View>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: spacing.xs },
  starWrap: { padding: spacing.xs },
  star: {},
})
