import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native'
import { Image as ImageIcon, House, Star, MapPin, Bed, Drop, Car } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/lib/ThemeContext'

const SCREEN_W = Dimensions.get('window').width
const CARD_GAP = 12
const CARD_W = (SCREEN_W - 16 * 2 - CARD_GAP) / 2

interface Props {
  title: string
  priceLkr: number
  type: string
  countryCode?: string
  bedrooms?: number
  bathrooms?: number
  areaSqft?: number
  parking?: number
  location?: string
  isFurnished?: boolean
  isFeatured?: boolean
  boostTier?: string
  views?: number
  saves?: number
  photos?: string[]
  onPress: () => void
}

export default function PropertyCard({ title, priceLkr, type, countryCode, bedrooms, bathrooms, areaSqft, parking, location, isFurnished, isFeatured, boostTier, views, saves, photos, onPress }: Props) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const currency = countryCode === 'CA' ? 'CAD' : 'LKR'

  const TYPE_BADGES: Record<string, { label: string; bg: string; text: string }> = {
    sale: { label: 'SALE', bg: '#F5A623', text: '#111827' },
    rent: { label: 'RENT', bg: '#6366F1', text: '#FFFFFF' },
    commercial: { label: 'LEASE', bg: '#22C55E', text: '#FFFFFF' },
    land: { label: 'LAND', bg: '#7C3AED', text: '#FFFFFF' },
  }
  const badge = TYPE_BADGES[type] || TYPE_BADGES.sale
  const hasPhoto = photos && photos.length > 0

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.white, borderColor: colors.border }]} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.imageArea, { backgroundColor: colors.surface }]}>
        {hasPhoto ? (
          <View style={[styles.photoPlaceholder, { backgroundColor: colors.muted + '30' }]}>
            <ImageIcon size={28} color={colors.muted} />
          </View>
        ) : (
          <House size={28} color={colors.muted} />
        )}

        <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.typeBadgeText, { color: badge.text }]}>{badge.label}</Text>
        </View>

        {isFeatured && (
          <View style={[styles.featuredBadge]}>
            <Star size={8} color="#F5A623" weight="fill" />
            <Text style={styles.featuredBadgeText}>Featured</Text>
          </View>
        )}

        {boostTier && !isFeatured && (
          <View style={[styles.boostBadge]}>
            <Text style={styles.boostBadgeText}>{boostTier === 'top' ? 'Top' : 'Premium'}</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={[styles.price, { color: colors.amberDark }]} numberOfLines={1}>
          {currency} {priceLkr?.toLocaleString()}
        </Text>
        <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>{title}</Text>

        {location && (
          <View style={styles.locRow}>
            <MapPin size={9} color={colors.muted} />
            <Text style={[styles.locText, { color: colors.muted }]} numberOfLines={1}>{location}</Text>
          </View>
        )}

        <View style={styles.specs}>
          {bedrooms != null && (
            <View style={styles.spec}>
              <Bed size={10} color={colors.muted} />
              <Text style={[styles.specText, { color: colors.muted }]}>{bedrooms}</Text>
            </View>
          )}
          {bathrooms != null && (
            <View style={styles.spec}>
              <Drop size={10} color={colors.muted} />
              <Text style={[styles.specText, { color: colors.muted }]}>{bathrooms}</Text>
            </View>
          )}
          {parking != null && (
            <View style={styles.spec}>
              <Car size={10} color={colors.muted} />
              <Text style={[styles.specText, { color: colors.muted }]}>{parking}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  imageArea: {
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 100,
  },
  typeBadgeText: { fontSize: 9, fontFamily: 'Outfit_700Bold' },
  featuredBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  featuredBadgeText: { fontSize: 8, fontFamily: 'Outfit_700Bold', color: '#F5A623' },
  boostBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 100,
    backgroundColor: 'rgba(99,102,241,0.8)',
  },
  boostBadgeText: { fontSize: 8, fontFamily: 'Outfit_700Bold', color: '#FFF' },
  body: { padding: 10 },
  price: { fontSize: 14, fontFamily: 'Outfit_900Black', letterSpacing: -0.3 },
  title: { fontSize: 11, fontFamily: 'Outfit_700Bold', marginTop: 2 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  locText: { fontSize: 10, fontFamily: 'Outfit_400Regular', flex: 1 },
  specs: { flexDirection: 'row', gap: 8, marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  spec: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  specText: { fontSize: 10, fontFamily: 'Outfit_600SemiBold' },
})
