import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/lib/ThemeContext'
import { realEstate } from '@/lib/api'
import { fonts } from '@/lib/fonts'
import { spacing, fontSizes } from '@/lib/tokens'

const STATUS_TABS = ['all', 'draft', 'pending', 'approved', 'rejected']

export default function myListings() {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const router = useRouter()
  const [listings, setListings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('all')

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      const data = await realEstate.myListings({ status: activeTab === 'all' ? undefined : activeTab })
      setListings(data?.data || data || [])
    } catch (e) {
      console.error('Load my listings error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeTab])

  useEffect(() => { load() }, [load])

  const handleDelete = (id: string) => {
    Alert.alert('Delete Listing', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await realEstate.delete(id)
          setListings(prev => prev.filter(l => l.id !== id))
        } catch {}
      }},
    ])
  }

  const handleSubmit = async (id: string) => {
    try {
      await realEstate.submit(id)
      Alert.alert('Submitted', 'Your listing is now under review')
      load()
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit')
    }
  }

  const handleBoost = async (id: string) => {
    Alert.alert('Boost Listing', 'Choose boost tier', [
      { text: 'Basic (7 days)', onPress: () => doBoost(id, 'basic') },
      { text: 'Premium (14 days)', onPress: () => doBoost(id, 'premium') },
      { text: 'Top (30 days)', onPress: () => doBoost(id, 'top') },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const doBoost = async (id: string, tier: string) => {
    try {
      await realEstate.boost(id, tier)
      Alert.alert('Boosted!', `Listing boosted with ${tier} tier`)
      load()
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to boost')
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#10B981'
      case 'pending': return '#F5A623'
      case 'rejected': return '#EF4444'
      case 'draft': return '#6B7280'
      default: return colors.muted
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back-outline" size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.ink }]}>My Listings</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.amber }]} onPress={() => router.push('/real-estate/upload')}>
          <Ionicons name="add" size={20} color="#111" />
        </TouchableOpacity>
      </View>

      {/* Status Tabs */}
      <View style={styles.tabRow}>
        {STATUS_TABS.map(tab => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && { backgroundColor: colors.amber }]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, { color: activeTab === tab ? '#111' : colors.muted }]}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.amber} />
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="home-outline" size={48} color={colors.muted} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>No listings found</Text>
          <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.amber }]} onPress={() => router.push('/real-estate/upload')}>
            <Text style={styles.createBtnText}>Create Listing</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.amber} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.listingCard, { backgroundColor: colors.white, borderColor: colors.border }]} onPress={() => router.push(`/real-estate/${item.id}`)}>
              <View style={styles.listingHeader}>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: statusColor(item.status) }]}>{item.status}</Text>
                </View>
                {item.isFeatured && (
                  <View style={[styles.featuredBadge, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.featuredText, { color: '#D48900' }]}>Featured</Text>
                  </View>
                )}
                {item.boostTier && (
                  <View style={[styles.boostBadge, { backgroundColor: '#DBEAFE' }]}>
                    <Text style={[styles.boostText, { color: '#2563EB' }]}>{item.boostTier}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.listingTitle, { color: colors.ink }]} numberOfLines={1}>{item.title}</Text>
              <Text style={[styles.listingPrice, { color: colors.amber }]}>
                {item.countryCode === 'CA' ? 'CAD' : 'Rs.'} {item.priceLkr?.toLocaleString()}
              </Text>
              <Text style={[styles.listingLocation, { color: colors.muted }]} numberOfLines={1}>
                {item.city || item.district || item.address || 'No location'}
              </Text>
              <View style={styles.listingStats}>
                <Text style={[styles.statText, { color: colors.muted }]}>{item.views} views</Text>
                <Text style={[styles.statText, { color: colors.muted }]}>{item.saves} saves</Text>
              </View>
              <View style={styles.listingActions}>
                {item.status === 'draft' || item.status === 'rejected' ? (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.amber }]} onPress={() => handleSubmit(item.id)}>
                    <Text style={styles.actionBtnText}>Submit</Text>
                  </TouchableOpacity>
                ) : null}
                {item.status === 'approved' && !item.boostTier ? (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#DBEAFE' }]} onPress={() => handleBoost(item.id)}>
                    <Text style={[styles.actionBtnText, { color: '#2563EB' }]}>Boost</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => handleDelete(item.id)}>
                  <Text style={[styles.actionBtnText, { color: '#DC2626' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
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
  title: { flex: 1, fontSize: fontSizes.h2, fontFamily: fonts.heading },
  addBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: colors.white },
  tabText: { fontSize: 12, fontFamily: fonts.bodyMedium },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  emptyText: { fontSize: fontSizes.body, fontFamily: fonts.body },
  createBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginTop: spacing.md },
  createBtnText: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, color: '#111' },
  list: { paddingHorizontal: spacing.xl, paddingBottom: 32 },
  listingCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  listingHeader: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  statusText: { fontSize: 11, fontFamily: fonts.bodyMedium },
  featuredBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  featuredText: { fontSize: 11, fontFamily: fonts.bodyMedium },
  boostBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  boostText: { fontSize: 11, fontFamily: fonts.bodyMedium },
  listingTitle: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, marginBottom: 4 },
  listingPrice: { fontSize: fontSizes.body, fontFamily: fonts.heading, marginBottom: 2 },
  listingLocation: { fontSize: fontSizes.caption, fontFamily: fonts.body, marginBottom: 8 },
  listingStats: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  statText: { fontSize: fontSizes.captionSmall, fontFamily: fonts.body },
  listingActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  actionBtnText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#111' },
})
