import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CaretLeft, Heart, WarningCircle, House, Image, MapPin, Eye, Bed, Bathtub, ArrowsOutSimple, Car, CheckCircle, XCircle, Calendar, Phone, ChatCircle, CaretRight } from 'phosphor-react-native'
import { useTheme } from '../../lib/ThemeContext'
import { realEstate, conversations } from '../../lib/api'
import { fonts } from '../../lib/fonts'
import { spacing, fontSizes } from '../../lib/tokens'

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  sale: { label: 'For Sale', color: '#F5A623' },
  rent: { label: 'For Rent', color: '#6366F1' },
  commercial: { label: 'Commercial', color: '#10B981' },
  land: { label: 'Land', color: '#7C3AED' },
}

export default function PropertyDetail() {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [property, setProperty] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [favorited, setFavorited] = useState(false)
  const [contacting, setContacting] = useState(false)

  useEffect(() => {
    if (!id) return
    realEstate.get(id).then(d => {
      const data = d?.data || d
      setProperty(data)
    }).catch(e => {
      console.error('Load property error:', e)
    }).finally(() => setLoading(false))
  }, [id])

  const handleFavorite = async () => {
    if (!id) return
    try {
      const res = await realEstate.favorite(id)
      setFavorited(res?.favorited ?? !favorited)
    } catch {}
  }

  const handleChat = async () => {
    if (!id || !property) return
    setContacting(true)
    try {
      const res = await realEstate.inquiry(id, {
        type: 'chat',
        message: `Hi, I'm interested in your property: ${property.title}`,
      })
      const conversationId = res?.conversationId || res?.data?.conversationId
      if (conversationId) {
        router.push(`/(chat)/${conversationId}`)
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to start chat')
    } finally {
      setContacting(false)
    }
  }

  const handleCall = () => {
    if (property?.contactPhone) {
      Linking.openURL(`tel:${property.contactPhone}`)
    }
  }

  const handleRequestViewing = async () => {
    if (!id) return
    try {
      await realEstate.inquiry(id, { type: 'viewing', message: 'I would like to request a viewing of this property.' })
      Alert.alert('Request Sent', 'The seller will be notified of your viewing request.')
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to send request')
    }
  }

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
        <WarningCircle size={48} color={colors.muted} weight="regular" />
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Property not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.ctaBtn, { backgroundColor: colors.amber }]}>
          <Text style={styles.ctaText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const badge = TYPE_BADGES[property.purpose || property.type] || TYPE_BADGES.sale
  const currency = property.countryCode === 'CA' ? 'CAD' : 'Rs.'
  const location = [property.area, property.city, property.district].filter(Boolean).join(', ') || property.address

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Image hero */}
        <View style={[styles.imageHero, { backgroundColor: colors.surface }]}>
          {property.photos?.length > 0 ? (
            <View style={styles.imagePlaceholder}>
              <Image size={48} color={colors.muted} weight="regular" />
              <Text style={[styles.imageCount, { color: colors.muted }]}>{property.photos.length} photos</Text>
            </View>
          ) : (
            <House size={64} color={colors.muted} weight="regular" />
          )}

          {/* Badges */}
          <View style={[styles.badge, { backgroundColor: badge.color }]}>
            <Text style={styles.badgeText}>{badge.label}</Text>
          </View>

          {property.isFeatured && (
            <View style={[styles.badge, styles.featuredBadge]}>
              <Text style={styles.badgeText}>Featured</Text>
            </View>
          )}

          {property.boostTier && (
            <View style={[styles.badge, styles.boostBadge]}>
              <Text style={styles.badgeText}>{property.boostTier === 'top' ? 'Top Pick' : property.boostTier === 'premium' ? 'Premium' : 'Featured'}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <CaretLeft size={22} color="#FFF" weight="regular" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.favBtn} onPress={handleFavorite}>
            <Heart size={20} color={favorited ? '#EF4444' : '#FFF'} weight={favorited ? 'fill' : 'regular'} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Price + title */}
          <Text style={[styles.price, { color: colors.amberDark }]}>
            {currency} {property.priceLkr?.toLocaleString()}
          </Text>
          {property.pricePer && (
            <Text style={[styles.pricePer, { color: colors.muted }]}>/{property.pricePer}</Text>
          )}
          <Text style={[styles.title, { color: colors.ink }]}>{property.title}</Text>

          {location ? (
            <View style={styles.locRow}>
              <MapPin size={14} color={colors.muted} weight="regular" />
              <Text style={[styles.locText, { color: colors.muted }]}>{location}</Text>
            </View>
          ) : null}

          {/* View count */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Eye size={14} color={colors.muted} weight="regular" />
              <Text style={[styles.statText, { color: colors.muted }]}>{property.views || 0} views</Text>
            </View>
            <View style={styles.statItem}>
              <Heart size={14} color={colors.muted} weight="regular" />
              <Text style={[styles.statText, { color: colors.muted }]}>{property.saves || 0} saves</Text>
            </View>
          </View>

          {/* Specs grid */}
          <View style={[styles.specsGrid, { backgroundColor: colors.surface }]}>
            {property.bedrooms != null && (
              <View style={styles.specItem}>
                <Bed size={18} color={colors.amber} weight="regular" />
                <Text style={[styles.specValue, { color: colors.ink }]}>{property.bedrooms}</Text>
                <Text style={[styles.specLabel, { color: colors.muted }]}>Beds</Text>
              </View>
            )}
            {property.bathrooms != null && (
              <View style={styles.specItem}>
                <Bathtub size={18} color={colors.amber} weight="regular" />
                <Text style={[styles.specValue, { color: colors.ink }]}>{property.bathrooms}</Text>
                <Text style={[styles.specLabel, { color: colors.muted }]}>Baths</Text>
              </View>
            )}
            {(property.areaSqft || property.propertySize) && (
              <View style={styles.specItem}>
                <ArrowsOutSimple size={18} color={colors.amber} weight="regular" />
                <Text style={[styles.specValue, { color: colors.ink }]}>{property.areaSqft || property.propertySize}</Text>
                <Text style={[styles.specLabel, { color: colors.muted }]}>Sqft</Text>
              </View>
            )}
            {property.parking != null && (
              <View style={styles.specItem}>
                <Car size={18} color={colors.amber} weight="regular" />
                <Text style={[styles.specValue, { color: colors.ink }]}>{property.parking}</Text>
                <Text style={[styles.specLabel, { color: colors.muted }]}>Parking</Text>
              </View>
            )}
            {property.isFurnished !== undefined && (
              <View style={styles.specItem}>
                {property.isFurnished ? (
                  <CheckCircle size={18} color="#10B981" weight="regular" />
                ) : (
                  <XCircle size={18} color={colors.muted} weight="regular" />
                )}
                <Text style={[styles.specValue, { color: colors.ink }]}>{property.isFurnished ? 'Yes' : 'No'}</Text>
                <Text style={[styles.specLabel, { color: colors.muted }]}>Furnished</Text>
              </View>
            )}
            {property.yearBuilt && (
              <View style={styles.specItem}>
                <Calendar size={18} color={colors.amber} weight="regular" />
                <Text style={[styles.specValue, { color: colors.ink }]}>{property.yearBuilt}</Text>
                <Text style={[styles.specLabel, { color: colors.muted }]}>Year</Text>
              </View>
            )}
          </View>

          {/* Description */}
          {property.description && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>Description</Text>
              <Text style={[styles.description, { color: colors.muted }]}>{property.description}</Text>
            </View>
          )}

          {/* Amenities */}
          {property.amenities?.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>Features & Amenities</Text>
              <View style={styles.featureList}>
                {property.amenities.map((f: string, i: number) => (
                  <View key={i} style={styles.featureRow}>
                    <CheckCircle size={14} color="#10B981" weight="fill" />
                    <Text style={[styles.featureText, { color: colors.muted }]}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Contact */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>Contact Seller</Text>

            {/* Listed By Card */}
            <View style={[styles.sellerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.sellerAvatar, { backgroundColor: colors.amber }]}>
                <Text style={styles.sellerAvatarText}>{(property.contactName || 'S')[0].toUpperCase()}</Text>
              </View>
              <View style={styles.sellerInfo}>
                <Text style={[styles.sellerName, { color: colors.ink }]}>{property.contactName || 'Property Owner'}</Text>
                <Text style={[styles.sellerRole, { color: colors.muted }]}>Private Owner · Member since {new Date(property.createdAt).getFullYear()}</Text>
              </View>
              {property.contactPhone && (
                <TouchableOpacity style={[styles.sellerCallBtn, { backgroundColor: '#10B98120' }]} onPress={handleCall}>
                  <Phone size={16} color="#10B981" weight="regular" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={[styles.contactAction, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleChat} disabled={contacting}>
              {contacting ? <ActivityIndicator size="small" color={colors.amber} /> : <ChatCircle size={18} color={colors.amber} weight="regular" />}
              <Text style={[styles.contactActionText, { color: colors.ink }]}>Chat with Owner</Text>
              <CaretRight size={16} color={colors.muted} weight="regular" />
            </TouchableOpacity>

            {property.contactPhone && (
              <TouchableOpacity style={[styles.contactAction, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleCall}>
                <Phone size={18} color="#10B981" weight="regular" />
                <Text style={[styles.contactActionText, { color: colors.ink }]}>Call {property.contactName || 'Owner'}</Text>
                <CaretRight size={16} color={colors.muted} weight="regular" />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.contactAction, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleRequestViewing}>
              <Calendar size={18} color="#6366F1" weight="regular" />
              <Text style={[styles.contactActionText, { color: colors.ink }]}>Request Viewing</Text>
              <CaretRight size={16} color={colors.muted} weight="regular" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.ctaBar, { backgroundColor: colors.white, borderTopColor: colors.border }]}>
        <View style={styles.ctaPriceWrap}>
          <Text style={[styles.ctaPrice, { color: colors.amberDark }]}>{currency} {property.priceLkr?.toLocaleString()}</Text>
          {property.pricePer && <Text style={[styles.ctaSub, { color: colors.muted }]}>/{property.pricePer}</Text>}
        </View>
        <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: colors.amber }]} onPress={handleChat} disabled={contacting}>
          <Text style={styles.ctaText}>{contacting ? 'Sending...' : 'Contact Owner'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 100 },
  imageHero: { height: 260, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  imagePlaceholder: { alignItems: 'center', gap: 8 },
  imageCount: { fontSize: 12, fontFamily: fonts.body },
  badge: { position: 'absolute', top: 60, left: spacing.xl, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 100 },
  featuredBadge: { top: 60, left: spacing.xl + 80, backgroundColor: '#FCD34D' },
  boostBadge: { top: 60, left: spacing.xl + 170, backgroundColor: '#818CF8' },
  badgeText: { fontSize: 11, fontFamily: fonts.bodyMedium, color: '#111827' },
  backBtn: { position: 'absolute', top: 16, left: spacing.lg, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  favBtn: { position: 'absolute', top: 16, right: spacing.lg, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  body: { padding: spacing.xl },
  price: { fontSize: fontSizes.h1, fontFamily: fonts.heading, letterSpacing: -0.5 },
  pricePer: { fontSize: fontSizes.caption, fontFamily: fonts.body, marginTop: 2 },
  title: { fontSize: fontSizes.h3, fontFamily: fonts.bodyMedium, marginTop: spacing.xs },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  locText: { fontSize: fontSizes.bodySmall, fontFamily: fonts.body },
  statsRow: { flexDirection: 'row', gap: 16, marginTop: spacing.sm },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: fontSizes.captionSmall, fontFamily: fonts.body },
  specsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, borderRadius: 16, padding: spacing.lg, marginTop: spacing.xl },
  specItem: { alignItems: 'center', gap: 4, minWidth: '22%' },
  specValue: { fontSize: fontSizes.h3, fontFamily: fonts.heading },
  specLabel: { fontSize: fontSizes.captionSmall, fontFamily: fonts.body },
  section: { marginTop: spacing.xl },
  sectionTitle: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, marginBottom: spacing.sm },
  sectionLabel: { fontSize: fontSizes.body, fontFamily: fonts.body },
  description: { fontSize: fontSizes.bodySmall, fontFamily: fonts.body, lineHeight: 22 },
  featureList: { gap: spacing.sm },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureText: { fontSize: fontSizes.bodySmall, fontFamily: fonts.body, flex: 1 },
  contactAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: 14, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  contactActionText: { flex: 1, fontSize: fontSizes.body, fontFamily: fonts.bodyMedium },
  sellerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: 14, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md },
  sellerAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sellerAvatarText: { fontSize: 18, fontFamily: fonts.heading, color: '#111' },
  sellerInfo: { flex: 1 },
  sellerName: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium },
  sellerRole: { fontSize: fontSizes.captionSmall, fontFamily: fonts.body, marginTop: 2 },
  sellerCallBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  ctaBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderTopWidth: 1, position: 'absolute', bottom: 0, left: 0, right: 0 },
  ctaPriceWrap: { flex: 1 },
  ctaPrice: { fontSize: fontSizes.h2, fontFamily: fonts.heading, letterSpacing: -0.3 },
  ctaSub: { fontSize: fontSizes.captionSmall, fontFamily: fonts.body, marginTop: 2 },
  ctaBtn: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 14 },
  ctaText: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, color: '#111827' },
})
