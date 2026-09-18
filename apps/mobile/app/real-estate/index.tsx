import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator, FlatList, Image, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Buildings, CaretRight, Heart, House, List, MagnifyingGlass, MapPin, Plus,
} from 'phosphor-react-native'

import { realEstate } from '../../lib/api'
import { v3 } from '../../theme/v3/tokens'
import V3CustomerBottomNav from '../../components/v3/V3CustomerBottomNav'

const MODES = [
  { key: 'rent', label: 'Rent' },
  { key: 'sale', label: 'Buy' },
  { key: 'commercial', label: 'Commercial' },
  { key: 'land', label: 'Land' },
] as const

function money(value: unknown, countryCode?: string) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 'Price on request'
  return `${countryCode === 'CA' ? 'CAD' : 'LKR'} ${Math.round(n).toLocaleString()}`
}

function photoOf(item: any) {
  const photos = Array.isArray(item?.photos) ? item.photos : []
  return photos[0] || item?.imageUrl || item?.photoUrl || null
}

export default function PropertyHub() {
  const router = useRouter()
  const [mode, setMode] = useState<(typeof MODES)[number]['key']>('rent')
  const [query, setQuery] = useState('')
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const response: any = await realEstate.list({
        status: 'approved',
        purpose: mode,
        q: query.trim() || undefined,
        sortBy: 'newest',
      })
      const list = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : []
      setProperties(list)
    } catch (error) {
      console.error('Load real estate error:', error)
      setProperties([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [mode, query])

  useEffect(() => {
    const timer = setTimeout(() => load(), query ? 320 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  const featured = useMemo(
    () => properties.find((item) => item.isFeatured || item.boostTier) || properties[0] || null,
    [properties],
  )
  const rest = useMemo(
    () => properties.filter((item) => item.id !== featured?.id),
    [properties, featured],
  )

  const open = (item: any) => router.push(`/real-estate/${item.id}` as any)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={rest}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={v3.colors.ink} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Stay & property</Text>
                <Text style={styles.subtitle}>Rent first. Buy, commercial and land stay one tap away.</Text>
              </View>
              <TouchableOpacity activeOpacity={0.72} style={styles.iconBtn} onPress={() => router.push('/real-estate/favorites' as any)}>
                <Heart size={18} color={v3.colors.ink} weight="bold" />
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.72} style={styles.iconBtn} onPress={() => router.push('/real-estate/my-listings' as any)}>
                <List size={18} color={v3.colors.ink} weight="bold" />
              </TouchableOpacity>
            </View>

            <View style={styles.search}>
              <MagnifyingGlass size={18} color={v3.colors.ink} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Where do you need a place?"
                placeholderTextColor={v3.colors.textPlaceholder}
                style={styles.searchInput}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRow}>
              {MODES.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={0.75}
                  onPress={() => setMode(item.key)}
                  style={[styles.modeChip, mode === item.key && styles.modeChipActive]}
                >
                  <Text style={[styles.modeText, mode === item.key && styles.modeTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.hero}>
              <Text style={styles.eyebrow}>{mode === 'rent' ? 'NEED A PLACE?' : 'PROPERTY SEARCH'}</Text>
              <Text style={styles.heroTitle}>
                {mode === 'rent' ? 'Find a place without the clutter.' : 'Browse verified property listings.'}
              </Text>
              <Text style={styles.heroText}>Search by location, open the listing and contact the owner from one flow.</Text>
            </View>

            {loading ? (
              <View style={styles.loading}><ActivityIndicator color={v3.colors.ink} /></View>
            ) : featured ? (
              <>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionTitle}>Featured</Text>
                  <Text style={styles.sectionMeta}>{properties.length} result{properties.length === 1 ? '' : 's'}</Text>
                </View>
                <TouchableOpacity activeOpacity={0.82} style={styles.featuredCard} onPress={() => open(featured)}>
                  <View style={styles.featuredImageWrap}>
                    {photoOf(featured) ? (
                      <Image source={{ uri: photoOf(featured) }} style={styles.image} resizeMode="cover" />
                    ) : (
                      <View style={styles.photoFallback}><House size={38} color={v3.colors.textMuted} /></View>
                    )}
                    <View style={styles.purposeBadge}><Text style={styles.purposeBadgeText}>{String(featured.purpose || mode).toUpperCase()}</Text></View>
                    {featured.isFeatured ? <View style={styles.featuredBadge}><Text style={styles.featuredBadgeText}>FEATURED</Text></View> : null}
                  </View>
                  <View style={styles.featuredBody}>
                    <Text style={styles.price}>{money(featured.priceLkr, featured.countryCode)}</Text>
                    <Text style={styles.propertyTitle} numberOfLines={1}>{featured.title || 'Property'}</Text>
                    <View style={styles.locationRow}>
                      <MapPin size={13} color={v3.colors.textSecondary} />
                      <Text style={styles.locationText} numberOfLines={1}>
                        {[featured.area, featured.city, featured.district].filter(Boolean).join(', ') || 'Location available in listing'}
                      </Text>
                    </View>
                    <View style={styles.specRow}>
                      {featured.bedrooms != null ? <Text style={styles.spec}>{featured.bedrooms} bed</Text> : null}
                      {featured.bathrooms != null ? <Text style={styles.spec}>{featured.bathrooms} bath</Text> : null}
                      {featured.areaSqft ? <Text style={styles.spec}>{featured.areaSqft} sqft</Text> : null}
                    </View>
                  </View>
                </TouchableOpacity>
              </>
            ) : null}

            <TouchableOpacity activeOpacity={0.82} style={styles.listYours} onPress={() => router.push('/real-estate/upload' as any)}>
              <View style={styles.listYoursIcon}><Plus size={20} color={v3.colors.ink} weight="bold" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listYoursTitle}>List your place</Text>
                <Text style={styles.listYoursText}>Create a rental, sale, commercial or land listing.</Text>
              </View>
              <CaretRight size={18} color={v3.colors.ink} weight="bold" />
            </TouchableOpacity>

            {rest.length ? (
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>More properties</Text>
                <Text style={styles.sectionMeta}>Newest first</Text>
              </View>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.82} style={styles.card} onPress={() => open(item)}>
            <View style={styles.cardImageWrap}>
              {photoOf(item) ? <Image source={{ uri: photoOf(item) }} style={styles.image} resizeMode="cover" /> : (
                <View style={styles.photoFallback}><Buildings size={28} color={v3.colors.textMuted} /></View>
              )}
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardPrice}>{money(item.priceLkr, item.countryCode)}</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title || 'Property'}</Text>
              <Text style={styles.cardLocation} numberOfLines={1}>{[item.area, item.city, item.district].filter(Boolean).join(', ') || 'View location'}</Text>
            </View>
            <CaretRight size={17} color={v3.colors.textMuted} weight="bold" />
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <House size={34} color={v3.colors.ink} weight="fill" />
            <Text style={styles.emptyTitle}>No matching properties</Text>
            <Text style={styles.emptyText}>Try another property type or a broader location search.</Text>
          </View>
        ) : null}
        ListFooterComponent={<View style={{ height: 110 }} />}
      />

      <V3CustomerBottomNav
        activeTab="explore"
        onTabPress={(tab) => {
          if (tab === 'home') router.push('/(customer)/(tabs)' as any)
          else if (tab === 'explore') router.push('/(customer)/find' as any)
          else router.push(`/(customer)/(tabs)/${tab}` as any)
        }}
        onPostJob={() => router.push('/(customer)/jobs/v2/create' as any)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  list: { paddingHorizontal: 18, paddingBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8 },
  title: { fontFamily: 'Outfit_900Black', fontSize: 28, color: v3.colors.ink, letterSpacing: -0.4 },
  subtitle: { marginTop: 3, fontFamily: 'Outfit_400Regular', fontSize: 11.5, lineHeight: 16, color: v3.colors.textSecondary },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  search: { marginTop: 16, height: 54, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  searchInput: { flex: 1, marginLeft: 10, fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: v3.colors.ink },
  modeRow: { paddingTop: 10, paddingBottom: 2, gap: 8 },
  modeChip: { height: 36, paddingHorizontal: 14, borderRadius: 12, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, justifyContent: 'center' },
  modeChipActive: { backgroundColor: v3.colors.ink, borderColor: v3.colors.ink },
  modeText: { fontFamily: 'Outfit_700Bold', fontSize: 11.5, color: v3.colors.ink },
  modeTextActive: { color: v3.colors.paper },
  hero: { marginTop: 14, padding: 18, borderRadius: 20, backgroundColor: v3.colors.amberSoft },
  eyebrow: { fontFamily: 'Outfit_800ExtraBold', fontSize: 9.5, color: v3.colors.amberDark, letterSpacing: 1 },
  heroTitle: { marginTop: 7, fontFamily: 'Outfit_900Black', fontSize: 22, lineHeight: 28, color: v3.colors.ink },
  heroText: { marginTop: 5, fontFamily: 'Outfit_400Regular', fontSize: 11.5, lineHeight: 17, color: v3.colors.textSecondary },
  loading: { height: 160, alignItems: 'center', justifyContent: 'center' },
  sectionRow: { marginTop: 18, marginBottom: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 15, color: v3.colors.ink },
  sectionMeta: { fontFamily: 'Outfit_600SemiBold', fontSize: 10.5, color: v3.colors.textMuted },
  featuredCard: { borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, overflow: 'hidden' },
  featuredImageWrap: { height: 190, backgroundColor: v3.colors.surfaceGray },
  image: { width: '100%', height: '100%' },
  photoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECECEC' },
  purposeBadge: { position: 'absolute', top: 12, left: 12, height: 26, paddingHorizontal: 10, borderRadius: 10, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  purposeBadgeText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 9.5, color: v3.colors.paper },
  featuredBadge: { position: 'absolute', top: 12, right: 12, height: 26, paddingHorizontal: 10, borderRadius: 10, backgroundColor: v3.colors.amber, alignItems: 'center', justifyContent: 'center' },
  featuredBadgeText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 9.5, color: v3.colors.ink },
  featuredBody: { padding: 14 },
  price: { fontFamily: 'Outfit_900Black', fontSize: 20, color: v3.colors.ink },
  propertyTitle: { marginTop: 3, fontFamily: 'Outfit_700Bold', fontSize: 14, color: v3.colors.ink },
  locationRow: { marginTop: 6, flexDirection: 'row', gap: 4, alignItems: 'center' },
  locationText: { flex: 1, fontFamily: 'Outfit_400Regular', fontSize: 11.5, color: v3.colors.textSecondary },
  specRow: { marginTop: 8, flexDirection: 'row', gap: 12 },
  spec: { fontFamily: 'Outfit_600SemiBold', fontSize: 10.5, color: v3.colors.textSecondary },
  listYours: { marginTop: 14, minHeight: 78, padding: 13, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  listYoursIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: v3.colors.amberSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  listYoursTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 14, color: v3.colors.ink },
  listYoursText: { marginTop: 2, fontFamily: 'Outfit_400Regular', fontSize: 11, color: v3.colors.textSecondary },
  card: { minHeight: 88, marginBottom: 10, padding: 10, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  cardImageWrap: { width: 72, height: 68, borderRadius: 13, overflow: 'hidden', backgroundColor: v3.colors.surfaceGray },
  cardBody: { flex: 1, marginLeft: 12 },
  cardPrice: { fontFamily: 'Outfit_800ExtraBold', fontSize: 14, color: v3.colors.ink },
  cardTitle: { marginTop: 2, fontFamily: 'Outfit_700Bold', fontSize: 12.5, color: v3.colors.ink },
  cardLocation: { marginTop: 4, fontFamily: 'Outfit_400Regular', fontSize: 10.5, color: v3.colors.textSecondary },
  empty: { marginTop: 18, padding: 28, borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center' },
  emptyTitle: { marginTop: 10, fontFamily: 'Outfit_800ExtraBold', fontSize: 16, color: v3.colors.ink },
  emptyText: { marginTop: 4, fontFamily: 'Outfit_400Regular', fontSize: 11.5, lineHeight: 17, color: v3.colors.textSecondary, textAlign: 'center' },
})
