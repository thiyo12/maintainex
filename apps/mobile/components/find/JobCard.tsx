import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import PressScale from './PressScale'

interface Props {
  name: string
  description: string
  priceMin: number
  priceMax: number
  typicalDurationMinutes: number
  isPopular: boolean
  colorHex: string
  onPress: () => void
}

export default function JobCard({ name, description, priceMin, priceMax, typicalDurationMinutes, isPopular, colorHex, onPress }: Props) {
  return (
    <PressScale onPress={onPress}>
      <View style={[styles.card, isPopular && { borderColor: colors.primary, borderWidth: 1 }]}>
        {isPopular && (
          <View style={styles.badge}>
            <Ionicons name="flame" size={10} color="#fff" />
            <Text style={styles.badgeText}>Popular</Text>
          </View>
        )}
        <View style={styles.header}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.price}>Rs {priceMin.toLocaleString()} - {priceMax.toLocaleString()}</Text>
        </View>
        <Text style={styles.desc} numberOfLines={2}>{description}</Text>
        <View style={styles.footer}>
          <View style={styles.meta}>
            <Ionicons name="time-outline" size={14} color="#9CA3AF" />
            <Text style={styles.metaText}>{typicalDurationMinutes} min</Text>
          </View>
          <View style={styles.meta}>
            <Ionicons name="cog-outline" size={14} color={colorHex} />
            <Text style={[styles.metaText, { color: colorHex }]}>View Details</Text>
          </View>
        </View>
      </View>
    </PressScale>
  )
}

import { colors } from '../../lib/colors'

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
    gap: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontSize: 15, fontWeight: '600', color: '#1F2937', flex: 1, marginRight: 8 },
  price: { fontSize: 13, fontWeight: '600', color: '#059669' },
  desc: { fontSize: 13, color: '#6B7280', marginTop: 4, lineHeight: 18 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#9CA3AF' },
})
