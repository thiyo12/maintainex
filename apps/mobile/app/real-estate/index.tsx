import { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../lib/ThemeContext'
import { realEstate } from '../../lib/api'
import PropertyCard from '../../components/shared/PropertyCard'
import { fonts } from '../../lib/fonts'
import { spacing, fontSizes } from '../../lib/tokens'
import { useTranslation } from 'react-i18next'

const FILTERS = ['all', 'sale', 'rent', 'commercial', 'land']

export default function RealEstateList() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const router = useRouter()
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      const params: any = {}
      if (activeFilter !== 'all') params.type = activeFilter
      const data = await realEstate.list(params)
      setProperties(data || [])
    } catch (e) {
      console.error('Load real estate error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeFilter])

  useEffect(() => { load() }, [load])

  const filtered = properties.filter(p =>
    !search || p.title?.toLowerCase().includes(search.toLowerCase()) || p.location?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back-outline" size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.ink }]}>{t('realEstate.title')}</Text>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.white, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={16} color={colors.muted} />
        <TextInput
          style={[styles.searchInput, { color: colors.ink }]}
          placeholder={t('common.search')}
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, activeFilter === f && { backgroundColor: colors.amber, borderColor: colors.amber }]}
            onPress={() => setActiveFilter(f)}
          >
            <Text style={[styles.filterText, { color: activeFilter === f ? '#111827' : colors.muted }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
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
          renderItem={({ item }) => (
            <PropertyCard
              title={item.title || t('realEstate.propertyFallback')}
              priceLkr={item.priceLkr || 0}
              type={item.type || 'sale'}
              bedrooms={item.bedrooms}
              bathrooms={item.bathrooms}
              areaSqft={item.areaSqft}
              location={item.location}
              onPress={() => router.push(`/real-estate/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="home-outline" size={48} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>{t('common.noResults')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  backBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
  title: { fontSize: fontSizes.h2, fontFamily: fonts.heading },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.xl, borderRadius: 14, borderWidth: 1,
    paddingHorizontal: spacing.md, height: 44,
  },
  searchInput: { flex: 1, fontSize: fontSizes.body, fontFamily: fonts.body },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  filterChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: 100, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  filterText: { fontSize: fontSizes.captionSmall, fontFamily: fonts.bodyMedium },
  row: { gap: 10, paddingHorizontal: spacing.xl },
  list: { paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm, paddingTop: 80 },
  emptyText: { fontSize: fontSizes.body, fontFamily: fonts.body },
})
