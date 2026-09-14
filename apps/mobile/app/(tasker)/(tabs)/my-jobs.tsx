import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Alert, Modal } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'
import { translateJobStatus } from '../../../lib/i18n'
import { colors, spacing, radius, typography, shadows } from '../../../lib/design'
import { v2Jobs, v2Quotes, v2JobActions } from '../../../lib/api-v2'
import JobLifecycleTracker from '../../../components/ui/JobLifecycleTracker'
import NewChatModal from '../../../components/chat/NewChatModal'

const getToday = () => new Date().toISOString().split('T')[0]

export default function TaskerMyJobs() {
  const { t } = useTranslation()
  const router = useRouter()
  const statusColors: Record<string, string> = {
    OPEN: colors.accent,
    QUOTE_ACCEPTED: '#8B5CF6',
    ESCROW_DEPOSITED: '#06B6D4',
    IN_PROGRESS: '#3B82F6',
    COMPLETED: colors.success,
    CANCELLED: colors.error,
  }

  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [trackJob, setTrackJob] = useState<any>(null)
  const [chatJob, setChatJob] = useState<any>(null)
  const [msgRecipient, setMsgRecipient] = useState<{ id: string; name: string } | null>(null)
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

  const todayJobs = useMemo(() => jobs.filter(j => {
    if (j.status === 'COMPLETED' || j.status === 'CANCELLED') return false
    if (!j.preferredDate) return true
    return j.preferredDate === today
  }), [jobs, today])

  const scheduledJobs = useMemo(() => jobs.filter(j => {
    if (j.status === 'COMPLETED' || j.status === 'CANCELLED') return false
    if (!j.preferredDate) return false
    return j.preferredDate > today
  }), [jobs, today])

  const completedJobs = useMemo(() => jobs.filter(j => j.status === 'COMPLETED'), [jobs])

  const hasActiveJob = useMemo(() => jobs.some(j => j.status === 'IN_PROGRESS'), [jobs])

  const dailyJobCount = useMemo(() => jobs.filter(j => {
    if (j.status === 'COMPLETED') return false
    if (!j.preferredDate) return true
    return j.preferredDate === today
  }).length, [jobs, today])

  const dailyLimitReached = dailyJobCount >= 2

  const openTrack = (job: any) => {
    if (!job.latitude && !job.longitude) {
      Alert.alert(t('tasker.manage'), t('tasker.noJobLocation'))
      return
    }
    setTrackJob(job)
  }

  const cancelJob = (job: any) => {
    Alert.alert(t('tasker.cancelQuote'), t('tasker.cancelQuote'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.submit'), style: 'destructive', onPress: async () => {
        setCancelling(job.id)
        try {
          await v2JobActions.complete(job.id, 'CANCEL')
          Alert.alert(t('common.success'), t('tasker.cancelQuote'))
          loadJobs()
        } catch {}
        setCancelling(null)
      }},
    ])
  }

  const hasCoords = (job: any) => Number(job.latitude) && Number(job.longitude)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('tasker.myJobs')}</Text>
          <Text style={styles.headerSub}>{jobs.length} {jobs.length !== 1 ? t('tasker.activeJobs') : t('tasker.active')}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tasker)/jobs/v2/browse')} style={styles.browseBtn}>
          <Text style={styles.browseBtnText}>{t('tasker.browse')}</Text>
        </TouchableOpacity>
      </View>

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
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 60 }} />
      ) : jobs.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="mail-unread-outline" size={48} color={colors.textMuted} style={{ marginBottom: 16 }} />
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadJobs} tintColor={colors.accent} />}
        >
          {todayJobs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="sunny-outline" size={14} color={colors.accent} /> {t('tasker.todaysJobs')}
              </Text>
              {todayJobs.map((job) => renderJob(job))}
            </View>
          )}

          {scheduledJobs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="calendar-outline" size={14} color={colors.accent} /> {t('tasker.scheduled')}
              </Text>
              {scheduledJobs.map((job) => renderJob(job))}
            </View>
          )}

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

      <NewChatModal
        visible={!!msgRecipient}
        onClose={() => setMsgRecipient(null)}
        recipient={msgRecipient}
        jobId={chatJob?.id}
        jobTitle={chatJob?.title}
        prefilled={`Hi ${chatJob?.customer?.name || 'there'}, I'd like to discuss "${chatJob?.title || 'your job'}".`}
      />

      <Modal visible={!!trackJob} transparent animationType="slide" onRequestClose={() => setTrackJob(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{t('tracking.jobLocation')}</Text>
              <TouchableOpacity onPress={() => setTrackJob(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            {trackJob && hasCoords(trackJob) ? (
              <MapView
                style={styles.map}
                provider={PROVIDER_DEFAULT}
                initialRegion={{
                  latitude: Number(trackJob.latitude),
                  longitude: Number(trackJob.longitude),
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                }}
              >
                <Marker
                  coordinate={{ latitude: Number(trackJob.latitude), longitude: Number(trackJob.longitude) }}
                  pinColor={colors.accent}
                  title={trackJob.title}
                />
              </MapView>
            ) : (
              <View style={styles.mapEmpty}>
                <Ionicons name="map-outline" size={40} color={colors.textMuted} />
                <Text style={styles.mapEmptyText}>{t('tasker.noJobLocation')}</Text>
              </View>
            )}
            {trackJob && <Text style={styles.modalSub} numberOfLines={2}>{trackJob.title}</Text>}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )

  function renderJob(job: any) {
    const isActive = job.status !== 'COMPLETED' && job.status !== 'CANCELLED'
    return (
      <View key={job.id} style={styles.jobCardWrap}>
        <TouchableOpacity
          style={styles.jobCard}
          onPress={() => router.push(`/(tasker)/jobs/v2/manage/${job.id}`)}
          activeOpacity={0.7}
        >
          <View style={styles.cardTop}>
            {job.preferredDate && (
              <View style={styles.datePill}>
                <Ionicons name="calendar-outline" size={11} color={colors.accent} />
                <Text style={styles.datePillText}>{job.preferredDate}{job.timeSlot ? ` ${job.timeSlot}` : ''}</Text>
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: statusColors[job.status] || colors.textMuted }]}>
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

        {isActive && (
          <>
            <View style={styles.footerPad}>
              <JobLifecycleTracker status={job.status} createdAt={job.createdAt} />
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/(tasker)/jobs/v2/manage/${job.id}`)}>
                <Ionicons name="construct-outline" size={15} color={colors.accent} />
                <Text style={styles.actionText}>{t('tasker.manage')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  setChatJob(job)
                  setMsgRecipient({ id: job.customerId, name: job.customer?.name || t('jobDetail.provider') })
                }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.accent} />
                <Text style={styles.actionText}>{t('tasker.messageCustomer')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => openTrack(job)}>
                <Ionicons name="navigate-outline" size={15} color={colors.accent} />
                <Text style={styles.actionText}>{t('ui.track')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                disabled={cancelling === job.id}
                onPress={() => cancelJob(job)}
              >
                {cancelling === job.id ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTitle: { ...typography.h2, fontSize: 22 },
  headerSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  browseBtn: { backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.md },
  browseBtnText: { fontSize: 14, fontWeight: '700', color: colors.background },

  limitBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EF4444', marginHorizontal: spacing.md, padding: 12, borderRadius: radius.md, marginBottom: 8 },
  limitBannerText: { fontSize: 13, fontWeight: '600', color: '#fff', flex: 1 },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyBtn: { backgroundColor: colors.accent, paddingHorizontal: 28, paddingVertical: 14, borderRadius: radius.md },
  emptyBtnText: { fontSize: 16, fontWeight: '700', color: colors.background },

  list: { flex: 1, padding: spacing.md, paddingTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { ...typography.label, color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 10 },

  jobCardWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  jobCard: { padding: spacing.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  datePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accentSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
  datePillText: { fontSize: 10, fontWeight: '600', color: colors.accent },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  statusText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  jobTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  jobDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobBudget: { fontSize: 15, fontWeight: '700', color: colors.accent },
  myQuotePill: { backgroundColor: colors.successSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
  myQuoteText: { fontSize: 12, fontWeight: '600', color: colors.success },

  footerPad: { paddingHorizontal: spacing.md },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  cancelBtn: { marginLeft: 'auto', padding: 8 },
  cancelText: { fontSize: 12, fontWeight: '600', color: colors.error, textDecorationLine: 'underline' },

  modalWrap: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { ...typography.h3, color: colors.textPrimary },
  map: { height: 260, borderRadius: radius.md, overflow: 'hidden' },
  mapEmpty: { height: 220, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh, gap: 8 },
  mapEmptyText: { color: colors.textSecondary, fontSize: 13 },
  modalSub: { color: colors.textSecondary, fontSize: 13, marginTop: spacing.md },
})