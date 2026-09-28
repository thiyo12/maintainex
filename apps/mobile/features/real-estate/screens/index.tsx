import { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/lib/ThemeContext'
import { useCountry } from '@/lib/country'
import { realEstate } from '@/api/real-estate'
import PropertyCard from '@/components/shared/PropertyCard'
import { fonts } from '@/lib/fonts'
import { spacing, fontSizes } from '@/lib/tokens'

const PURPOSE_FILTERS = ['all', 'sale', 'rent', 'commercial', 'land']
const COUNTRY_FILTERS = [{ code: 'all', label: 'All' }, { code: 'LK', label: 'Sri Lanka' }, { code: 'CA', label: 'Canada' }]

export default function RealEstateList() {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { selectedCountry } = useCountry()
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activePurpose, setActivePurpose] = useState('all')
  const [activeCountry, setActiveCountry] = useState(selectedCountry?.code || 'LK')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      const params: any = { status: 'approved' }
      if (activeCountry !== 'all') params.country = activeCountry
      if (activePurpose !== 'all') params.purpose = activePurpose
      if (search) params.q = search
      params.sortBy = sortBy
      const res = await realEstate.list(params)
      const data = res?.data || res || []
      setProperties(data)
    } catch (e) {
      console.error('Load real estate error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeCountry, activePurpose, sortBy])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const timer = setTimeout(() => load(), 500)
    return () => clearTimeout(timer)
  }, [search])

  const filtered = properties

  const badge = (purpose: string) => {
    switch (purpose) {
      case 'rent': return { label: 'RENT', color: '#6366F1' }
      case 'commercial': return { label: 'COMM', color: '#10B981' }
      case 'land': return { label: 'LAND', color: '#7C3AED' }
      default: return { label: 'SALE', color: '#F5A623' }
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back-outline" size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.ink }]}>Properties</Text>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/real-estate/favorites')}>
          <Ionicons name="heart-outline" size={18} color={colors.ink} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/real-estate/my-listings')}>
          <Ionicons name="list-outline" size={18} color={colors.ink} />
        </TouchableOpacity>
      </View>

      {/* Country Tabs */}
      <View style={styles.countryRow}>
        {COUNTRY_FILTERS.map(c => (
          <TouchableOpacity key={c.code} style={[styles.countryTab, activeCountry === c.code && { backgroundColor: colors.amber }]} onPress={() => setActiveCountry(c.code)}>
            <Text style={[styles.countryTabText, { color: activeCountry === c.code ? '#111' : colors.muted }]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.white, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={16} color={colors.muted} />
        <TextInput style={[styles.searchInput, { color: colors.ink }]} placeholder="Search properties..." placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} />
      </View>

      {/* Purpose Filters */}
      <View style={styles.filterRow}>
        {PURPOSE_FILTERS.map(f => (
          <TouchableOpacity key={f} style={[styles.filterChip, activePurpose === f && { backgroundColor: colors.amber, borderColor: colors.amber }]} onPress={() => setActivePurpose(f)}>
            <Text style={[styles.filterText, { color: activePurpose === f ? '#111827' : colors.muted }]}>
              {f === 'all' ? 'All' : f === 'land' ? 'Land' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sort */}
      <View style={styles.sortRow}>
        <TouchableOpacity style={[styles.sortBtn, sortBy === 'newest' && { borderBottomColor: colors.amber }]} onPress={() => setSortBy('newest')}>
          <Text style={[styles.sortText, { color: sortBy === 'newest' ? colors.ink : colors.muted }]}>Newest</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.sortBtn, sortBy === 'price_asc' && { borderBottomColor: colors.amber }]} onPress={() => setSortBy('price_asc')}>
          <Text style={[styles.sortText, { color: sortBy === 'price_asc' ? colors.ink : colors.muted }]}>Lowest</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.sortBtn, sortBy === 'price_desc' && { borderBottomColor: colors.amber }]} onPress={() => setSortBy('price_desc')}>
          <Text style={[styles.sortText, { color: sortBy === 'price_desc' ? colors.ink : colors.muted }]}>Highest</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.sortBtn, sortBy === 'most_viewed' && { borderBottomColor: colors.amber }]} onPress={() => setSortBy('most_viewed')}>
          <Text style={[styles.sortText, { color: sortBy === 'most_viewed' ? colors.ink : colors.muted }]}>Popular</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.amber} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id || Math.random().toString()}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.amber} />}
          ListHeaderComponent={
            <>
              {properties.some((p: any) => p.isFeatured || p.boostTier) && (
                <View style={styles.featuredSection}>
                  <Text style={[styles.featuredTitle, { color: colors.ink }]}>Featured</Text>
                  {properties.filter((p: any) => p.isFeatured || p.boostTier).slice(0, 1).map((item: any) => (
                    <TouchableOpacity key={item.id} style={[styles.featuredCard, { backgroundColor: colors.surface }]} onPress={() => router.push(`/real-estate/${item.id}`)}>
                      <View style={[styles.featuredImage, { backgroundColor: colors.muted + '20' }]}>
                        <Ionicons name="home" size={40} color={colors.muted} />
                        <View style={[styles.featuredBgBadge, { backgroundColor: badge(item.purpose || 'sale').color }]}>
                          <Text style={styles.featuredBgBadgeText}>{badge(item.purpose || 'sale').label}</Text>
                        </View>
                      </View>
                      <View style={styles.featuredBody}>
                        <Text style={[styles.featuredPrice, { color: colors.amberDark }]}>
                          {item.countryCode === 'CA' ? 'CAD' : 'Rs.'} {item.priceLkr?.toLocaleString()}
                        </Text>
                        <Text style={[styles.featuredName, { color: colors.ink }]} numberOfLines={1}>{item.title}</Text>
                        <View style={styles.featuredLocRow}>
                          <Ionicons name="location-outline" size={12} color={colors.muted} />
                          <Text style={[styles.featuredLoc, { color: colors.muted }]} numberOfLines={1}>{item.city || item.district || ''}</Text>
                        </View>
                        <View style={styles.featuredSpecs}>
                          {item.bedrooms != null && <Text style={[styles.featuredSpec, { color: colors.muted }]}>{item.bedrooms} Bed</Text>}
                          {item.bathrooms != null && <Text style={[styles.featuredSpec, { color: colors.muted }]}>{item.bathrooms} Bath</Text>}
                          {(item.areaSqft || item.propertySize) && <Text style={[styles.featuredSpec, { color: colors.muted }]}>{item.areaSqft || item.propertySize} sqft</Text>}
                          {item.parking != null && <Text style={[styles.featuredSpec, { color: colors.muted }]}>{item.parking} Parking</Text>}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          }
          renderItem={({ item }) => (
            <PropertyCard
              title={item.title || 'Property'}
              priceLkr={item.priceLkr || 0}
              type={item.purpose || item.type || 'sale'}
              countryCode={item.countryCode}
              bedrooms={item.bedrooms}
              bathrooms={item.bathrooms}
              areaSqft={item.areaSqft || item.propertySize}
              parking={item.parking}
              location={item.city || item.district || item.address}
              isFeatured={item.isFeatured}
              boostTier={item.boostTier}
              views={item.views}
              saves={item.saves}
              photos={item.photos}
              onPress={() => router.push(`/real-estate/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="home-outline" size={48} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>No properties found</Text>
            </View>
          }
          ListFooterComponent={
            <TouchableOpacity style={[styles.listPropertyBtn, { backgroundColor: colors.amber }]} onPress={() => router.push('/real-estate/upload')}>
              <Ionicons name="add-circle-outline" size={20} color="#111" />
              <Text style={styles.listPropertyBtnText}>List Your Property</Text>
            </TouchableOpacity>
          }
        />
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  title: { flex: 1, fontSize: fontSizes.h2, fontFamily: fonts.heading },
  actionBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  countryRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  countryTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, backgroundColor: colors.white },
  countryTabText: { fontSize: 12, fontFamily: fonts.bodyMedium },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.xl, borderRadius: 14, borderWidth: 1,
    paddingHorizontal: spacing.md, height: 44,
  },
  searchInput: { flex: 1, fontSize: fontSizes.body, fontFamily: fonts.body },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 100, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  filterText: { fontSize: fontSizes.captionSmall, fontFamily: fonts.bodyMedium },
  sortRow: { flexDirection: 'row', gap: spacing.xl, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  sortBtn: { paddingBottom: spacing.xs, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  sortText: { fontSize: fontSizes.captionSmall, fontFamily: fonts.bodyMedium },
  row: { gap: 12, paddingHorizontal: 16, marginBottom: 12 },
  list: { paddingBottom: 32, paddingTop: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm, paddingTop: 80 },
  emptyText: { fontSize: fontSizes.body, fontFamily: fonts.body },
  listPropertyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: spacing.xl, marginTop: spacing.md, paddingVertical: 14, borderRadius: 16 },
  listPropertyBtnText: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, color: '#111' },
  featuredSection: { paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  featuredTitle: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, marginBottom: spacing.sm },
  featuredCard: { borderRadius: 16, overflow: 'hidden', marginBottom: spacing.md },
  featuredImage: { height: 180, justifyContent: 'center', alignItems: 'center' },
  featuredBgBadge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  featuredBgBadgeText: { fontSize: 10, fontFamily: fonts.bodyMedium, color: '#111' },
  featuredBody: { padding: 14 },
  featuredPrice: { fontSize: fontSizes.h2, fontFamily: fonts.heading, letterSpacing: -0.3 },
  featuredName: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, marginTop: 4 },
  featuredLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  featuredLoc: { fontSize: fontSizes.captionSmall, fontFamily: fonts.body },
  featuredSpecs: { flexDirection: 'row', gap: 12, marginTop: 8 },
  featuredSpec: { fontSize: fontSizes.captionSmall, fontFamily: fonts.body },
})
