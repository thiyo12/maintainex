import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ArrowLeft, ArrowsOutSimple, Bathtub, Bed, Car, ChatCircle, Eye, Heart,
  House, MapPin, Phone, WarningCircle,
} from 'phosphor-react-native'

import { realEstate } from '../../lib/api'
import { v3 } from '../../theme/v3/tokens'

function money(value: unknown, countryCode?: string) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 'Price on request'
  return `${countryCode === 'CA' ? 'CAD' : 'LKR'} ${Math.round(n).toLocaleString()}`
}

export default function PropertyDetail() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [property, setProperty] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [favorited, setFavorited] = useState(false)
  const [contacting, setContacting] = useState(false)

  useEffect(() => {
    if (!id) return
    realEstate.get(id)
      .then((response: any) => setProperty(response?.data || response || null))
      .catch((error) => {
        console.error('Load property error:', error)
        setProperty(null)
      })
      .finally(() => setLoading(false))
  }, [id])

  const photos = useMemo(() => Array.isArray(property?.photos) ? property.photos : [], [property])
  const location = useMemo(
    () => [property?.area, property?.city, property?.district].filter(Boolean).join(', ') || property?.address || 'Location available on request',
    [property],
  )

  const toggleFavorite = async () => {
    if (!id) return
    try {
      const response: any = await realEstate.favorite(id)
      setFavorited(response?.favorited ?? response?.data?.favorited ?? !favorited)
    } catch (error: any) {
      Alert.alert('Could not save', error?.message || 'Please try again.')
    }
  }

  const requestViewing = async () => {
    if (!id) return
    try {
      await realEstate.inquiry(id, { type: 'viewing', message: 'I would like to request a viewing of this property.' })
      Alert.alert('Viewing requested', 'The owner has been notified.')
    } catch (error: any) {
      Alert.alert('Could not send request', error?.message || 'Please try again.')
    }
  }

  const startChat = async () => {
    if (!id || !property) return
    setContacting(true)
    try {
      const response: any = await realEstate.inquiry(id, {
        type: 'chat',
        message: `Hi, I'm interested in your property: ${property.title || 'Property'}`,
      })
      const conversationId = response?.conversationId || response?.data?.conversationId
      if (conversationId) router.push(`/(chat)/${conversationId}` as any)
      else Alert.alert('Message sent', 'The owner has received your inquiry.')
    } catch (error: any) {
      Alert.alert('Could not start chat', error?.message || 'Please try again.')
    } finally {
      setContacting(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={v3.colors.ink} />
      </SafeAreaView>
    )
  }

  if (!property) {
    return (
      <SafeAreaView style={styles.loading}>
        <WarningCircle size={42} color={v3.colors.ink} weight="fill" />
        <Text style={styles.notFoundTitle}>Property not found</Text>
        <TouchableOpacity style={styles.smallButton} onPress={() => router.back()}>
          <Text style={styles.smallButtonText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          {photos[0] ? (
            <Image source={{ uri: photos[0] }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={styles.heroFallback}><House size={52} color={v3.colors.textMuted} /></View>
          )}

          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.75} style={[styles.overlayButton, { left: 12 }]}>
            <ArrowLeft size={19} color={v3.colors.ink} weight="bold" />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleFavorite} activeOpacity={0.75} style={[styles.overlayButton, { right: 12 }]}>
            <Heart size={19} color={favorited ? v3.colors.error : v3.colors.ink} weight={favorited ? 'fill' : 'bold'} />
          </TouchableOpacity>

          <View style={styles.typeBadge}><Text style={styles.typeText}>{String(property.purpose || property.type || 'property').toUpperCase()}</Text></View>
          {property.isFeatured ? <View style={styles.featureBadge}><Text style={styles.featureText}>FEATURED</Text></View> : null}
          {photos.length ? <View style={styles.photoCount}><Text style={styles.photoCountText}>{photos.length} photos</Text></View> : null}
        </View>

        <View style={styles.body}>
          <Text style={styles.price}>{money(property.priceLkr, property.countryCode)}</Text>
          <Text style={styles.title}>{property.title || 'Property'}</Text>
          <View style={styles.locationRow}>
            <MapPin size={14} color={v3.colors.textSecondary} weight="fill" />
            <Text style={styles.location}>{location}</Text>
          </View>

          <View style={styles.statsLine}>
            {property.views != null ? (
              <View style={styles.inlineStat}><Eye size={13} color={v3.colors.textSecondary} /><Text style={styles.inlineStatText}>{property.views} views</Text></View>
            ) : null}
            {property.saves != null ? <Text style={styles.inlineStatText}>· {property.saves} saves</Text> : null}
          </View>

          <View style={styles.specGrid}>
            {property.bedrooms != null ? <Spec icon={Bed} value={property.bedrooms} label="Beds" /> : null}
            {property.bathrooms != null ? <Spec icon={Bathtub} value={property.bathrooms} label="Baths" /> : null}
            {property.areaSqft || property.propertySize ? <Spec icon={ArrowsOutSimple} value={property.areaSqft || property.propertySize} label="Sqft" /> : null}
            {property.parking != null ? <Spec icon={Car} value={property.parking} label="Parking" /> : null}
          </View>

          <Text style={styles.sectionTitle}>About this property</Text>
          <Text style={styles.description}>{property.description || 'The owner has not added a description yet.'}</Text>

          {Array.isArray(property.amenities) && property.amenities.length ? (
            <>
              <Text style={styles.sectionTitle}>Amenities</Text>
              <View style={styles.amenities}>
                {property.amenities.slice(0, 10).map((item: any) => (
                  <View key={String(item)} style={styles.amenity}><Text style={styles.amenityText}>{String(item)}</Text></View>
                ))}
              </View>
            </>
          ) : null}

          <View style={styles.ownerCard}>
            <View style={styles.ownerAvatar}><Text style={styles.ownerInitial}>{(property.contactName || 'P').charAt(0).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ownerName}>{property.contactName || 'Property owner'}</Text>
              <Text style={styles.ownerMeta}>Contact through MaintainEX to keep the inquiry recorded.</Text>
            </View>
          </View>

          <TouchableOpacity activeOpacity={0.82} style={styles.primary} onPress={requestViewing}>
            <Text style={styles.primaryText}>Request viewing</Text>
          </TouchableOpacity>
          <View style={styles.secondaryRow}>
            <TouchableOpacity activeOpacity={0.8} style={styles.secondary} onPress={startChat} disabled={contacting}>
              {contacting ? <ActivityIndicator size="small" color={v3.colors.ink} /> : <ChatCircle size={18} color={v3.colors.ink} weight="fill" />}
              <Text style={styles.secondaryText}>Message owner</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.secondary, !property.contactPhone && { opacity: 0.45 }]}
              disabled={!property.contactPhone}
              onPress={() => property.contactPhone && Linking.openURL(`tel:${property.contactPhone}`)}
            >
              <Phone size={18} color={v3.colors.ink} weight="fill" />
              <Text style={styles.secondaryText}>Call</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity activeOpacity={0.78} onPress={toggleFavorite} style={styles.saveLine}>
            <Heart size={17} color={v3.colors.ink} weight={favorited ? 'fill' : 'regular'} />
            <Text style={styles.saveLineText}>{favorited ? 'Saved to favorites' : 'Save this property to revisit later'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Spec({ icon: Icon, value, label }: { icon: any; value: any; label: string }) {
  return (
    <View style={styles.spec}>
      <Icon size={20} color={v3.colors.ink} weight="fill" />
      <Text style={styles.specValue}>{String(value)}</Text>
      <Text style={styles.specLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  scroll: { paddingBottom: 36 },
  loading: { flex: 1, backgroundColor: v3.colors.canvas, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 18, color: v3.colors.ink },
  smallButton: { height: 44, paddingHorizontal: 18, borderRadius: 14, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { fontFamily: 'Outfit_700Bold', fontSize: 13, color: v3.colors.paper },
  hero: { height: 300, backgroundColor: v3.colors.surfaceGray },
  heroImage: { width: '100%', height: '100%' },
  heroFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlayButton: { position: 'absolute', top: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center' },
  typeBadge: { position: 'absolute', left: 12, bottom: 12, height: 27, paddingHorizontal: 10, borderRadius: 10, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  typeText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 9.5, color: v3.colors.paper },
  featureBadge: { position: 'absolute', left: 86, bottom: 12, height: 27, paddingHorizontal: 10, borderRadius: 10, backgroundColor: v3.colors.amber, alignItems: 'center', justifyContent: 'center' },
  featureText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 9.5, color: v3.colors.ink },
  photoCount: { position: 'absolute', right: 12, bottom: 12, height: 27, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center' },
  photoCountText: { fontFamily: 'Outfit_700Bold', fontSize: 9.5, color: v3.colors.ink },
  body: { paddingHorizontal: 18, paddingTop: 18 },
  price: { fontFamily: 'Outfit_900Black', fontSize: 27, color: v3.colors.ink, letterSpacing: -0.4 },
  title: { marginTop: 5, fontFamily: 'Outfit_800ExtraBold', fontSize: 19, lineHeight: 25, color: v3.colors.ink },
  locationRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  location: { flex: 1, fontFamily: 'Outfit_500Medium', fontSize: 12, color: v3.colors.textSecondary },
  statsLine: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  inlineStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inlineStatText: { fontFamily: 'Outfit_500Medium', fontSize: 10.5, color: v3.colors.textMuted },
  specGrid: { marginTop: 18, flexDirection: 'row', gap: 8 },
  spec: { flex: 1, minHeight: 86, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  specValue: { marginTop: 5, fontFamily: 'Outfit_800ExtraBold', fontSize: 14, color: v3.colors.ink },
  specLabel: { marginTop: 1, fontFamily: 'Outfit_500Medium', fontSize: 9.5, color: v3.colors.textMuted },
  sectionTitle: { marginTop: 22, fontFamily: 'Outfit_800ExtraBold', fontSize: 16, color: v3.colors.ink },
  description: { marginTop: 7, fontFamily: 'Outfit_400Regular', fontSize: 12.5, lineHeight: 19, color: v3.colors.textSecondary },
  amenities: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  amenity: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line },
  amenityText: { fontFamily: 'Outfit_600SemiBold', fontSize: 10.5, color: v3.colors.ink },
  ownerCard: { marginTop: 22, padding: 14, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  ownerAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  ownerInitial: { fontFamily: 'Outfit_800ExtraBold', fontSize: 18, color: v3.colors.paper },
  ownerName: { fontFamily: 'Outfit_800ExtraBold', fontSize: 14, color: v3.colors.ink },
  ownerMeta: { marginTop: 3, fontFamily: 'Outfit_400Regular', fontSize: 10.5, lineHeight: 15, color: v3.colors.textSecondary },
  primary: { marginTop: 18, height: 56, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: v3.colors.paper },
  secondaryRow: { marginTop: 10, flexDirection: 'row', gap: 10 },
  secondary: { flex: 1, height: 50, borderRadius: 15, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secondaryText: { fontFamily: 'Outfit_700Bold', fontSize: 12, color: v3.colors.ink },
  saveLine: { marginTop: 14, minHeight: 48, borderRadius: 14, backgroundColor: v3.colors.amberSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12 },
  saveLineText: { fontFamily: 'Outfit_600SemiBold', fontSize: 11.5, color: v3.colors.ink },
})
