import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useColors } from '../../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { taskers } from '../../../lib/api'
import { fonts } from '../../../lib/fonts'
import TaskerCard from '../../../components/find/TaskerCard'

export default function SearchResultsScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { category, name, q } = useLocalSearchParams<{ category?: string; name?: string; q?: string }>()

  const [providers, setProviders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const displayName = name || q || category || ''

  const fetchProviders = useCallback(async () => {
    try {
      const params: string[] = []
      if (category) params.push(`category=${encodeURIComponent(category)}`)
      const query = params.length > 0 ? `?${params.join('&')}` : ''
      const data = await taskers.list(query || undefined)
      setProviders(data || [])
    } catch (e) {
      console.error('Failed to load providers', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [category])

  useEffect(() => { fetchProviders() }, [fetchProviders])

  const onRefresh = () => {
    setRefreshing(true)
    fetchProviders()
  }

  const handlePostJob = () => {
    const params: Record<string, string> = {}
    if (category) params.category = category
    if (displayName) params.name = displayName
    if (q) params.q = q
    router.push({ pathname: '/(customer)/search/post-job-confirm', params })
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>{displayName}</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            {loading ? '...' : `${providers.length} ${t('search.nearbyProviders')}`}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.postJobBtn, { backgroundColor: colors.amber }]}
        onPress={handlePostJob}
        activeOpacity={0.8}
      >
        <Ionicons name="add-circle" size={22} color="#111827" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.postJobTitle, { color: '#111827' }]}>{t('search.postThisJob')}</Text>
          <Text style={[styles.postJobSub, { color: '#374151' }]}>{t('search.postJobHint')}</Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color="#111827" />
      </TouchableOpacity>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.amber} />
          <Text style={[styles.loadingText, { color: colors.muted }]}>Finding providers...</Text>
        </View>
      ) : providers.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.amber + '15' }]}>
            <Ionicons name="search-outline" size={40} color={colors.amber} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>{t('search.noProviders')}</Text>
          <Text style={[styles.emptySub, { color: colors.muted }]}>
            Be the first to post this job and get quotes from providers
          </Text>
          <TouchableOpacity
            style={[styles.emptyPostBtn, { backgroundColor: colors.amber }]}
            onPress={handlePostJob}
            activeOpacity={0.8}
          >
            <Text style={[styles.emptyPostText, { color: '#111827' }]}>{t('search.postThisJob')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={providers}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TaskerCard
              name={item.user?.name || 'Provider'}
              rating={item.rating || 0}
              completedJobs={item.completedJobs || 0}
              isVerified={item.isVerified || false}
              isOnline={item.isOnline || false}
              hourlyRate={item.hourlyRate || 0}
              skills={item.skills || []}
              onPress={() => router.push(`/(customer)/find/taskers/profile/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} />}
        />
      )}
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontFamily: fonts.headingBold, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, fontFamily: fonts.body, marginTop: 2 },
  postJobBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 8, marginBottom: 12,
    padding: 14, borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  postJobTitle: { fontSize: 14, fontFamily: fonts.headingBold },
  postJobSub: { fontSize: 11, fontFamily: fonts.body, marginTop: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 13, fontFamily: fonts.body },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontFamily: fonts.headingBold, textAlign: 'center' },
  emptySub: { fontSize: 13, fontFamily: fonts.body, textAlign: 'center', lineHeight: 18 },
  emptyPostBtn: {
    marginTop: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 3,
  },
  emptyPostText: { fontSize: 15, fontFamily: fonts.headingBold },
})
