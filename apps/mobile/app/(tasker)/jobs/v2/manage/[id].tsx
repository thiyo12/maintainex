import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, TextInput } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Calendar, MapPin, ChatCircleDots, NavigationArrow, Radio, ShieldCheck, Hourglass, Flag, CheckCircle, ArrowCircleRight, MagnifyingGlass, Camera, FileText, CaretLeft, Wrench } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { translateJobStatus } from '../../../../../lib/i18n'
import { useColors } from '../../../../../lib/ThemeContext'
import { fonts } from '../../../../../lib/fonts'
import { v3 } from '../../../../../theme/v3/tokens'
import { v2Jobs, v2JobActions, V2Job } from '../../../../../lib/api-v2'
import NewChatModal from '../../../../../components/chat/NewChatModal'
import * as Location from 'expo-location'

export default function V2ProviderManageJobScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const statusColors: Record<string, string> = {
    OPEN: colors.amber,
    IN_PROGRESS: '#3B82F6',
    QUOTE_ACCEPTED: '#8B5CF6',
    ESCROW_DEPOSITED: '#06B6D4',
    COMPLETED: colors.success,
    COMPLETION_PENDING: colors.amber,
    CANCELLED: colors.error,
    DISPUTED: colors.error,
  }
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<V2Job | null>(null)
  const [workspace, setWorkspace] = useState<any>(null)
  const [escrow, setEscrow] = useState<any>(null)
  const [reviews, setReviews] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [nextJob, setNextJob] = useState<V2Job | null>(null)

  const [reviewQuality, setReviewQuality] = useState('5')
  const [reviewComm, setReviewComm] = useState('5')
  const [reviewExp, setReviewExp] = useState('5')
  const [reviewComment, setReviewComment] = useState('')

  const [locationSharing, setLocationSharing] = useState(false)
  const [msgRecipient, setMsgRecipient] = useState<{ id: string; name: string } | null>(null)

  const loadJob = async () => {
    try {
      const res = await v2Jobs.get(id)
      setJob(res.job)
      setWorkspace(res.job.workspace || null)
      setEscrow(res.job.escrow || null)
      setReviews(res.job.reviews || null)
      loadNextJob()
    } catch (e) {
      Alert.alert(t('common.error'), t('errors.jobNotFound'))
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const loadNextJob = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await v2Jobs.list('myQuotes=true')
      const next = res.jobs
        .filter((j: any) => j.status === 'QUOTE_ACCEPTED' && j.id !== id)
        .sort((a: any, b: any) => {
          const aDate = a.preferredDate || today
          const bDate = b.preferredDate || today
          return aDate.localeCompare(bDate)
        })[0]
      setNextJob(next || null)
    } catch { setNextJob(null) }
  }

  useEffect(() => { loadJob() }, [id])

  // Send tasker location every 30s while sharing. Foreground-only: updates
  // pause automatically when the app is backgrounded (acceptable by design).
  useEffect(() => {
    if (!locationSharing || !id) return
    const interval = setInterval(async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({})
        const token = await (await import('../../../../../lib/api')).getAuthToken()
        await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'}/api/mobile/taskers/location`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }),
        })
      } catch {}
    }, 30000)
    return () => clearInterval(interval)
  }, [locationSharing, id])

  // Auto-stop sharing when the job completes or the workspace moves past ACCEPTED
  useEffect(() => {
    if (!locationSharing) return
    const done = workspace && !['ACCEPTED', 'IN_PROGRESS'].includes(workspace.progressStatus)
    if (done) setLocationSharing(false)
  }, [workspace?.progressStatus, locationSharing])

  const startLocationSharing = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('errors.locationPermission'))
        return
      }
      setLocationSharing(true)
      await handleUpdateProgress('IN_PROGRESS')
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    }
  }

  const stopLocationSharing = async () => {
    setLocationSharing(false)
  }

  const handleMarkComplete = async () => {
    setActionLoading('complete')
    try {
      await v2JobActions.complete(id, 'MARK_COMPLETE')
      Alert.alert(t('common.done'), t('jobDetail.confirmedStartDesc'))
      await loadJob()
    } catch (e: any) { Alert.alert(t('common.error'), e.message) }
    finally { setActionLoading('') }
  }

  const handleUpdateProgress = async (status: string) => {
    setActionLoading(status)
    try {
      await v2JobActions.updateProgress(id, status)
      loadJob()
    } catch (e: any) { Alert.alert(t('common.error'), e.message) }
    finally { setActionLoading('') }
  }

  const handleSubmitReview = async () => {
    setActionLoading('review')
    try {
      await v2JobActions.createReview(id, {
        reviewType: 'PROVIDER_REVIEWS_CUSTOMER',
        cooperation: parseInt(reviewCoop),
        communication: parseInt(reviewComm),
        overallExperience: parseInt(reviewExp),
        comment: reviewComment || undefined,
      })
      Alert.alert(t('receipt.reviewSubmitted'), t('receipt.reviewSubmittedDesc'))
      loadJob()
    } catch (e: any) { Alert.alert(t('common.error'), e.message) }
    finally { setActionLoading('') }
  }

  const [reviewCoop, setReviewCoop] = useState('5')

  const handleDispute = async () => {
    Alert.alert(t('dispute.title'), t('dispute.describeIssueDesc'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('dispute.submitBtn'), style: 'destructive', onPress: async () => {
        setActionLoading('dispute')
        try {
          const res = await v2JobActions.dispute(id)
          Alert.alert(t('jobDetail.disputeRaised'), t('jobDetail.disputeRaisedDesc'))
          loadJob()
        } catch (e: any) { Alert.alert(t('common.error'), e.message) }
        finally { setActionLoading('') }
      }},
    ])
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loading}><ActivityIndicator size="small" color={v3.colors.ink} /></View>
      </SafeAreaView>
    )
  }

  if (!job) return null

  const progressStatus = workspace?.progressStatus || (
    job.status === 'IN_PROGRESS'
      ? 'IN_PROGRESS'
      : job.status === 'COMPLETED'
        ? 'COMPLETED'
        : ['QUOTE_ACCEPTED', 'PENDING_PAYMENT', 'ESCROW_DEPOSITED'].includes(job.status)
          ? 'ACCEPTED'
          : job.status
  )

  const isAccepted = progressStatus === 'ACCEPTED'
  const isInProgress = progressStatus === 'IN_PROGRESS'
  const isWaiting = progressStatus === 'COMPLETION_REQUESTED' || job.status === 'COMPLETION_PENDING'
  const isCompleted = job.status === 'COMPLETED' || progressStatus === 'COMPLETED'
  const canDispute = job.status !== 'COMPLETED' && job.status !== 'CANCELLED'

  const customerName = job.customer?.name || 'Customer'
  const customerInitial = customerName.trim().charAt(0).toUpperCase() || 'C'
  const scheduleLabel = job.preferredDate
    ? [job.preferredDate, job.timeSlot].filter(Boolean).join(' · ')
    : 'Schedule confirmed in job details'

  const ActionBtn = ({ label, loadingKey, onPress, outline = false }: { label: string; loadingKey: string; onPress: () => void; outline?: boolean }) => (
    <TouchableOpacity
      style={[outline ? styles.secondaryAction : styles.primaryAction, actionLoading !== '' && styles.disabled]}
      onPress={onPress}
      disabled={actionLoading !== ''}
      activeOpacity={0.78}
    >
      {actionLoading === loadingKey ? (
        <ActivityIndicator size="small" color={outline ? v3.colors.ink : v3.colors.paper} />
      ) : (
        <Text style={outline ? styles.secondaryActionText : styles.primaryActionText}>{label}</Text>
      )}
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleButton} activeOpacity={0.72} onPress={() => router.back()}>
          <CaretLeft size={17} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <View style={styles.topCopy}>
          <Text style={styles.topTitle}>{isCompleted ? 'Completed job' : 'Active job'}</Text>
          <Text style={styles.topSub}>{String(progressStatus || job.status).replaceAll('_', ' ').toLowerCase()}</Text>
        </View>
        <View style={[styles.statusPill, isInProgress && styles.statusPillLive, isCompleted && styles.statusPillDone]}>
          <Text style={[styles.statusPillText, isInProgress && styles.statusPillTextLive, isCompleted && styles.statusPillTextDone]}>
            {isCompleted ? 'DONE' : isInProgress ? 'IN PROGRESS' : isWaiting ? 'WAITING' : 'ACTIVE'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {isAccepted ? (
          <>
            <View style={styles.mapStage}>
              <View style={styles.mapLineOne} />
              <View style={styles.mapLineTwo} />
              <View style={styles.mapLineThree} />
              <View style={styles.mapPin}><MapPin size={18} color={v3.colors.paper} weight="fill" /></View>
            </View>

            <View style={styles.stageHeader}>
              <Text style={styles.stageEyebrow}>HEAD TO CUSTOMER</Text>
              <Text style={styles.stageTitle}>{job.title || 'Customer job'}</Text>
              <Text style={styles.stageMeta}>{scheduleLabel}</Text>
            </View>

            <View style={styles.customerCard}>
              <View style={styles.customerAvatar}><Text style={styles.customerInitial}>{customerInitial}</Text></View>
              <View style={styles.customerCopy}>
                <Text style={styles.customerName}>{customerName}</Text>
                <Text style={styles.customerMeta} numberOfLines={2}>
                  {job.locationName || job.addressStreet || 'Customer address becomes available for accepted work'}
                </Text>
              </View>
              {job.customer?.id ? (
                <TouchableOpacity
                  style={styles.messageCircle}
                  activeOpacity={0.72}
                  onPress={() => setMsgRecipient({ id: job.customer!.id!, name: customerName })}
                >
                  <ChatCircleDots size={17} color={v3.colors.ink} weight="bold" />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.pinNotice}>
              <ShieldCheck size={18} color={v3.colors.info} weight="fill" />
              <View style={styles.pinCopy}>
                <Text style={styles.pinTitle}>Arrival PIN required</Text>
                <Text style={styles.pinText}>Ask the customer for the arrival PIN when you reach the job.</Text>
              </View>
            </View>

            {!locationSharing ? (
              <TouchableOpacity style={styles.primaryAction} activeOpacity={0.78} onPress={startLocationSharing}>
                {actionLoading === 'IN_PROGRESS' ? (
                  <ActivityIndicator size="small" color={v3.colors.paper} />
                ) : (
                  <>
                    <NavigationArrow size={17} color={v3.colors.paper} weight="fill" />
                    <Text style={styles.primaryActionText}>Start navigation</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.sharingCard}>
                <Radio size={17} color={v3.colors.success} weight="fill" />
                <View style={styles.sharingCopy}>
                  <Text style={styles.sharingTitle}>Location sharing active</Text>
                  <Text style={styles.sharingText}>Keep MaintainEX open while travelling.</Text>
                </View>
                <TouchableOpacity onPress={stopLocationSharing}><Text style={styles.stopText}>Stop</Text></TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.secondaryAction}
              activeOpacity={0.78}
              onPress={() => router.push((`/(tasker)/jobs/v2/manage/${id}/verify-pin?purpose=ARRIVAL`) as any)}
            >
              <ShieldCheck size={16} color={v3.colors.ink} weight="bold" />
              <Text style={styles.secondaryActionText}>Verify arrival PIN</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {isInProgress ? (
          <>
            <View style={styles.liveCard}>
              <Text style={styles.liveEyebrow}>IN PROGRESS</Text>
              <Text style={styles.liveTitle}>{job.title || 'Job in progress'}</Text>
              <Text style={styles.liveMeta}>{scheduleLabel}</Text>
            </View>

            <Text style={styles.sectionTitle}>Tools</Text>
            <View style={styles.toolGrid}>
              <TouchableOpacity style={styles.toolCard} activeOpacity={0.72} onPress={() => router.push((`/(tasker)/jobs/v2/manage/${id}/evidence`) as any)}>
                <Camera size={19} color={v3.colors.ink} weight="bold" />
                <Text style={styles.toolTitle}>Add evidence</Text>
                <Text style={styles.toolMeta}>Before & after</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolCard} activeOpacity={0.72} onPress={() => router.push((`/(tasker)/jobs/v2/manage/${id}/change-order`) as any)}>
                <FileText size={19} color={v3.colors.ink} weight="bold" />
                <Text style={styles.toolTitle}>Change order</Text>
                <Text style={styles.toolMeta}>Extra scope</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.toolCard}
                activeOpacity={0.72}
                onPress={() => job.customer?.id && setMsgRecipient({ id: job.customer.id, name: customerName })}
              >
                <ChatCircleDots size={19} color={v3.colors.ink} weight="bold" />
                <Text style={styles.toolTitle}>Message customer</Text>
                <Text style={styles.toolMeta}>Job chat</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolCard} activeOpacity={0.72} onPress={handleDispute}>
                <Flag size={19} color={v3.colors.ink} weight="bold" />
                <Text style={styles.toolTitle}>Report issue</Text>
                <Text style={styles.toolMeta}>Raise dispute</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.inspectionRow} activeOpacity={0.72} onPress={() => router.push((`/(tasker)/jobs/v2/manage/${id}/inspection`) as any)}>
              <MagnifyingGlass size={17} color={v3.colors.ink} weight="bold" />
              <View style={styles.inspectionCopy}>
                <Text style={styles.inspectionTitle}>Inspection checklist</Text>
                <Text style={styles.inspectionText}>Confirm work quality before completion.</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            {ActionBtn({ label: 'Mark work complete', loadingKey: 'complete', onPress: handleMarkComplete })}
          </>
        ) : null}

        {isWaiting ? (
          <View style={styles.waitingCard}>
            <Hourglass size={23} color={v3.colors.amberDark} weight="fill" />
            <Text style={styles.waitingTitle}>Waiting for customer</Text>
            <Text style={styles.waitingText}>Your completion request is submitted. The customer needs to review and confirm the work.</Text>
          </View>
        ) : null}

        {!isAccepted && !isInProgress && !isWaiting && !isCompleted ? (
          <View style={styles.summaryCard}>
            <Wrench size={22} color={v3.colors.ink} weight="bold" />
            <Text style={styles.summaryTitle}>{job.title || 'Job details'}</Text>
            <Text style={styles.summaryText}>{job.description || 'Review the current job status and continue when the next action is available.'}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Job</Text>
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>{job.title || 'MaintainEX job'}</Text>
          <Text style={styles.detailText}>{job.description || 'No additional description.'}</Text>

          <View style={styles.detailDivider} />
          <View style={styles.detailLine}>
            <Calendar size={15} color={v3.colors.textMuted} />
            <Text style={styles.detailLineText}>{scheduleLabel}</Text>
          </View>
          <View style={styles.detailLine}>
            <MapPin size={15} color={v3.colors.textMuted} />
            <Text style={styles.detailLineText}>{job.locationName || job.addressStreet || 'Location on job record'}</Text>
          </View>
          <View style={styles.detailMoneyRow}>
            <Text style={styles.detailLabel}>Job value</Text>
            <Text style={styles.detailMoney}>LKR {Number(job.budgetAmount || 0).toLocaleString()}</Text>
          </View>
          {escrow ? (
            <View style={styles.escrowRow}>
              <ShieldCheck size={14} color={v3.colors.success} weight="fill" />
              <Text style={styles.escrowText}>Escrow {String(escrow.status || 'protected').toLowerCase()} · LKR {Number(escrow.amount || 0).toLocaleString()}</Text>
            </View>
          ) : null}
        </View>

        {isCompleted && reviews?.providerReviews?.length === 0 ? (
          <View style={styles.reviewCard}>
            <Text style={styles.reviewEyebrow}>RATE CUSTOMER</Text>
            <View style={styles.reviewIdentity}>
              <View style={styles.customerAvatar}><Text style={styles.customerInitial}>{customerInitial}</Text></View>
              <View>
                <Text style={styles.customerName}>{customerName}</Text>
                <Text style={styles.customerMeta}>Help keep the marketplace trustworthy.</Text>
              </View>
            </View>

            <Text style={styles.reviewLabel}>Cooperation · 1–5</Text>
            <TextInput style={styles.reviewInput} value={reviewCoop} onChangeText={setReviewCoop} keyboardType="number-pad" maxLength={1} />
            <Text style={styles.reviewLabel}>Communication · 1–5</Text>
            <TextInput style={styles.reviewInput} value={reviewComm} onChangeText={setReviewComm} keyboardType="number-pad" maxLength={1} />
            <Text style={styles.reviewLabel}>Overall experience · 1–5</Text>
            <TextInput style={styles.reviewInput} value={reviewExp} onChangeText={setReviewExp} keyboardType="number-pad" maxLength={1} />
            <Text style={styles.reviewLabel}>Private note</Text>
            <TextInput
              style={[styles.reviewInput, styles.reviewNote]}
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              textAlignVertical="top"
              placeholder="Anything MaintainEX should know?"
              placeholderTextColor={v3.colors.textPlaceholder}
            />
            {ActionBtn({ label: 'Submit customer rating', loadingKey: 'review', onPress: handleSubmitReview })}
          </View>
        ) : null}

        {isCompleted && reviews?.providerReviews?.length > 0 ? (
          <View style={styles.reviewedCard}>
            <CheckCircle size={17} color={v3.colors.success} weight="fill" />
            <Text style={styles.reviewedText}>Customer rating submitted</Text>
          </View>
        ) : null}

        {isCompleted && nextJob ? (
          <TouchableOpacity style={styles.nextCard} activeOpacity={0.72} onPress={() => router.push((`/(tasker)/jobs/v2/manage/${nextJob.id}`) as any)}>
            <ArrowCircleRight size={19} color={v3.colors.ink} weight="bold" />
            <View style={styles.nextCopy}>
              <Text style={styles.nextEyebrow}>NEXT JOB</Text>
              <Text style={styles.nextTitle} numberOfLines={1}>{nextJob.title}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ) : null}

        {canDispute && !isInProgress ? (
          <TouchableOpacity style={styles.reportLink} activeOpacity={0.72} onPress={handleDispute}>
            <Text style={styles.reportLinkText}>Report a problem with this job</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <NewChatModal
        visible={!!msgRecipient}
        onClose={() => setMsgRecipient(null)}
        recipient={msgRecipient}
        jobId={id}
        jobTitle={job?.title}
        prefilled={`Hi ${job?.customer?.name || 'there'}, I'd like to discuss "${job?.title || 'your job'}".`}
      />
    </SafeAreaView>
  )
}

const makeStyles = (_colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    minHeight: 70,
    paddingHorizontal: 18,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  circleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCopy: { flex: 1, marginLeft: 10 },
  topTitle: { fontSize: 15, fontFamily: fonts.headingBold, color: v3.colors.ink },
  topSub: { marginTop: 2, fontSize: 9, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted, textTransform: 'capitalize' },
  statusPill: { minHeight: 25, paddingHorizontal: 10, borderRadius: 13, backgroundColor: v3.colors.amberSoft, alignItems: 'center', justifyContent: 'center' },
  statusPillText: { fontSize: 8.5, fontFamily: fonts.headingBold, color: v3.colors.amberDark },
  statusPillLive: { backgroundColor: v3.colors.successSoft },
  statusPillTextLive: { color: v3.colors.success },
  statusPillDone: { backgroundColor: v3.colors.infoSoft },
  statusPillTextDone: { color: v3.colors.info },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 34 },
  mapStage: { height: 238, marginHorizontal: -18, backgroundColor: '#E7E7E7', overflow: 'hidden', position: 'relative' },
  mapLineOne: { position: 'absolute', left: -10, right: -10, top: 70, height: 1, backgroundColor: '#CBCBCB', transform: [{ rotate: '8deg' }] },
  mapLineTwo: { position: 'absolute', left: -10, right: -10, top: 145, height: 1, backgroundColor: '#D0D0D0', transform: [{ rotate: '-5deg' }] },
  mapLineThree: { position: 'absolute', top: -20, bottom: -20, left: '58%', width: 1, backgroundColor: '#CECECE', transform: [{ rotate: '10deg' }] },
  mapPin: { position: 'absolute', top: 98, left: '52%', width: 36, height: 36, borderRadius: 18, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  stageHeader: { paddingTop: 18 },
  stageEyebrow: { fontSize: 9, fontFamily: fonts.headingBold, color: v3.colors.amberDark },
  stageTitle: { marginTop: 5, fontSize: 24, lineHeight: 29, fontFamily: fonts.heading, color: v3.colors.ink },
  stageMeta: { marginTop: 4, fontSize: 10, fontFamily: fonts.bodySemiBold, color: v3.colors.textSecondary },
  customerCard: { minHeight: 72, marginTop: 16, paddingHorizontal: 12, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  customerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#D9D9D9', alignItems: 'center', justifyContent: 'center' },
  customerInitial: { fontSize: 11, fontFamily: fonts.headingBold, color: v3.colors.ink },
  customerCopy: { flex: 1, marginLeft: 10, paddingRight: 8 },
  customerName: { fontSize: 11.5, fontFamily: fonts.headingBold, color: v3.colors.ink },
  customerMeta: { marginTop: 3, fontSize: 8.8, lineHeight: 13, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted },
  messageCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center' },
  pinNotice: { minHeight: 72, marginTop: 12, padding: 13, borderRadius: 15, backgroundColor: v3.colors.infoSoft, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  pinCopy: { flex: 1 },
  pinTitle: { fontSize: 10.5, fontFamily: fonts.headingBold, color: v3.colors.info },
  pinText: { marginTop: 3, fontSize: 8.8, lineHeight: 14, fontFamily: fonts.bodySemiBold, color: '#4F4F4F' },
  primaryAction: { minHeight: 52, marginTop: 18, paddingHorizontal: 18, borderRadius: 15, backgroundColor: v3.colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryActionText: { fontSize: 13, fontFamily: fonts.headingBold, color: v3.colors.paper },
  secondaryAction: { minHeight: 50, marginTop: 10, paddingHorizontal: 18, borderRadius: 15, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryActionText: { fontSize: 11.5, fontFamily: fonts.headingBold, color: v3.colors.ink },
  disabled: { opacity: 0.55 },
  sharingCard: { minHeight: 60, marginTop: 18, paddingHorizontal: 13, borderRadius: 15, backgroundColor: v3.colors.successSoft, flexDirection: 'row', alignItems: 'center', gap: 9 },
  sharingCopy: { flex: 1 },
  sharingTitle: { fontSize: 10.5, fontFamily: fonts.headingBold, color: v3.colors.success },
  sharingText: { marginTop: 2, fontSize: 8.7, fontFamily: fonts.bodySemiBold, color: '#4F4F4F' },
  stopText: { fontSize: 9.5, fontFamily: fonts.headingBold, color: v3.colors.ink },
  liveCard: { minHeight: 118, borderRadius: 18, backgroundColor: v3.colors.ink, padding: 18, marginTop: 7 },
  liveEyebrow: { fontSize: 9, fontFamily: fonts.headingBold, color: v3.colors.success },
  liveTitle: { marginTop: 9, fontSize: 22, lineHeight: 27, fontFamily: fonts.heading, color: v3.colors.paper },
  liveMeta: { marginTop: 5, fontSize: 9.5, fontFamily: fonts.bodySemiBold, color: '#CFCFCF' },
  sectionTitle: { marginTop: 24, marginBottom: 9, fontSize: 13, fontFamily: fonts.headingBold, color: v3.colors.ink },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toolCard: { width: '48.7%', minHeight: 96, borderRadius: 16, padding: 14, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line },
  toolTitle: { marginTop: 12, fontSize: 10.5, fontFamily: fonts.headingBold, color: v3.colors.ink },
  toolMeta: { marginTop: 3, fontSize: 8.5, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted },
  inspectionRow: { minHeight: 64, marginTop: 10, borderRadius: 15, paddingHorizontal: 13, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  inspectionCopy: { flex: 1, marginLeft: 9 },
  inspectionTitle: { fontSize: 10.5, fontFamily: fonts.headingBold, color: v3.colors.ink },
  inspectionText: { marginTop: 2, fontSize: 8.6, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted },
  chevron: { fontSize: 20, fontFamily: fonts.body, color: v3.colors.textMuted },
  waitingCard: { minHeight: 150, marginTop: 18, padding: 20, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  waitingTitle: { marginTop: 10, fontSize: 16, fontFamily: fonts.headingBold, color: v3.colors.ink },
  waitingText: { marginTop: 6, textAlign: 'center', fontSize: 9.5, lineHeight: 15, fontFamily: fonts.bodySemiBold, color: v3.colors.textSecondary },
  summaryCard: { minHeight: 130, marginTop: 7, padding: 18, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line },
  summaryTitle: { marginTop: 14, fontSize: 17, fontFamily: fonts.headingBold, color: v3.colors.ink },
  summaryText: { marginTop: 5, fontSize: 9.5, lineHeight: 15, fontFamily: fonts.bodySemiBold, color: v3.colors.textSecondary },
  detailCard: { borderRadius: 18, padding: 15, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line },
  detailTitle: { fontSize: 14, fontFamily: fonts.headingBold, color: v3.colors.ink },
  detailText: { marginTop: 5, fontSize: 9.5, lineHeight: 15, fontFamily: fonts.bodySemiBold, color: v3.colors.textSecondary },
  detailDivider: { height: StyleSheet.hairlineWidth, marginVertical: 13, backgroundColor: v3.colors.line },
  detailLine: { minHeight: 27, flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailLineText: { flex: 1, fontSize: 9.5, fontFamily: fonts.bodySemiBold, color: '#4F4F4F' },
  detailMoneyRow: { marginTop: 8, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: v3.colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailLabel: { fontSize: 9, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted },
  detailMoney: { fontSize: 12, fontFamily: fonts.headingBold, color: v3.colors.ink },
  escrowRow: { marginTop: 10, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: v3.colors.line, flexDirection: 'row', alignItems: 'center', gap: 6 },
  escrowText: { flex: 1, fontSize: 8.8, fontFamily: fonts.bodySemiBold, color: v3.colors.success },
  reviewCard: { marginTop: 24, borderRadius: 18, padding: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line },
  reviewEyebrow: { fontSize: 9, fontFamily: fonts.headingBold, color: v3.colors.amberDark },
  reviewIdentity: { marginTop: 12, marginBottom: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewLabel: { marginTop: 10, marginBottom: 5, fontSize: 9, fontFamily: fonts.headingBold, color: v3.colors.textSecondary },
  reviewInput: { height: 48, borderRadius: 14, paddingHorizontal: 13, backgroundColor: v3.colors.surfaceGray, fontSize: 12, fontFamily: fonts.bodyMedium, color: v3.colors.ink },
  reviewNote: { height: 82, paddingTop: 12 },
  reviewedCard: { minHeight: 56, marginTop: 18, borderRadius: 15, paddingHorizontal: 14, backgroundColor: v3.colors.successSoft, flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewedText: { fontSize: 10.5, fontFamily: fonts.headingBold, color: v3.colors.success },
  nextCard: { minHeight: 62, marginTop: 14, borderRadius: 15, paddingHorizontal: 13, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  nextCopy: { flex: 1, marginLeft: 9 },
  nextEyebrow: { fontSize: 8, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  nextTitle: { marginTop: 2, fontSize: 10.5, fontFamily: fonts.headingBold, color: v3.colors.ink },
  reportLink: { minHeight: 48, marginTop: 12, alignItems: 'center', justifyContent: 'center' },
  reportLinkText: { fontSize: 9.5, fontFamily: fonts.bodySemiBold, color: v3.colors.error },
})
