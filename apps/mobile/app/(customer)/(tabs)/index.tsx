import { useEffect, useRef, useState, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Animated, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../../lib/auth'
import { categories, taskers } from '../../../lib/api'
import { colors } from '../../../lib/colors'
import type { Category, TaskerProfile } from '../../../lib/types'
import PressScale from '../../../components/find/PressScale'

const catIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  construction: 'construct-outline', cleaning: 'sparkles-outline', electrical: 'flash-outline',
  plumbing: 'water-outline', painting: 'color-palette-outline', moving: 'cube-outline',
  gardening: 'leaf-outline', handyman: 'build-outline', assembly: 'settings-outline',
  mounting: 'easel-outline', outdoor: 'sunny-outline', repairs: 'hammer-outline',
  trending: 'trending-up-outline',
}

export default function CustomerHome() {
  const router = useRouter()
  const { user } = useAuth()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const [catList, setCatList] = useState<Category[]>([])
  const [taskerList, setTaskerList] = useState<TaskerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start()
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [catsResult, tksResult] = await Promise.allSettled([categories.list(), taskers.list()])
      if (catsResult.status === 'fulfilled') setCatList(catsResult.value)
      else console.error('Categories error:', catsResult.reason)
      if (tksResult.status === 'fulfilled') setTaskerList(tksResult.value)
      else console.error('Taskers error:', tksResult.reason)
    } catch (e) {
      console.error('Home load error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadData()
  }, [])

  const filteredTaskers = taskerList.filter(t =>
    t.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
    (t.skills || []).some(s => s.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <View style={styles.topBar}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.greeting}>Hello, {user?.name || 'User'}</Text>
              <Ionicons name="hand-left-outline" size={22} color={colors.primary} style={{ marginLeft: 6 }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Ionicons name="location-outline" size={14} color={colors.gray} />
              <Text style={styles.location}> Sri Lanka</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.avatar} onPress={() => router.push('/(customer)/settings')}>
            <Text style={styles.avatarText}>{(user?.name || 'U')[0]}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.gray} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a service or tasker..."
            placeholderTextColor={colors.gray}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.gray} />
            </TouchableOpacity>
          ) : null}
        </View>

        <PressScale onPress={() => router.push('/(customer)/find')}>
          <View style={styles.findCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={styles.findIconWrap}>
                <Ionicons name="search-circle" size={32} color={colors.dark} />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.findTitle}>Find a Tasker</Text>
                <Text style={styles.findSub}>Browse 19 categories of services near you</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={20} color={colors.dark} />
          </View>
        </PressScale>

        <PressScale onPress={() => router.push('/(customer)/jobs/v2')}>
          <View style={[styles.findCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={styles.findIconWrap}>
                <Ionicons name="briefcase-outline" size={32} color={colors.dark} />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.findTitle}>My Marketplace Jobs</Text>
                <Text style={[styles.findSub, { color: '#1E40AF' }]}>Post, track, and manage jobs</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={20} color={colors.dark} />
          </View>
        </PressScale>

        <PressScale onPress={() => router.push('/(customer)/wallet')}>
          <View style={[styles.findCard, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={styles.findIconWrap}>
                <Ionicons name="wallet-outline" size={32} color={colors.dark} />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.findTitle}>Wallet</Text>
                <Text style={[styles.findSub, { color: '#065F46' }]}>Manage balance and transactions</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={20} color={colors.dark} />
          </View>
        </PressScale>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          >
            <Text style={styles.sectionTitle}>Categories</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesRow}>
              {catList.map((cat) => (
                <PressScale key={cat.id} onPress={() => router.push(`/(customer)/(tabs)/explore`)}>
                  <View style={styles.categoryCard}>
                    <View style={styles.catIconWrap}>
                      <Ionicons name={catIcons[cat.slug] || 'grid-outline'} size={24} color={colors.dark} />
                    </View>
                    <Text style={styles.catLabel}>{cat.name}</Text>
                  </View>
                </PressScale>
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>
              {search ? 'Results' : 'Nearby Taskers'}
              {search ? ` (${filteredTaskers.length})` : ''}
            </Text>
            {filteredTaskers.length === 0 && !search ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="people-outline" size={48} color={colors.lightGray} />
                <Text style={{ color: colors.gray, marginTop: 12 }}>No taskers available yet</Text>
              </View>
            ) : (
              filteredTaskers.map((t, i) => (
                <PressScale key={t.id || i}>
                  <View style={styles.taskerCard}>
                    <View style={styles.taskerLeft}>
                      <View style={styles.taskerAvatar}>
                        <Text style={styles.taskerAvatarText}>{t.user?.name?.[0] || 'T'}</Text>
                        {t.isOnline ? <View style={styles.onlineDot} /> : null}
                      </View>
                      <View style={styles.taskerInfo}>
                        <Text style={styles.taskerName}>{t.user?.name || 'Tasker'}</Text>
                        <Text style={styles.taskerSkill}>{t.skills?.[0] || 'Professional'} • {t.serviceAreas?.[0] || 'Sri Lanka'}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                          <Ionicons name="star" size={13} color="#F59E0B" />
                          <Text style={styles.taskerRating}> {t.rating?.toFixed(1) || '5.0'}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.badges}>
                      {t.isOnline ? (
                        <View style={styles.availableBadge}>
                          <View style={styles.availableDot} />
                          <Text style={styles.availableText}>Available</Text>
                        </View>
                      ) : null}
                      {t.isVerified ? (
                        <View style={styles.verifiedBadge}>
                          <Ionicons name="checkmark-circle" size={12} color="#2563EB" />
                          <Text style={styles.verifiedText}> Verified</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </PressScale>
              ))
            )}
          </ScrollView>
        )}

        <PressScale onPress={() => router.push('/(customer)/jobs/new')}>
          <View style={styles.fab}>
            <Ionicons name="add" size={22} color={colors.white} />
            <Text style={styles.fabLabel}>Post a job</Text>
          </View>
        </PressScale>
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.dark },
  location: { fontSize: 13, color: colors.gray, marginTop: 4 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.customerAccent,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.white },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
    marginHorizontal: 24, paddingHorizontal: 16, borderRadius: 14,
    height: 48, borderWidth: 1.5, borderColor: colors.lightGray, marginBottom: 20,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.dark },
  sectionTitle: {
    fontSize: 18, fontWeight: '700', color: colors.dark,
    paddingHorizontal: 24, marginBottom: 12, marginTop: 8,
  },
  categoriesRow: { paddingLeft: 24, marginBottom: 24 },
  categoryCard: { alignItems: 'center', marginRight: 16, width: 76 },
  catIconWrap: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: colors.white,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  catLabel: { fontSize: 12, fontWeight: '600', color: colors.dark, textAlign: 'center' },
  taskerCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.white, marginHorizontal: 24, marginBottom: 10,
    padding: 16, borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  taskerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  taskerAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.customerAccent,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  taskerAvatarText: { fontSize: 18, fontWeight: '700', color: colors.white },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0, width: 14, height: 14,
    borderRadius: 7, backgroundColor: colors.green, borderWidth: 2, borderColor: colors.white,
  },
  taskerInfo: { flex: 1 },
  taskerName: { fontSize: 15, fontWeight: '700', color: colors.dark },
  taskerSkill: { fontSize: 13, color: colors.gray, marginTop: 2 },
  taskerRating: { fontSize: 13, color: colors.dark },
  badges: { gap: 4 },
  availableBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  availableDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green, marginRight: 4 },
  availableText: { fontSize: 11, fontWeight: '600', color: colors.green },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  verifiedText: { fontSize: 11, fontWeight: '600', color: '#2563EB' },
  findCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7',
    marginHorizontal: 24, marginBottom: 16, padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: '#FDE68A',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  findIconWrap: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  findTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  findSub: { fontSize: 12, color: '#92400E', marginTop: 2 },
  fab: {
    position: 'absolute', bottom: 100, right: 24, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.customerAccent, paddingHorizontal: 20, paddingVertical: 14,
    borderRadius: 28,
    shadowColor: colors.customerAccent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8, gap: 8,
  },
  fabLabel: { fontSize: 15, fontWeight: '700', color: colors.white },
})
