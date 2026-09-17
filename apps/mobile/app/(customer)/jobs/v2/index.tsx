import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useColors } from '../../../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { translateJobStatus } from '../../../../lib/i18n'
import { v2Jobs, V2Job } from '../../../../lib/api-v2'
import { ClipboardText } from 'phosphor-react-native'

export default function V2MyJobsScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const statusColors: Record<string, string> = {
    OPEN: colors.amber,
    IN_PROGRESS: '#3B82F6',
    COMPLETED: colors.success,
    CANCELLED: colors.error,
  }
  const [jobs, setJobs] = useState<V2Job[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

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

  const onRefresh = () => { setRefreshing(true); loadJobs() }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t('marketplace.title')}</Text>
          <Text style={styles.subtitle}>{t('marketplace.count', { n: jobs.length })}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(customer)/jobs/v2/create')} style={styles.createBtn}>
          <Text style={styles.createBtnText}>{t('marketplace.new')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} />
      ) : jobs.length === 0 ? (
        <View style={styles.empty}>
          <ClipboardText size={48} color={colors.muted} style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>{t('marketplace.noJobs')}</Text>
          <Text style={styles.emptySub}>{t('marketplace.noJobsDesc')}</Text>
          <TouchableOpacity onPress={() => router.push('/(customer)/jobs/v2/create')} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>{t('marketplace.postJob')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} />}
        >
          {jobs.map((job) => (
            <TouchableOpacity key={job.id} style={styles.jobCard} onPress={() => router.push(`/(customer)/jobs/v2/${job.id}`)} activeOpacity={0.7}>
              <View style={styles.cardTop}>
                <View style={[styles.statusDot, { backgroundColor: statusColors[job.status] || colors.muted }]} />
                <View style={[styles.statusBadge, { backgroundColor: statusColors[job.status] || colors.muted }]}>
                  <Text style={styles.statusText}>{t(translateJobStatus(job.status))}</Text>
                </View>
              </View>
              <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
              <Text style={styles.jobDesc} numberOfLines={2}>{job.description}</Text>
              <View style={styles.cardFooter}>
                <View style={styles.budgetPill}>
                  <Text style={styles.budgetText}>LKR {job.budgetAmount?.toLocaleString() ?? 'Not set'}</Text>
                </View>
                <Text style={styles.jobDate}>{new Date(job.createdAt).toLocaleDateString()}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.surface },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  createBtn: { backgroundColor: colors.amber, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  createBtnText: { fontSize: 14, fontWeight: '700', color: colors.ink },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyBtn: { backgroundColor: colors.amber, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 },
  emptyBtnText: { fontSize: 16, fontWeight: '700', color: colors.ink },

  list: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  jobCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  jobTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  jobDesc: { fontSize: 13, color: colors.ink, opacity: 0.6, lineHeight: 20, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetPill: { backgroundColor: colors.amberBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  budgetText: { fontSize: 13, fontWeight: '700', color: colors.amberDark },
  jobDate: { fontSize: 12, color: colors.muted },
})
