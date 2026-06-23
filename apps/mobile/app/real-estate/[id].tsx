import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../lib/ThemeContext'
import { realEstate } from '../../lib/api'
import { fonts } from '../../lib/fonts'
import { spacing, fontSizes } from '../../lib/tokens'
import { useTranslation } from 'react-i18next'

export default function PropertyDetail() {
  const { t } = useTranslation()
  const TYPE_BADGES: Record<string, { label: string; color: string }> = {
    sale: { label: t('realEstate.forSale'), color: '#F59E0B' },
    rent: { label: t('realEstate.forRent'), color: '#6366F1' },
    commercial: { label: t('realEstate.commercial'), color: '#10B981' },
    land: { label: t('realEstate.land'), color: '#7C3AED' },
  }
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [property, setProperty] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    realEstate.get(id).then(d => {
      setProperty(d)
    }).catch(e => {
      console.error('Load property error:', e)
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.amber} />
      </SafeAreaView>
    )
  }

  if (!property) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', gap: spacing.sm }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.muted} />
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>{t('errors.notFound')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.ctaBtn, { backgroundColor: colors.amber }]}>
          <Text style={styles.ctaText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const badge = TYPE_BADGES[property.type] || TYPE_BADGES.sale

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Image header */}
        <View style={[styles.imageHero, { backgroundColor: colors.surface }]}>
          <Ionicons name="home-outline" size={64} color={colors.muted} />
          <View style={[styles.badge, { backgroundColor: badge.color }]}>
            <Text style={styles.badgeText}>{badge.label}</Text>
          </View>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back-outline" size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.favBtn}>
            <Ionicons name="heart-outline" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Price + title */}
          <Text style={[styles.price, { color: colors.amberDark }]}>
            LKR {property.priceLkr?.toLocaleString()}
          </Text>
          <Text style={[styles.title, { color: colors.ink }]}>{property.title}</Text>
          {property.location && (
            <View style={styles.locRow}>
              <Ionicons name="location-outline" size={14} color={colors.muted} />
              <Text style={[styles.locText, { color: colors.muted }]}>{property.location}</Text>
            </View>
          )}

          {/* Specs grid */}
          <View style={[styles.specsGrid, { backgroundColor: colors.surface }]}>
            {property.bedrooms && (
              <View style={styles.specItem}>
                <Ionicons name="bed-outline" size={18} color={colors.amber} />
                <Text style={[styles.specValue, { color: colors.ink }]}>{property.bedrooms}</Text>
                <Text style={[styles.specLabel, { color: colors.muted }]}>{t('realEstate.bedrooms')}</Text>
              </View>
            )}
            {property.bathrooms && (
              <View style={styles.specItem}>
                <Ionicons name="water-outline" size={18} color={colors.amber} />
                <Text style={[styles.specValue, { color: colors.ink }]}>{property.bathrooms}</Text>
                <Text style={[styles.specLabel, { color: colors.muted }]}>{t('realEstate.bathrooms')}</Text>
              </View>
            )}
            {property.areaSqft && (
              <View style={styles.specItem}>
                <Ionicons name="resize-outline" size={18} color={colors.amber} />
                <Text style={[styles.specValue, { color: colors.ink }]}>{property.areaSqft}</Text>
                <Text style={[styles.specLabel, { color: colors.muted }]}>{t('realEstate.sqFt')}</Text>
              </View>
            )}
            {property.isFurnished !== undefined && (
              <View style={styles.specItem}>
                <Ionicons name={property.isFurnished ? 'checkmark-circle-outline' : 'close-circle-outline'} size={18} color={property.isFurnished ? colors.success : colors.muted} />
                <Text style={[styles.specValue, { color: colors.ink }]}>{property.isFurnished ? t('common.yes') : t('common.no')}</Text>
                <Text style={[styles.specLabel, { color: colors.muted }]}>{t('realEstate.furnished')}</Text>
              </View>
            )}
          </View>

          {/* Description */}
          {property.description && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('postJob.description')}</Text>
              <Text style={[styles.description, { color: colors.muted }]}>{property.description}</Text>
            </View>
          )}

          {/* Features */}
          {property.features?.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('realEstate.features')}</Text>
              <View style={styles.featureList}>
                {property.features.map((f: string, i: number) => (
                  <View key={i} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                    <Text style={[styles.featureText, { color: colors.muted }]}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Contact */}
          {property.contactPhone && (
            <View style={[styles.contactBox, { backgroundColor: colors.amberBg, borderColor: colors.amber }]}>
              <Ionicons name="call-outline" size={18} color={colors.amberDark} />
              <Text style={[styles.contactText, { color: colors.ink }]}>{property.contactPhone}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.ctaBar, { backgroundColor: colors.white, borderTopColor: colors.border }]}>
        <View>
          <Text style={[styles.ctaPrice, { color: colors.amberDark }]}>LKR {property.priceLkr?.toLocaleString()}</Text>
          <Text style={[styles.ctaSub, { color: colors.muted }]}>
            {property.type === 'rent' ? t('realEstate.perMonth') : t('realEstate.totalPrice')}
          </Text>
        </View>
        <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: colors.amber }]}>
          <Text style={styles.ctaText}>{t('profile.contactUs')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 100 },
  imageHero: {
    height: 260,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute', top: 60, left: spacing.xl,
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 100,
  },
  badgeText: { fontSize: 11, fontFamily: fonts.bodyMedium, color: '#111827' },
  backBtn: {
    position: 'absolute', top: 16, left: spacing.lg,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  favBtn: {
    position: 'absolute', top: 16, right: spacing.lg,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  body: { padding: spacing.xl },
  price: { fontSize: fontSizes.h1, fontFamily: fonts.heading, letterSpacing: -0.5 },
  title: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, marginTop: spacing.xs },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  locText: { fontSize: fontSizes.bodySmall, fontFamily: fonts.body },
  specsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md,
    borderRadius: 16, padding: spacing.lg, marginTop: spacing.xl,
  },
  specItem: { alignItems: 'center', gap: 4, minWidth: '22%' },
  specValue: { fontSize: fontSizes.h3, fontFamily: fonts.heading },
  specLabel: { fontSize: fontSizes.captionSmall, fontFamily: fonts.body },
  section: { marginTop: spacing.xl },
  sectionTitle: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, marginBottom: spacing.sm },
  description: { fontSize: fontSizes.bodySmall, fontFamily: fonts.body, lineHeight: 22 },
  featureList: { gap: spacing.sm },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureText: { fontSize: fontSizes.bodySmall, fontFamily: fonts.body, flex: 1 },
  contactBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderRadius: 14, borderWidth: 1, padding: spacing.md, marginTop: spacing.xl,
  },
  contactText: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium },
  ctaBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderTopWidth: 1, position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  ctaPrice: { fontSize: fontSizes.h2, fontFamily: fonts.heading, letterSpacing: -0.3 },
  ctaSub: { fontSize: fontSizes.captionSmall, fontFamily: fonts.body, marginTop: 2 },
  ctaBtn: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 14 },
  ctaText: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, color: '#111827' },
})
