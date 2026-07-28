import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../../lib/ThemeContext'
import { templateJobs, findTasker } from '../../../../lib/api'
import { useCountry } from '../../../../lib/country'
import TaskerCard from '../../../../components/find/TaskerCard'
import SkeletonLoader from '../../../../components/find/SkeletonLoader'
import EmptyState from '../../../../components/find/EmptyState'

export default function FindTaskerList() {
  const colors = useColors()
  const { t } = useTranslation()
  const styles = makeStyles(colors)
  const { jobId } = useLocalSearchParams<{ jobId: string }>()
  const [job, setJob] = useState<any>(null)
  const [taskers, setTaskers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const { selectedCountry } = useCountry()
  const router = useRouter()

  const fetch = useCallback(async () => {
    try {
      const [jobData, taskerData] = await Promise.all([
        templateJobs.get(jobId!),
        findTasker.search({ jobId: jobId!, country: selectedCountry?.code }),
      ])
      setJob(jobData)
      setTaskers(taskerData)
    } catch (e) {
      console.error('Failed to load taskers', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [jobId, selectedCountry])

  useEffect(() => { fetch() }, [fetch])

  const onRefresh = () => {
    setRefreshing(true)
    fetch()
  }

  const avgPrice = job ? Math.round((job.priceMin + job.priceMax) / 2) : 0

  return (
    <View style={styles.container}>
      {job && (
        <View style={styles.jobSummary}>
          <View style={styles.jobInfo}>
            <Text style={styles.jobName}>{job.name}</Text>
            <Text style={styles.jobPrice}>Rs {avgPrice.toLocaleString()} est.</Text>
          </View>
          <TouchableOpacity style={styles.viewToggle} onPress={() => setViewMode(v => v === 'list' ? 'map' : 'list')}>
            <Ionicons name={viewMode === 'list' ? 'map' : 'list'} size={18} color={colors.primary} />
            <Text style={styles.viewToggleText}>{viewMode === 'list' ? t('tracking.title') : t('common.search')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <SkeletonLoader count={5} height={110} />
      ) : taskers.length === 0 ? (
        <EmptyState icon="shield-checkmark-outline" title={t('common.noResults')} subtitle={t('customer.noResults')} />
      ) : viewMode === 'list' ? (
        <FlatList
          data={taskers}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TaskerCard
              name={item.name}
              rating={item.rating}
              completedJobs={item.completedJobs}
              isVerified={item.isVerified}
              isOnline={item.isOnline}
              distance={item.distance}
              hourlyRate={item.hourlyRate}
              skills={item.skills}
              onPress={() => router.push(`/(customer)/find/tasker-profile/${item.id}?jobId=${jobId}` as any)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      ) : (
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map" size={64} color="#D1D5DB" />
            <Text style={styles.mapText}>{t('tracking.title')}</Text>
            <Text style={styles.mapSubtext}>{t('customer.taskersNearby', { n: taskers.length })}</Text>
            <TouchableOpacity style={styles.switchToList} onPress={() => setViewMode('list')}>
              <Ionicons name="list" size={16} color="#fff" />
              <Text style={styles.switchToListText}>{t('common.search')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  jobSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  jobInfo: {},
  jobName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  jobPrice: { fontSize: 13, color: '#059669', marginTop: 2 },
  viewToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8, backgroundColor: colors.primary + '15', borderRadius: 8 },
  viewToggleText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  mapPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  mapText: { fontSize: 16, fontWeight: '600', color: '#9CA3AF', marginTop: 12 },
  mapSubtext: { fontSize: 13, color: '#D1D5DB', marginTop: 4 },
  switchToList: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
    gap: 6,
  },
  switchToListText: { fontSize: 14, fontWeight: '600', color: '#fff' },
})
