import { useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../lib/ThemeContext'
import { useCountry } from '../../lib/country'
import { seasonalOffers } from '../../lib/api'
import { getCurrentSeason, getSeasonEmoji, type SeasonalOffer } from '../../lib/seasonal'
import { fonts } from '../../lib/fonts'

interface Props {
  onOfferPress?: (offer: SeasonalOffer) => void
  onServicePress?: (jobId: string, jobName: string) => void
}

export default function SeasonalOffers({ onOfferPress, onServicePress }: Props) {
  const colors = useColors()
  const { t } = useTranslation()
  const { selectedCountry } = useCountry()
  const styles = makeStyles(colors)
  const [offers, setOffers] = useState<SeasonalOffer[]>([])
  const [loading, setLoading] = useState(true)

  const countryCode = selectedCountry?.code || 'LK'

  const fetchOffers = useCallback(async () => {
    try {
      setLoading(true)
      const season = getCurrentSeason()
      const data = await seasonalOffers.list(countryCode, season)
      setOffers(data)
    } catch {
      setOffers([])
    } finally {
      setLoading(false)
    }
  }, [countryCode])

  useEffect(() => {
    fetchOffers()
  }, [fetchOffers])

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.amber} />
      </View>
    )
  }

  if (offers.length === 0) return null

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.ink }]}>{t('home.seasonalOffers')}</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          {getSeasonEmoji(getCurrentSeason())} {getCurrentSeason().charAt(0).toUpperCase() + getCurrentSeason().slice(1)}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {offers.map((offer) => (
          <TouchableOpacity
            key={offer.id}
            style={[styles.card, { backgroundColor: offer.bgColor || colors.amber }]}
            onPress={() => onOfferPress?.(offer)}
            activeOpacity={0.85}
          >
            <Text style={[styles.cardTitle, { color: offer.textColor || '#FFFFFF' }]}>
              {getSeasonEmoji(offer.season)} {offer.title}
            </Text>
            {offer.description && (
              <Text style={[styles.cardDesc, { color: offer.textColor || '#FFFFFF' }]} numberOfLines={2}>
                {offer.description}
              </Text>
            )}
            {offer.badgeText && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{offer.badgeText}</Text>
              </View>
            )}
            {offer.jobs.length > 0 && (
              <View style={styles.jobsRow}>
                {offer.jobs.slice(0, 3).map((j) => (
                  <TouchableOpacity
                    key={j.templateJob.id}
                    style={styles.jobChip}
                    onPress={() => onServicePress?.(j.templateJob.id, j.templateJob.name)}
                  >
                    <Text style={styles.jobChipText}>{j.templateJob.name}</Text>
                  </TouchableOpacity>
                ))}
                {offer.jobs.length > 3 && (
                  <Text style={[styles.moreText, { color: offer.textColor || '#FFFFFF' }]}>
                    +{offer.jobs.length - 3}
                  </Text>
                )}
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontFamily: fonts?.heading || 'Inter_600SemiBold',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: fonts?.body || 'Inter_400Regular',
  },
  scroll: {
    paddingHorizontal: 12,
    gap: 10,
  },
  card: {
    width: 240,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: fonts?.heading || 'Inter_600SemiBold',
  },
  cardDesc: {
    fontSize: 12,
    fontFamily: fonts?.body || 'Inter_400Regular',
    opacity: 0.85,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: fonts?.bodyMedium || 'Inter_500Medium',
    color: '#FFFFFF',
  },
  jobsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  jobChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  jobChipText: {
    fontSize: 11,
    fontFamily: fonts?.body || 'Inter_400Regular',
    color: '#FFFFFF',
  },
  moreText: {
    fontSize: 11,
    fontFamily: fonts?.body || 'Inter_400Regular',
    opacity: 0.7,
    alignSelf: 'center',
  },
})
