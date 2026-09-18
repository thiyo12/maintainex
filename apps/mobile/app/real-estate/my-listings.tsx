import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { House, Plus, Sparkle, Trash } from 'phosphor-react-native'
import { realEstate } from '../../lib/api'
import { v3 } from '../../theme/v3/tokens'
import V3PageHeader from '../../components/v3/V3PageHeader'

const TABS = ['all', 'pending', 'approved', 'rejected'] as const

function money(value: unknown, countryCode?: string) {
  const n = Number(value)
  return Number.isFinite(n) ? `${countryCode === 'CA' ? 'CAD' : 'LKR'} ${Math.round(n).toLocaleString()}` : 'Price on request'
}

export default function MyListingsScreen() {
  const router = useRouter()
  const [listings, setListings] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const response: any = await realEstate.myListings()
      const list = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : []
      setListings(activeTab === 'all' ? list : list.filter((item: any) => item.status === activeTab))
    } catch (error) {
      console.error('Load my listings error:', error)
      setListings([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeTab])

  useEffect(() => { load() }, [load])

  const remove = (id: string) => {
    Alert.alert('Delete listing?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await realEstate.delete(id)
            setListings((current) => current.filter((item) => item.id !== id))
          } catch (error: any) {
            Alert.alert('Could not delete', error?.message || 'Please try again.')
          }
        },
      },
    ])
  }

  const boost = (id: string) => {
    Alert.alert('Boost listing', 'Choose a promotion tier.', [
      { text: 'Basic', onPress: async () => { try { await realEstate.boost(id, 'basic'); load() } catch {} } },
      { text: 'Premium', onPress: async () => { try { await realEstate.boost(id, 'premium'); load() } catch {} } },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <V3PageHeader
        title="My listings"
        subtitle="Manage property status, reach and performance."
        right={
          <TouchableOpacity style={styles.add} onPress={() => router.push('/real-estate/upload' as any)}>
            <Plus size={19} color={v3.colors.paper} weight="bold" />
          </TouchableOpacity>
        }
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && styles.tabActive]}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={v3.colors.ink} /></View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={v3.colors.ink} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <House size={34} color={v3.colors.ink} weight="fill" />
              <Text style={styles.emptyTitle}>No listings here</Text>
              <Text style={styles.emptyText}>Create your first property listing or switch the filter.</Text>
              <TouchableOpacity style={styles.primary} onPress={() => router.push('/real-estate/upload' as any)}>
                <Text style={styles.primaryText}>List a property</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.82} style={styles.card} onPress={() => router.push(`/real-estate/${item.id}` as any)}>
              <View style={styles.topRow}>
                <View style={[styles.status, statusStyle(item.status)]}>
                  <Text style={[styles.statusText, statusTextStyle(item.status)]}>{String(item.status || 'unknown').toUpperCase()}</Text>
                </View>
                {item.isFeatured ? <View style={styles.featured}><Text style={styles.featuredText}>FEATURED</Text></View> : null}
                {item.boostTier ? <View style={styles.boost}><Text style={styles.boostText}>{String(item.boostTier).toUpperCase()}</Text></View> : null}
              </View>
              <Text style={styles.title} numberOfLines={1}>{item.title || 'Property'}</Text>
              <Text style={styles.price}>{money(item.priceLkr, item.countryCode)}</Text>
              <Text style={styles.location} numberOfLines={1}>{[item.area, item.city, item.district].filter(Boolean).join(', ') || 'No location added'}</Text>
              <View style={styles.stats}><Text style={styles.stat}>{item.views || 0} views</Text><Text style={styles.stat}>{item.saves || 0} saves</Text></View>
              <View style={styles.actions}>
                {item.status === 'approved' && !item.boostTier ? (
                  <TouchableOpacity onPress={() => boost(item.id)} style={styles.action}><Sparkle size={15} color={v3.colors.ink} weight="fill" /><Text style={styles.actionText}>Boost</Text></TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => remove(item.id)} style={[styles.action, styles.deleteAction]}><Trash size={15} color={v3.colors.error} weight="bold" /><Text style={[styles.actionText, { color: v3.colors.error }]}>Delete</Text></TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  )
}

function statusStyle(status: string) {
  if (status === 'approved') return { backgroundColor: v3.colors.successSoft }
  if (status === 'rejected') return { backgroundColor: v3.colors.errorSoft }
  return { backgroundColor: v3.colors.amberSoft }
}
function statusTextStyle(status: string) {
  if (status === 'approved') return { color: v3.colors.success }
  if (status === 'rejected') return { color: v3.colors.error }
  return { color: v3.colors.amberDark }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  add: { width: 40, height: 40, borderRadius: 20, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  tabs: { paddingHorizontal: 18, paddingBottom: 12, gap: 8 },
  tab: { height: 36, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: v3.colors.line, backgroundColor: v3.colors.paper, justifyContent: 'center' },
  tabActive: { backgroundColor: v3.colors.ink, borderColor: v3.colors.ink },
  tabText: { fontFamily: 'Outfit_700Bold', fontSize: 11.5, color: v3.colors.ink },
  tabTextActive: { color: v3.colors.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 18, paddingBottom: 36 },
  empty: { marginTop: 28, padding: 28, borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center' },
  emptyTitle: { marginTop: 10, fontFamily: 'Outfit_800ExtraBold', fontSize: 17, color: v3.colors.ink },
  emptyText: { marginTop: 4, fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 18, color: v3.colors.textSecondary, textAlign: 'center' },
  primary: { marginTop: 16, height: 46, paddingHorizontal: 18, borderRadius: 14, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: 'Outfit_700Bold', fontSize: 12.5, color: v3.colors.paper },
  card: { marginBottom: 10, padding: 15, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  status: { height: 24, paddingHorizontal: 8, borderRadius: 9, justifyContent: 'center' },
  statusText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 9, letterSpacing: 0.5 },
  featured: { height: 24, paddingHorizontal: 8, borderRadius: 9, backgroundColor: v3.colors.amber, justifyContent: 'center' },
  featuredText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 9, color: v3.colors.ink },
  boost: { height: 24, paddingHorizontal: 8, borderRadius: 9, backgroundColor: v3.colors.infoSoft, justifyContent: 'center' },
  boostText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 9, color: v3.colors.info },
  title: { marginTop: 11, fontFamily: 'Outfit_800ExtraBold', fontSize: 15, color: v3.colors.ink },
  price: { marginTop: 4, fontFamily: 'Outfit_900Black', fontSize: 18, color: v3.colors.ink },
  location: { marginTop: 4, fontFamily: 'Outfit_400Regular', fontSize: 11.5, color: v3.colors.textSecondary },
  stats: { marginTop: 8, flexDirection: 'row', gap: 14 },
  stat: { fontFamily: 'Outfit_500Medium', fontSize: 10.5, color: v3.colors.textMuted },
  actions: { marginTop: 12, flexDirection: 'row', gap: 8 },
  action: { minHeight: 38, paddingHorizontal: 12, borderRadius: 11, backgroundColor: v3.colors.canvas, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  deleteAction: { backgroundColor: v3.colors.errorSoft, borderColor: '#FFD7CF' },
  actionText: { fontFamily: 'Outfit_700Bold', fontSize: 11.5, color: v3.colors.ink },
})
