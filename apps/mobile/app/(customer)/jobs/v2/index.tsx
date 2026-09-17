import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { translateJobStatus } from '../../../../lib/i18n'
import { v2Jobs, V2Job } from '../../../../lib/api-v2'
import { ClipboardText, UserCircle, CaretRight } from 'phosphor-react-native'
import { fonts } from '../../../../lib/fonts'
import { v3 } from '../../../../theme/v3/tokens'

const FILTERS = ['All', 'Active', 'Quoted', 'Completed'] as const
type FilterKey = (typeof FILTERS)[number]

const STATUS_FILTER_MAP: Record<FilterKey, string | null> = {
  All: null,
  Active: 'OPEN',
  Quoted: 'IN_PROGRESS',
  Completed: 'COMPLETED',
}

export default function V2MyJobsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const [jobs, setJobs] = useState<V2Job[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('All')

  const loadJobs = useCallback(async () => {
    try {
      const res = await v2Jobs.list()
      setJobs(res.jobs)
    } catch (e) {
      console.error('Load jobs error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  const onRefresh = () => {
    setRefreshing(true)
    loadJobs()
  }

  const filteredJobs = activeFilter === 'All'
    ? jobs
    : jobs.filter((j) => j.status === STATUS_FILTER_MAP[activeFilter])

  const statusPillStyle = (status: string) => {
    switch (status) {
      case 'OPEN': return { bg: v3.colors.amberSoft, text: v3.colors.amberDark }
      case 'IN_PROGRESS': return { bg: v3.colors.infoSoft, text: v3.colors.info }
      case 'COMPLETED': return { bg: v3.colors.surfaceGray, text: v3.colors.textSecondary }
      case 'CANCELLED': return { bg: v3.colors.errorSoft, text: v3.colors.error }
      default: return { bg: v3.colors.surfaceGray, text: v3.colors.textSecondary }
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.appBar}>
        <View style={styles.appBarSpacer} />
        <Text style={styles.appBarTitle}>My jobs</Text>
        <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/(customer)/(tabs)/account' as any)}>
          <UserCircle size={28} color={v3.colors.textSecondary} weight="fill" />
        </TouchableOpacity>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.title}>Everything you've booked.</Text>
        <Text style={styles.subtitle}>Active, quoted, scheduled and completed jobs in one place.</Text>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = activeFilter === f
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => setActiveFilter(f)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{f}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={v3.colors.ink} style={{ marginTop: 60 }} />
      ) : filteredJobs.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <ClipboardText size={34} color={v3.colors.textMuted} weight="light" />
          </View>
          <Text style={styles.emptyTitle}>No jobs yet</Text>
          <Text style={styles.emptySub}>Post your first job to get started.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(customer)/jobs/v2/create')} activeOpacity={0.7}>
            <Text style={styles.emptyBtnText}>Post a job</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={v3.colors.ink} />}
        >
          {filteredJobs.map((job, idx) => {
            const pill = statusPillStyle(job.status)
            return (
              <TouchableOpacity
                key={job.id}
                style={styles.jobCard}
                onPress={() => router.push(`/(customer)/jobs/v2/${job.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.numberCircle}>
                  <Text style={styles.numberText}>{idx + 1}</Text>
                </View>
                <View style={styles.jobContent}>
                  <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                  <Text style={styles.jobMeta}>
                    {new Date(job.createdAt).toLocaleDateString()}
                    {job.locationName ? ` · ${job.locationName}` : ''}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                  <Text style={[styles.statusPillText, { color: pill.text }]}>{t(translateJobStatus(job.status))}</Text>
                </View>
                <CaretRight size={16} color={v3.colors.textMuted} />
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
  appBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  appBarSpacer: { width: 28 },
  appBarTitle: { fontFamily: fonts.headingBold, fontSize: 16, color: v3.colors.textPrimary, textAlign: 'center' },
  profileBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 },
  title: { fontFamily: fonts.heading, fontSize: 25, color: v3.colors.textPrimary, lineHeight: 31 },
  subtitle: { fontFamily: fonts.body, fontSize: 11, color: v3.colors.textSecondary, marginTop: 4, lineHeight: 17 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 },
  filterPill: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 14, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line },
  filterPillActive: { backgroundColor: v3.colors.ink, borderColor: v3.colors.ink },
  filterPillText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: v3.colors.textSecondary },
  filterPillTextActive: { color: v3.colors.paper },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 24 },
  jobCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: v3.colors.paper, borderRadius: v3.radius.lg, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: v3.colors.line },
  numberCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  numberText: { fontFamily: fonts.headingBold, fontSize: 10, color: v3.colors.ink },
  jobContent: { flex: 1, marginRight: 10 },
  jobTitle: { fontFamily: fonts.headingBold, fontSize: 12, color: v3.colors.textPrimary, marginBottom: 3 },
  jobMeta: { fontFamily: fonts.body, fontSize: 9.5, color: v3.colors.textMuted },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginRight: 8 },
  statusPillText: { fontFamily: fonts.bodySemiBold, fontSize: 9 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { width: 70, height: 70, borderRadius: 22, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.headingBold, fontSize: 19, color: v3.colors.textPrimary, marginTop: 16, marginBottom: 7 },
  emptySub: { fontFamily: fonts.body, fontSize: 12, color: v3.colors.textSecondary, textAlign: 'center', lineHeight: 19, marginBottom: 22 },
  emptyBtn: { backgroundColor: v3.colors.ink, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  emptyBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: v3.colors.paper },
})
