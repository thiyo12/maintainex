import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../lib/ThemeContext'
import { realEstate } from '../../lib/api'
import PropertyCard from '../../components/shared/PropertyCard'
import { fonts } from '../../lib/fonts'
import { spacing, fontSizes } from '../../lib/tokens'

export default function FavoritesScreen() {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const router = useRouter()
  const [favorites, setFavorites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      const data = await realEstate.favorites()
      setFavorites(data || [])
    } catch (e) {
      console.error('Load favorites error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleToggleFavorite = async (id: string) => {
    try {
      await realEstate.favorite(id)
      setFavorites(prev => prev.filter(f => f.listingId !== id))
    } catch {}
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back-outline" size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.ink }]}>Saved Properties</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.amber} />
        </View>
      ) : favorites.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="heart-outline" size={48} color={colors.muted} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>No saved properties yet</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.linkText, { color: colors.amber }]}>Browse Properties</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.amber} />}
          renderItem={({ item }) => item.listing && (
            <PropertyCard
              title={item.listing.title || 'Property'}
              priceLkr={item.listing.priceLkr || 0}
              type={item.listing.purpose || item.listing.type || 'sale'}
              bedrooms={item.listing.bedrooms}
              bathrooms={item.listing.bathrooms}
              areaSqft={item.listing.areaSqft || item.listing.propertySize}
              location={item.listing.city || item.listing.district || item.listing.address}
              onPress={() => router.push(`/real-estate/${item.listingId}`)}
            />
          )}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  emptyText: { fontSize: fontSizes.body, fontFamily: fonts.body },
  linkText: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, marginTop: spacing.sm },
  row: { gap: 10, paddingHorizontal: spacing.xl },
  list: { paddingBottom: 32 },
})
