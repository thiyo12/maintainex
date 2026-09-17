import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Alert, Modal } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Warning, WarningCircle, EnvelopeSimple, Sun, Calendar, Checks, X, MapTrifold, Wrench, ChatCircleDots, NavigationArrow } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'
import { translateJobStatus } from '../../../lib/i18n'
import { useColors } from '../../../lib/ThemeContext'
import { v2Jobs, v2Quotes, v2JobActions } from '../../../lib/api-v2'
import JobLifecycleTracker from '../../../components/ui/JobLifecycleTracker'
import NewChatModal from '../../../components/chat/NewChatModal'

const getToday = () => new Date().toISOString().split('T')[0]

export default function TaskerMyJobs() {
  const { t } = useTranslation()
  const router = useRouter()
  const colors = useColors()
  const styles = makeStyles(colors)
  const statusColors: Record<string, string> = {
    OPEN: colors.amber,
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
      const allJobs = res.jobs || []
      const quoted = await Promise.all(
        allJobs.map(async (j: any) => {
          try {
            const qRes = await v2Quotes.list(j.id)
            const myQuote = qRes.quotes.find((q: any) => q.status !== 'REJECTED')
            return { ...j, myQuote: myQuote || null }
          } catch {
            return { ...j, myQuote: null }
          }
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

  const todayJobs = useMemo(() => jobs.filter((j) => {
    if (j.status === 'COMPLETED' || j.status === 'CANCELLED') return false
    if (!j.preferredDate) return true
    return j.preferredDate === today
  }), [jobs, today])

  const scheduledJobs = useMemo(() => jobs.filter((j) => {
    if (j.status === 'COMPLETED' || j.status === 'CANCELLED') return false
    if (!j.preferredDate) return false
    return j.preferredDate > today
  }), [jobs, today])

  const completedJobs = useMemo(() => jobs.filter((j) => j.status === 'COMPLETED'), [jobs])
  const hasActiveJob = useMemo(() => jobs.some((j) => j.status === 'IN_PROGRESS'), [jobs])
  const dailyJobCount = useMemo(() => jobs.filter((j) => {
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
      {
        text: t('common.submit'),
        style: 'destructive',
        onPress: async () => {
          setCancelling(job.id)
          try {
            await v2JobActions.complete(job.id, 'CANCEL')
            Alert.alert(t('common.success'), t('tasker.cancelQuote'))
            await loadJobs()
          } catch (e: any) {
            Alert.alert(t('common.error'), e?.message || t('errors.generic'))
          } finally {
            setCancelling(null)
          }
        },
      },
    ])
  }

  const hasCoords = (job: any) => Number.isFinite(Number(job?.latitude)) && Number.isFinite(Number(job?.longitude))

  const renderJob = (job: any) => {
    const isActive = job.status !== 'COMPLETED' && job.status !== 'CANCELLED'
    return (
      <View key={job.id} style={styles.jobCardWrap}>
        <TouchableOpacity style={styles.jobCard} onPress={() => router.push(`/(tasker)/jobs/v2/manage/${job.id}` as any)} activeOpacity={0.7}>
          <View style={styles.cardTop}>
            {job.preferredDate ? (
              <View style={styles.datePill}>
                <Calendar size={11} color={colors.amberDark} weight="fill" />
                <Text style={styles.datePillText}>{job.preferredDate}{job.timeSlot ? ` ${job.timeSlot}` : ''}</Text>
              </View>
            ) : <View />}
            <View style={[styles.statusBadge, { backgroundColor: statusColors[job.status] || colors.muted }]}>
              <Text style={styles.statusText}>{t(translateJobStatus(job.status))}</Text>
            </View>
          </View>

          <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
          <Text style={styles.jobDesc} numberOfLines={2}>{job.description}</Text>

          <View style={styles.cardFooter}>
            <Text style={styles.jobBudget}>LKR {job.budgetAmount?.toLocaleString?.() ?? 'Not set'}</Text>
            {job.myQuote ? (
              <View style={styles.myQuotePill}>
                <Text style={styles.myQuoteText}>{t('quotes.yourQuote')}: LKR {Number(job.myQuote.price || 0).toLocaleString()}</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>

        {isActive ? (
          <>
            <View style={styles.footerPad}>
              <JobLifecycleTracker status={job.status} createdAt={job.createdAt} />
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/(tasker)/jobs/v2/manage/${job.id}` as any)}>
                <Wrench size={15} color={colors.amberDark} weight="bold" />
                <Text style={styles.actionText}>{t('tasker.manage')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  setChatJob(job)
                  if (job.customerId) setMsgRecipient({ id: job.customerId, name: job.customer?.name || 'Customer' })
                }}
              >
                <ChatCircleDots size={15} color={colors.amberDark} weight="fill" />
                <Text style={styles.actionText}>{t('tasker.messageCustomer')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => openTrack(job)}>
                <NavigationArrow size={15} color={colors.amberDark} weight="fill" />
                <Text style={styles.actionText}>{t('ui.track')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} disabled={cancelling === job.id} onPress={() => cancelJob(job)}>
                {cancelling === job.id ? <ActivityIndicator size="small" color={colors.error} /> : <Text style={styles.cancelText}>{t('common.cancel')}</Text>}
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('tasker.myJobs')}</Text>
          <Text style={styles.headerSub}>{jobs.length} {jobs.length !== 1 ? t('tasker.activeJobs') : t('tasker.active')}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tasker)/jobs/v2/browse' as any)} style={styles.browseBtn}>
          <Text style={styles.browseBtnText}>{t('tasker.browse')}</Text>
        </TouchableOpacity>
      </View>

      {hasActiveJob ? (
        <View style={styles.limitBanner}>
          <Warning size={16} color={colors.white} weight="fill" />
          <Text style={styles.limitBannerText}>{t('tasker.activeJobInProgress')}</Text>
        </View>
      ) : null}
      {dailyLimitReached && !hasActiveJob ? (
        <View style={[styles.limitBanner, { backgroundColor: colors.error }]}>
          <WarningCircle size={16} color={colors.white} weight="fill" />
          <Text style={styles.limitBannerText}>{t('tasker.noMoreJobsToday')}</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} />
      ) : jobs.length === 0 ? (
        <View style={styles.empty}>
          <EnvelopeSimple size={48} color={colors.muted} weight="light" style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>{t('jobs.noJobs')}</Text>
          <Text style={styles.emptySub}>{t('jobs.checkLater')}</Text>
          <TouchableOpacity onPress={() => router.push('/(tasker)/jobs/v2/browse' as any)} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>{t('tasker.browse')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadJobs() }} tintColor={colors.amber} />}
        >
          {todayJobs.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeadingRow}>
                <Sun size={15} color={colors.amberDark} weight="fill" />
                <Text style={styles.sectionTitle}>{t('tasker.todaysJobs')}</Text>
              </View>
              {todayJobs.map(renderJob)}
            </View>
          ) : null}

          {scheduledJobs.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeadingRow}>
                <Calendar size={15} color={colors.amberDark} weight="fill" />
                <Text style={styles.sectionTitle}>{t('tasker.scheduled')}</Text>
              </View>
              {scheduledJobs.map(renderJob)}
            </View>
          ) : null}

          {completedJobs.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeadingRow}>
                <Checks size={15} color={colors.success} weight="bold" />
                <Text style={styles.sectionTitle}>{t('jobs.status.completed')} ({completedJobs.length})</Text>
              </View>
              {completedJobs.map(renderJob)}
            </View>
          ) : null}
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
                <X size={22} color={colors.ink} />
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
                <Marker coordinate={{ latitude: Number(trackJob.latitude), longitude: Number(trackJob.longitude) }} pinColor={colors.amber} title={trackJob.title} />
              </MapView>
            ) : (
              <View style={styles.mapEmpty}>
                <MapTrifold size={40} color={colors.muted} weight="regular" />
                <Text style={styles.mapEmptyText}>{t('tasker.noJobLocation')}</Text>
              </View>
            )}
            {trackJob ? <Text style={styles.modalSub} numberOfLines={2}>{trackJob.title}</Text> : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 24, fontFamily: 'Outfit_800ExtraBold', color: colors.ink },
  headerSub: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: colors.muted, marginTop: 2 },
  browseBtn: { backgroundColor: colors.ink, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  browseBtnText: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: colors.white },
  limitBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.ink, marginHorizontal: 16, padding: 12, borderRadius: 12, marginBottom: 8 },
  limitBannerText: { fontSize: 13, fontFamily: 'Outfit_600SemiBold', color: colors.white, flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontFamily: 'Outfit_800ExtraBold', color: colors.ink, marginBottom: 8 },
  emptySub: { fontSize: 14, fontFamily: 'Outfit_400Regular', color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyBtn: { backgroundColor: colors.amber, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  emptyBtnText: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: colors.ink },
  list: { flex: 1, paddingHorizontal: 16 },
  section: { marginBottom: 20 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: colors.ink },
  jobCardWrap: { backgroundColor: colors.white, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  jobCard: { padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  datePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.amberBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  datePillText: { fontSize: 10, fontFamily: 'Outfit_600SemiBold', color: colors.amberDark },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: 'Outfit_700Bold', color: colors.white },
  jobTitle: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: colors.ink, marginBottom: 6 },
  jobDesc: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: colors.muted, lineHeight: 20, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  jobBudget: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: colors.amberDark },
  myQuotePill: { backgroundColor: colors.amberBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  myQuoteText: { fontSize: 10, fontFamily: 'Outfit_600SemiBold', color: colors.amberDark },
  footerPad: { paddingHorizontal: 14, paddingBottom: 8 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.amberBg, borderRadius: 10 },
  actionText: { fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: colors.amberDark },
  cancelBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.error },
  cancelText: { fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: colors.error },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 32 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontFamily: 'Outfit_700Bold', color: colors.ink },
  map: { width: '100%', height: 320, borderRadius: 16 },
  mapEmpty: { height: 220, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 8 },
  mapEmptyText: { fontSize: 13, fontFamily: 'Outfit_500Medium', color: colors.muted },
  modalSub: { fontSize: 13, fontFamily: 'Outfit_500Medium', color: colors.ink, marginTop: 12 },
})
