import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CaretLeft, DotsThree } from 'phosphor-react-native'
import { v2Jobs } from '@/api/v2-jobs'
import { V2Job } from '@/api/v2-types'
import { getAuthToken } from '@/api/token'
import { fonts } from '@/lib/fonts'
import { v3 } from '@/theme/v3/tokens'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function compactLkr(value: number) {
  if (!Number.isFinite(value) || value <= 0) return null
  if (value >= 1000000) return 'LKR ' + (value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1) + 'M'
  if (value >= 1000) return 'LKR ' + (value / 1000).toFixed(value % 1000 === 0 ? 0 : 1) + 'K'
  return 'LKR ' + Math.round(value).toLocaleString()
}

function jobBudget(job: any) {
  const smart = job.smartBooking
  const min = Number(smart?.estimatedPriceMin ?? job.budgetMin ?? 0)
  const max = Number(smart?.estimatedPriceMax ?? job.budgetMax ?? job.budgetAmount ?? 0)
  const minLabel = compactLkr(min)
  const maxLabel = compactLkr(max)

  if (minLabel && maxLabel && min !== max) {
    return minLabel.replace('LKR ', 'LKR ') + '–' + maxLabel.replace('LKR ', '')
  }
  return maxLabel || minLabel || 'Budget not set'
}

export default function V2BrowseJobsScreen() {
  const router = useRouter()
  const [jobs, setJobs] = useState<V2Job[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterArea, setFilterArea] = useState<string | null>(null)
  const [taskerCoords, setTaskerCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [inited, setInited] = useState(false)

  const loadJobs = useCallback(async (area?: string | null) => {
    try {
      let params = 'role=provider'
      if (area) params += '&areaId=' + encodeURIComponent(area)
      const res = await v2Jobs.list(params)
      setJobs(res.jobs || [])
    } catch (e) {
      console.error('Browse jobs error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const token = await getAuthToken()
        const res = await fetch(API_URL + '/api/mobile/user/profile', {
          headers: { Authorization: 'Bearer ' + token },
        })
        if (res.ok) {
          const data = await res.json()
          const area = data.areaId || null
          if (area) setFilterArea(area)
          if (data.latitude && data.longitude) setTaskerCoords({ lat: data.latitude, lng: data.longitude })
          await loadJobs(area)
        } else {
          await loadJobs(null)
        }
      } catch (e) {
        console.error('Profile load error:', e)
        await loadJobs(null)
      }
      setInited(true)
    })()
  }, [loadJobs])

  useEffect(() => {
    if (inited) {
      setLoading(true)
      loadJobs(filterArea)
    }
  }, [filterArea, inited, loadJobs])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleButton} activeOpacity={0.72} onPress={() => router.back()}>
          <CaretLeft size={18} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Nearby jobs</Text>
        <TouchableOpacity
          style={styles.circleButton}
          activeOpacity={0.72}
          onPress={() => router.push('/(tasker)/settings/service-area' as any)}
        >
          <DotsThree size={19} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
      </View>

      <View style={styles.heading}>
        <Text style={styles.hero}>Work near you</Text>
        <Text style={styles.subtitle}>Browse manually even when smart matching is active.</Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={v3.colors.ink} />
        </View>
      ) : jobs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No nearby jobs right now.</Text>
          <Text style={styles.emptyText}>Keep your availability on. New matching work will appear here automatically.</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadJobs(filterArea) }} tintColor={v3.colors.ink} />}
        >
          {jobs.map((job: any, index) => {
            const lat = Number(job.latitude)
            const lng = Number(job.longitude)
            const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
            const distance = taskerCoords && hasCoords
              ? haversine(taskerCoords.lat, taskerCoords.lng, lat, lng)
              : null

            const location = distance == null
              ? (job.locationName || job.areaName || 'Nearby')
              : (distance < 1 ? '< 1 km' : distance.toFixed(1) + ' km')

            return (
              <TouchableOpacity
                key={job.id}
                style={styles.jobRow}
                activeOpacity={0.72}
                onPress={() => router.push(('/(tasker)/jobs/v2/quote/' + job.id) as any)}
              >
                <View style={styles.numberCircle}>
                  <Text style={styles.numberText}>{index + 1}</Text>
                </View>
                <View style={styles.jobCopy}>
                  <Text style={styles.jobTitle} numberOfLines={1}>{job.title || 'MaintainEX job'}</Text>
                  <Text style={styles.jobMeta} numberOfLines={1}>{location + ' · ' + jobBudget(job)}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  topBar: {
    height: 76,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 13,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  heading: {
    paddingHorizontal: 18,
    paddingTop: 1,
    paddingBottom: 20,
  },
  hero: {
    fontSize: 25,
    lineHeight: 31,
    fontFamily: fonts.heading,
    color: v3.colors.ink,
    letterSpacing: -0.35,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 10.2,
    lineHeight: 15,
    fontFamily: fonts.bodySemiBold,
    color: v3.colors.textSecondary,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
  },
  list: {
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 8,
  },
  jobRow: {
    height: 58,
    borderRadius: 15,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  numberCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: v3.colors.surfaceGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontSize: 10,
    fontFamily: fonts.heading,
    color: v3.colors.ink,
  },
  jobCopy: {
    flex: 1,
    marginLeft: 8,
    paddingRight: 8,
  },
  jobTitle: {
    fontSize: 11.2,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  jobMeta: {
    marginTop: 3,
    fontSize: 8.8,
    fontFamily: fonts.bodySemiBold,
    color: v3.colors.textSecondary,
  },
  chevron: {
    fontSize: 20,
    fontFamily: fonts.body,
    color: v3.colors.textSecondary,
  },
  empty: {
    marginHorizontal: 18,
    marginTop: 6,
    padding: 20,
    borderRadius: 18,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
  },
  emptyTitle: {
    fontSize: 13,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  emptyText: {
    marginTop: 5,
    fontSize: 10,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: v3.colors.textMuted,
  },
})
