import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { MapPin, ClockAfternoon, Wallet } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '@/lib/ThemeContext'
import { v2Jobs } from '@/api/v2-jobs'
import { V2Job } from '@/api/v2-types'
import { getAuthToken } from '@/api/token'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function V2BrowseJobsScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { t } = useTranslation()
  const [jobs, setJobs] = useState<V2Job[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterArea, setFilterArea] = useState<string | null>(null)
  const [filterCity, setFilterCity] = useState<string | null>(null)
  const [taskerCoords, setTaskerCoords] = useState<{ lat: number; lng: number } | null>(null)

  const [inited, setInited] = useState(false)

  const loadJobs = useCallback(async (area?: string | null) => {
    try {
      let params = 'role=provider'
      if (area) params += `&areaId=${area}`
      const res = await v2Jobs.list(params)
      setJobs(res.jobs)
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
        const res = await fetch(`${API_URL}/api/mobile/user/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          const city = data.cityId || null
          const area = data.areaId || null
          if (city) setFilterCity(city)
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
  }, [])

  useEffect(() => {
    if (inited) {
      setLoading(true)
      loadJobs(filterArea)
    }
  }, [filterArea, inited])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('tasker.browse')}</Text>
          <Text style={styles.headerSub}>{t('location.showing')} {filterCity || t('location.all')}</Text>
        </View>
        <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterArea(null)} activeOpacity={0.7}>
          <Ionicons name={filterArea ? 'funnel' : 'funnel-outline'} size={20} color={colors.amber} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} />
      ) : jobs.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={48} color={colors.muted} style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>{t('jobs.noJobs')}</Text>
          <Text style={styles.emptySub}>{t('jobs.checkLater')}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadJobs} tintColor={colors.amber} />}
        >
          {jobs.map((job) => {
            const smart = (job as any).smartBooking
            const jobLat = (job as any).latitude as number | null
            const jobLng = (job as any).longitude as number | null
            const dist = taskerCoords && jobLat && jobLng ? haversine(taskerCoords.lat, taskerCoords.lng, jobLat, jobLng) : null
            const answers = smart?.answers ? Object.entries(smart.answers) as [string, any][] : []
            const estMin = smart?.estimatedPriceMin as number | null
            const estMax = smart?.estimatedPriceMax as number | null
            const schedDate = smart?.preferredDate || (job as any).preferredDate as string | null
            const timeSlot = smart?.timeSlot as string | null
            return (
              <TouchableOpacity
                key={job.id}
                style={styles.jobCard}
                onPress={() => router.push(`/(tasker)/jobs/v2/quote/${job.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.budgetBadge}>
                    <Text style={styles.budgetBadgeText}>LKR {job.budgetAmount?.toLocaleString() ?? 'Not set'}</Text>
                  </View>
                  {dist != null && (
                    <View style={styles.distanceBadge}>
                      <MapPin size={12} color={colors.muted} weight="fill" />
                      <Text style={styles.distanceText}>{dist < 1 ? '< 1' : dist.toFixed(1)} km away</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                {answers.length > 0 && (
                  <View style={styles.answersSummary}>
                    {answers.slice(0, 3).map(([k, v]) => {
                      const picks = Array.isArray(v) ? v : [v]
                      return (
                        <Text key={k} style={[styles.answerLine, { color: colors.muted }]} numberOfLines={1}>
                          {String(picks.join(', '))}
                        </Text>
                      )
                    })}
                  </View>
                )}
                {estMin != null && (
                  <View style={styles.estimateRow}>
                    <Wallet size={13} color={colors.amberDark} weight="fill" />
                    <Text style={[styles.estimateText, { color: colors.amberDark }]}>
                      LKR {estMin.toLocaleString()} – {estMax?.toLocaleString?.() ?? ''}
                    </Text>
                  </View>
                )}
                {schedDate && (
                  <View style={styles.metaRow}>
                    <ClockAfternoon size={12} color={colors.muted} weight="fill" />
                    <Text style={[styles.metaText, { color: colors.muted }]}>
                      {new Date(schedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {timeSlot ? ` · ${timeSlot}` : ''}
                    </Text>
                  </View>
                )}
                <View style={styles.cardFooter}>
                  <Text style={styles.jobDate}>{t('jobs.posted')} {new Date(job.createdAt).toLocaleDateString()}</Text>
                  <View style={styles.quoteBtn}>
                    <Text style={styles.quoteBtnText}>{t('quotes.quote')} →</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.ink },
  headerSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  filterBtn: { backgroundColor: colors.white, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: colors.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22 },

  list: { flex: 1, padding: 16, paddingTop: 4 },
  jobCard: { backgroundColor: colors.white, borderRadius: 16, padding: 18, marginBottom: 12, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  budgetBadge: { backgroundColor: colors.amberBg, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  budgetBadgeText: { fontSize: 14, fontWeight: '700', color: colors.amberDark },
  distanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  distanceText: { fontSize: 12, color: colors.muted },
  budgetType: { fontSize: 12, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  jobTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  jobDesc: { fontSize: 13, color: colors.ink, opacity: 0.6, lineHeight: 20, marginBottom: 14 },
  answersSummary: { marginBottom: 8 },
  answerLine: { fontSize: 12, lineHeight: 18 },
  estimateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  estimateText: { fontSize: 14, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  metaText: { fontSize: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobDate: { fontSize: 12, color: colors.muted },
  quoteBtn: { backgroundColor: colors.amber, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  quoteBtnText: { fontSize: 13, fontWeight: '700', color: colors.ink },
})
