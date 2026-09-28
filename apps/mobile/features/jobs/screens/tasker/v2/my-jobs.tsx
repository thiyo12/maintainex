import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { translateJobStatus } from '@/lib/i18n'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { v2Jobs, v2JobActions } from '@/api/v2-jobs'
import { v2Quotes } from '@/api/v2-quotes'
import { V2Job } from '@/api/v2-types'
import JobLifecycleTracker from '@/components/ui/JobLifecycleTracker'

const getToday = () => new Date().toISOString().split('T')[0]

export default function V2ProviderMyJobsScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const statusColors: Record<string, string> = {
    OPEN: colors.amber,
    IN_PROGRESS: '#3B82F6',
    QUOTE_ACCEPTED: '#8B5CF6',
    ESCROW_DEPOSITED: '#06B6D4',
    COMPLETED: colors.success,
    CANCELLED: colors.error,
  }
  const router = useRouter()
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const today = getToday()

  const loadJobs = useCallback(async () => {
    try {
      const res = await v2Jobs.list('myQuotes=true')
      const allJobs = res.jobs
      const quoted = await Promise.all(
        allJobs.map(async (j) => {
          try {
            const qRes = await v2Quotes.list(j.id)
            const myQuote = qRes.quotes.find((q: any) => q.status !== 'REJECTED')
            return { ...j, myQuote: myQuote || null }
          } catch { return { ...j, myQuote: null } }
        })
      )
      setJobs(quoted)
    } catch (e) {
      console.error('Load my jobs error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  const todayJobs = useMemo(() => {
    return jobs.filter(j => {
      if (j.status === 'COMPLETED' || j.status === 'CANCELLED') return false
      if (!j.preferredDate) return true
      return j.preferredDate === today
    })
  }, [jobs, today])

  const scheduledJobs = useMemo(() => {
    return jobs.filter(j => {
      if (j.status === 'COMPLETED' || j.status === 'CANCELLED') return false
      if (!j.preferredDate) return false
      return j.preferredDate > today
    })
  }, [jobs, today])

  const completedJobs = useMemo(() => {
    return jobs.filter(j => j.status === 'COMPLETED')
  }, [jobs])

  const hasActiveJob = useMemo(() => {
    return jobs.some(j => j.status === 'IN_PROGRESS')
  }, [jobs])

  const dailyJobCount = useMemo(() => {
    const activeToday = jobs.filter(j => {
      if (j.status === 'COMPLETED') return false
      if (!j.preferredDate) return true
      return j.preferredDate === today
    })
    return activeToday.length
  }, [jobs, today])

  const dailyLimitReached = dailyJobCount >= 2

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('tasker.myJobs')}</Text>
          <Text style={styles.headerSub}>{jobs.length} {t('tasker.active')} {t('quotes.quote')}{jobs.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tasker)/jobs/v2/browse')} style={styles.browseBtn}>
          <Text style={styles.browseBtnText}>{t('tasker.browse')}</Text>
        </TouchableOpacity>
      </View>

      {/* Limit Banners */}
      {hasActiveJob && (
        <View style={styles.limitBanner}>
          <Ionicons name="warning-outline" size={16} color="#fff" />
          <Text style={styles.limitBannerText}>{t('tasker.activeJobInProgress')}</Text>
        </View>
      )}
      {dailyLimitReached && !hasActiveJob && (
        <View style={[styles.limitBanner, { backgroundColor: colors.error }]}>
          <Ionicons name="alert-circle-outline" size={16} color="#fff" />
          <Text style={styles.limitBannerText}>{t('tasker.noMoreJobsToday')}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} />
      ) : jobs.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="mail-unread-outline" size={48} color={colors.muted} style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>{t('jobs.noJobs')}</Text>
          <Text style={styles.emptySub}>{t('jobs.checkLater')}</Text>
          <TouchableOpacity onPress={() => router.push('/(tasker)/jobs/v2/browse')} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>{t('tasker.browse')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadJobs} tintColor={colors.amber} />}
        >
          {/* Today's Jobs */}
          {todayJobs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="sunny-outline" size={14} color={colors.amber} /> {t('tasker.todaysJobs')}
              </Text>
              {todayJobs.map((job) => renderJob(job))}
            </View>
          )}

          {/* Scheduled */}
          {scheduledJobs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="calendar-outline" size={14} color={colors.ink} /> {t('tasker.scheduled')}
              </Text>
              {scheduledJobs.map((job) => renderJob(job))}
            </View>
          )}

          {/* Completed */}
          {completedJobs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="checkmark-done-outline" size={14} color={colors.success} /> {t('jobs.status.completed')} ({completedJobs.length})
              </Text>
              {completedJobs.map((job) => renderJob(job))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )

  function renderJob(job: any) {
    return (
      <View key={job.id}>
        <TouchableOpacity
          style={styles.jobCard}
          onPress={() => router.push(`/(tasker)/jobs/v2/manage/${job.id}`)}
          activeOpacity={0.7}
        >
          <View style={styles.cardTop}>
            {job.preferredDate && (
              <View style={styles.datePill}>
                <Ionicons name="calendar-outline" size={11} color={colors.amberDark} />
                <Text style={styles.datePillText}>{job.preferredDate}{job.timeSlot ? ` ${job.timeSlot}` : ''}</Text>
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: statusColors[job.status] || colors.muted }]}>
              <Text style={styles.statusText}>{t(translateJobStatus(job.status))}</Text>
            </View>
          </View>
          <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
          <Text style={styles.jobDesc} numberOfLines={2}>{job.description}</Text>
          <View style={styles.cardFooter}>
            <Text style={styles.jobBudget}>LKR {job.budgetAmount?.toLocaleString() ?? 'Not set'}</Text>
            {job.myQuote ? (
              <View style={styles.myQuotePill}>
                <Text style={styles.myQuoteText}>{t('quotes.yourQuote')}: LKR {job.myQuote.price}</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
        {job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
          <View style={{ paddingHorizontal: 4 }}>
            <JobLifecycleTracker status={job.status} createdAt={job.createdAt} />
            <TouchableOpacity
              style={styles.cancelSmall}
              onPress={() => {
                Alert.alert(t('tasker.cancelQuote'), t('tasker.cancelQuote'), [
                  { text: t('common.cancel'), style: 'cancel' },
                  { text: t('common.submit'), style: 'destructive', onPress: async () => {
                    setCancelling(job.id)
                    try {
                      await v2JobActions.complete(job.id, 'CANCEL')
                      Alert.alert(t('common.success'), t('tasker.cancelQuote'))
                    } catch {}
                    setCancelling(null)
                  }},
                ])
              }}
              disabled={cancelling === job.id}
            >
              {cancelling === job.id ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Text style={styles.cancelSmallText}>{t('common.cancel')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  }
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.ink },
  headerSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  browseBtn: { backgroundColor: colors.amber, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  browseBtnText: { fontSize: 14, fontWeight: '700', color: colors.ink },

  limitBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EF4444', marginHorizontal: 16, padding: 12, borderRadius: 12, marginBottom: 8 },
  limitBannerText: { fontSize: 13, fontWeight: '600', color: '#fff', flex: 1 },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyBtn: { backgroundColor: colors.amber, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 },
  emptyBtnText: { fontSize: 16, fontWeight: '700', color: colors.ink },

  list: { flex: 1, padding: 16, paddingTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 10, gap: 4 },

  jobCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  datePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.amberBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  datePillText: { fontSize: 10, fontWeight: '600', color: colors.amberDark },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  jobTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  jobDesc: { fontSize: 13, color: colors.ink, opacity: 0.6, lineHeight: 20, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobBudget: { fontSize: 15, fontWeight: '700', color: colors.amberDark },
  myQuotePill: { backgroundColor: '#D1FAE5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  myQuoteText: { fontSize: 12, fontWeight: '600', color: colors.success },
  cancelSmall: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 12, marginBottom: 8 },
  cancelSmallText: { fontSize: 12, fontWeight: '600', color: colors.error, textDecorationLine: 'underline' },
})
