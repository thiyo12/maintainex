import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Heart, House, MapPin } from 'phosphor-react-native'
import { realEstate } from '../../lib/api'
import { v3 } from '../../theme/v3/tokens'
import V3PageHeader from '../../components/v3/V3PageHeader'

function money(value: unknown, countryCode?: string) {
  const n = Number(value)
  return Number.isFinite(n) ? `${countryCode === 'CA' ? 'CAD' : 'LKR'} ${Math.round(n).toLocaleString()}` : 'Price on request'
}

export default function FavoritesScreen() {
  const router = useRouter()
  const [favorites, setFavorites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const response: any = await realEstate.favorites()
      const list = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : []
      setFavorites(list)
    } catch (error) {
      console.error('Load favorites error:', error)
      setFavorites([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const remove = async (listingId: string) => {
    try {
      await realEstate.favorite(listingId)
      setFavorites((current) => current.filter((item) => item.listingId !== listingId))
    } catch {}
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <V3PageHeader title="Saved properties" subtitle="Your shortlist of places to revisit." />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={v3.colors.ink} /></View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={v3.colors.ink} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Heart size={34} color={v3.colors.ink} weight="fill" />
              <Text style={styles.emptyTitle}>Nothing saved yet</Text>
              <Text style={styles.emptyText}>Save a property from its detail page and it will appear here.</Text>
              <TouchableOpacity style={styles.primary} onPress={() => router.replace('/real-estate' as any)}>
                <Text style={styles.primaryText}>Browse properties</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const listing = item.listing
            if (!listing) return null
            const photo = Array.isArray(listing.photos) ? listing.photos[0] : null
            return (
              <TouchableOpacity activeOpacity={0.82} style={styles.card} onPress={() => router.push(`/real-estate/${item.listingId}` as any)}>
                <View style={styles.imageWrap}>
                  {photo ? <Image source={{ uri: photo }} style={styles.image} /> : <View style={styles.photoFallback}><House size={28} color={v3.colors.textMuted} /></View>}
                </View>
                <View style={styles.copy}>
                  <Text style={styles.price}>{money(listing.priceLkr, listing.countryCode)}</Text>
                  <Text style={styles.title} numberOfLines={1}>{listing.title || 'Property'}</Text>
                  <View style={styles.locationRow}>
                    <MapPin size={12} color={v3.colors.textSecondary} />
                    <Text style={styles.location} numberOfLines={1}>{[listing.area, listing.city, listing.district].filter(Boolean).join(', ') || 'View location'}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => remove(item.listingId)} style={styles.heartButton}>
                  <Heart size={18} color={v3.colors.error} weight="fill" />
                </TouchableOpacity>
              </TouchableOpacity>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 18, paddingBottom: 36 },
  empty: { marginTop: 30, padding: 28, borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center' },
  emptyTitle: { marginTop: 10, fontFamily: 'Outfit_800ExtraBold', fontSize: 17, color: v3.colors.ink },
  emptyText: { marginTop: 5, fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 18, color: v3.colors.textSecondary, textAlign: 'center' },
  primary: { marginTop: 16, height: 46, paddingHorizontal: 18, borderRadius: 14, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: 'Outfit_700Bold', fontSize: 12.5, color: v3.colors.paper },
  card: { minHeight: 98, marginBottom: 10, padding: 10, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  imageWrap: { width: 80, height: 76, borderRadius: 14, overflow: 'hidden', backgroundColor: v3.colors.surfaceGray },
  image: { width: '100%', height: '100%' },
  photoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, marginLeft: 12 },
  price: { fontFamily: 'Outfit_800ExtraBold', fontSize: 14, color: v3.colors.ink },
  title: { marginTop: 2, fontFamily: 'Outfit_700Bold', fontSize: 12.5, color: v3.colors.ink },
  locationRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
  location: { flex: 1, fontFamily: 'Outfit_400Regular', fontSize: 10.5, color: v3.colors.textSecondary },
  heartButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: v3.colors.errorSoft, alignItems: 'center', justifyContent: 'center' },
})
