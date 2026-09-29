import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import PressScale from '@/components/ui/PressScale'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'

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
  const colors = useColors()
  const { t } = useTranslation()
  const styles = makeStyles(colors)
  return (
    <PressScale onPress={onPress}>
      <View style={[styles.card, { backgroundColor: colors.white }, isPopular && { borderColor: colors.amber, borderWidth: 1 }]}>
        {isPopular && (
          <View style={[styles.badge, { backgroundColor: colors.amber }]}>
            <Ionicons name="flame" size={10} color="#fff" />
            <Text style={[styles.badgeText, { color: colors.white }]}>{t('home.hotOffersList.featured')}</Text>
          </View>
        )}
        <View style={styles.header}>
          <Text style={[styles.name, { color: colors.ink }]}>{name}</Text>
          <Text style={[styles.price, { color: colors.amberDark }]}>LKR {priceMin.toLocaleString()} - {priceMax.toLocaleString()}</Text>
        </View>
        <Text style={[styles.desc, { color: colors.muted }]} numberOfLines={2}>{description}</Text>
        <View style={styles.footer}>
          <View style={styles.meta}>
            <Ionicons name="time-outline" size={14} color={colors.muted} />
            <Text style={[styles.metaText, { color: colors.muted }]}>{typicalDurationMinutes} min</Text>
          </View>
          <View style={styles.meta}>
            <Ionicons name="cog-outline" size={14} color={colorHex} />
            <Text style={[styles.metaText, { color: colorHex }]}>{t('components.viewDetails')}</Text>
          </View>
        </View>
      </View>
    </PressScale>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    marginBottom: 8,
    gap: 4,
  },
  badgeText: { fontSize: 10, fontFamily: 'Outfit_700Bold' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontSize: 15, fontFamily: 'Outfit_800ExtraBold', flex: 1, marginRight: 8 },
  price: { fontSize: 13, fontFamily: 'Outfit_700Bold' },
  desc: { fontSize: 13, fontFamily: 'Outfit_500Medium', marginTop: 4, lineHeight: 18 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontFamily: 'Outfit_500Medium' },
})
