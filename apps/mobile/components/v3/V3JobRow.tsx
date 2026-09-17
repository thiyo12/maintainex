import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { CaretRight, Flame } from 'phosphor-react-native'
import { v3 } from '../../theme/v3/tokens'

interface Props {
  name: string
  description?: string
  priceMin: number
  priceMax: number
  durationMinutes?: number
  isPopular?: boolean
  onPress: () => void
}

export default function V3JobRow({ name, description, priceMin, priceMax, durationMinutes, isPopular, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {isPopular ? (
        <View style={styles.popularBadge}>
          <Flame size={10} color={v3.colors.paper} weight="fill" />
          <Text style={styles.popularText}>Popular</Text>
        </View>
      ) : null}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {description ? <Text style={styles.desc} numberOfLines={2}>{description}</Text> : null}
        </View>
        <CaretRight size={16} color={v3.colors.textMuted} weight="bold" />
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.price}>LKR {priceMin.toLocaleString()} – {priceMax.toLocaleString()}</Text>
        {durationMinutes ? <Text style={styles.duration}>{durationMinutes} min</Text> : null}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: v3.colors.surfaceWhite,
    borderWidth: 1,
    borderColor: v3.colors.line,
    borderRadius: v3.radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: v3.colors.amber,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: v3.radius.full,
    marginBottom: 8,
  },
  popularText: {
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.paper,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 13.5,
    fontFamily: 'Outfit_800ExtraBold',
    color: v3.colors.textPrimary,
  },
  desc: {
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
    color: v3.colors.textSecondary,
    marginTop: 4,
    lineHeight: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  price: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.amber,
  },
  duration: {
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
    color: v3.colors.textMuted,
  },
})
