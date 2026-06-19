import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../../lib/ThemeContext'
import { v2Jobs, V2Job } from '../../../../lib/api-v2'
import { getAuthToken } from '../../../../lib/api'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'

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
          {jobs.map((job) => (
            <TouchableOpacity
              key={job.id}
              style={styles.jobCard}
              onPress={() => router.push(`/(tasker)/jobs/v2/quote/${job.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={styles.budgetBadge}>
                  <Text style={styles.budgetBadgeText}>LKR {job.budgetAmount}</Text>
                </View>
                <Text style={styles.budgetType}>{job.budgetType}</Text>
              </View>
              <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
              <Text style={styles.jobDesc} numberOfLines={2}>{job.description}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.jobDate}>{t('jobs.posted')} {new Date(job.createdAt).toLocaleDateString()}</Text>
                <View style={styles.quoteBtn}>
                  <Text style={styles.quoteBtnText}>{t('quotes.quote')} →</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
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
  budgetType: { fontSize: 12, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  jobTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  jobDesc: { fontSize: 13, color: colors.ink, opacity: 0.6, lineHeight: 20, marginBottom: 14 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobDate: { fontSize: 12, color: colors.muted },
  quoteBtn: { backgroundColor: colors.amber, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  quoteBtnText: { fontSize: 13, fontWeight: '700', color: colors.ink },
})
