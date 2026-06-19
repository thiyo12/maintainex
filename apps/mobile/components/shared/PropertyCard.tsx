import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../lib/ThemeContext'

interface Props {
  title: string
  priceLkr: number
  type: string
  bedrooms?: number
  bathrooms?: number
  areaSqft?: number
  location?: string
  isFurnished?: boolean
  onPress: () => void
}

const TYPE_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  sale: { label: 'Sale', bg: '#F59E0B', text: '#111827' },
  rent: { label: 'Rent', bg: '#6366F1', text: '#FFFFFF' },
  commercial: { label: 'Commercial', bg: '#10B981', text: '#FFFFFF' },
  land: { label: 'Land', bg: '#7C3AED', text: '#FFFFFF' },
}

export default function PropertyCard({ title, priceLkr, type, bedrooms, bathrooms, areaSqft, location, onPress }: Props) {
  const { colors } = useTheme()
  const badge = TYPE_BADGES[type] || TYPE_BADGES.sale

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.white, borderColor: colors.border }]} onPress={onPress} activeOpacity={0.8}>
      {/* Image placeholder */}
      <View style={[styles.imageArea, { backgroundColor: colors.surface }]}>
        <Ionicons name="home-outline" size={32} color={colors.muted} />
        <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.typeBadgeText, { color: badge.text }]}>{badge.label}</Text>
        </View>
        <TouchableOpacity style={styles.heartBtn}>
          <Ionicons name="heart-outline" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={[styles.price, { color: colors.amberDark }]}>LKR {priceLkr.toLocaleString()}</Text>
        <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>{title}</Text>
        {location && (
          <View style={styles.locRow}>
            <Ionicons name="location-outline" size={10} color={colors.muted} />
            <Text style={[styles.locText, { color: colors.muted }]}>{location}</Text>
          </View>
        )}
        <View style={styles.specs}>
          {bedrooms && (
            <View style={styles.spec}>
              <Ionicons name="bed-outline" size={10} color={colors.muted} />
              <Text style={[styles.specText, { color: colors.muted }]}>{bedrooms} Bed</Text>
            </View>
          )}
          {bathrooms && (
            <View style={styles.spec}>
              <Ionicons name="water-outline" size={10} color={colors.muted} />
              <Text style={[styles.specText, { color: colors.muted }]}>{bathrooms} Bath</Text>
            </View>
          )}
          {areaSqft && (
            <View style={styles.spec}>
              <Ionicons name="resize-outline" size={10} color={colors.muted} />
              <Text style={[styles.specText, { color: colors.muted }]}>{areaSqft} sqft</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    minWidth: 210,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
    marginRight: 10,
  },
  imageArea: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  typeBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  typeBadgeText: { fontSize: 10, fontFamily: 'Outfit_700Bold' },
  heartBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: { padding: 10 },
  price: { fontSize: 15, fontFamily: 'Outfit_900Black', letterSpacing: -0.3 },
  title: { fontSize: 12, fontFamily: 'Outfit_800ExtraBold', marginTop: 2 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  locText: { fontSize: 10, fontFamily: 'Outfit_700Bold' },
  specs: { flexDirection: 'row', gap: 10, marginTop: 6 },
  spec: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  specText: { fontSize: 10, fontFamily: 'Outfit_700Bold' },
})
