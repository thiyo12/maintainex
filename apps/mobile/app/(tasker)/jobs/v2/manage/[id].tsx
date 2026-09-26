import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, TextInput } from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { translateJobStatus } from '../../../../../lib/i18n'
import { useColors } from '../../../../../lib/ThemeContext'
import { fonts } from '../../../../../lib/fonts'
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
  const [pinState, setPinState] = useState<any>(null)

  const loadJob = async () => {
    try {
      const [jobRes, pinRes] = await Promise.all([
        v2Jobs.get(id),
        v2JobActions.getPinState(id).catch(() => ({ pinState: null })),
      ])
      setJob(jobRes.job)
      setWorkspace(jobRes.job.workspace || null)
      setEscrow(jobRes.job.escrow || null)
      setReviews(jobRes.job.reviews || null)
      setPinState(pinRes.pinState)
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

  useFocusEffect(
    useCallback(() => {
      loadJob()
    }, [id])
  )

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
      const loc = await Location.getCurrentPositionAsync({})
      const token = await (await import('../../../../../lib/api')).getAuthToken()
      await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'}/api/mobile/taskers/location`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }),
      })
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
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  if (!job) return null

  const ActionBtn = ({ label, loadingKey, onPress, color, outline }: { label: string; loadingKey: string; onPress: () => void; color?: string; outline?: boolean }) => (
    <TouchableOpacity
      style={[
        styles.actionBtn,
        outline ? { backgroundColor: 'transparent', borderWidth: 2, borderColor: color || colors.amber } : { backgroundColor: color || colors.amber },
        actionLoading !== '' && styles.btnDisabled,
      ]}
      onPress={onPress}
      disabled={actionLoading !== ''}
    >
      {actionLoading === loadingKey ? (
        <ActivityIndicator color={outline ? (color || colors.amber) : colors.ink} />
      ) : (
        <Text style={[styles.actionBtnText, outline ? { color: color || colors.amber } : { color: colors.ink }]}>{label}</Text>
      )}
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.title}>{job.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[job.status] || colors.muted }]}>
            <Text style={styles.statusText}>{t(translateJobStatus(job.status))}</Text>
          </View>
        </View>

        {/* Scheduled Date */}
        {job.preferredDate && (
          <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
            <View style={[styles.scheduleCard, { backgroundColor: colors.amberBg, borderColor: colors.amberLight }]}>
              <Ionicons name="calendar-outline" size={16} color={colors.amberDark} />
              <Text style={[styles.scheduleText, { color: colors.amberDark }]}>
                {job.timeSlot
                  ? t('booking.scheduledFor', { date: job.preferredDate, timeSlot: job.timeSlot })
                  : `${job.preferredDate}`}
              </Text>
            </View>
          </View>
        )}

        {/* Details */}
        <View style={styles.section}>
          <View style={styles.detailCard}>
            <Text style={styles.detailDesc}>{job.description}</Text>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{t('jobDetail.budget')}</Text>
                <Text style={styles.detailValue}>LKR {job.budgetAmount?.toLocaleString() ?? 'Not set'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{t('jobs.details')}</Text>
                <Text style={styles.detailValue}>{job.budgetType}</Text>
              </View>
            </View>
            {job.locationName && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={colors.muted} style={{ marginRight: 4 }} />
                <Text style={styles.detailLocation}>{job.locationName}</Text>
              </View>
            )}
            {job.customer?.id && (
              <TouchableOpacity
                style={[styles.msgBtn, { backgroundColor: colors.amber }]}
                onPress={() => setMsgRecipient({ id: job.customer!.id!, name: job.customer?.name || 'Customer' })}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.ink} />
                <Text style={styles.msgBtnText}>Message customer</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Customer Address */}
        {job.addressStreet && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('jobDetail.shareAddress')}</Text>
            <View style={styles.addressCard}>
              <Text style={styles.addressText}>
                {job.addressStreet}{job.addressBuilding ? `, ${job.addressBuilding}` : ''}
                {job.addressApartment ? `, ${job.addressApartment}` : ''}
              </Text>
              {job.addressLandmark ? (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color={colors.muted} style={{ marginRight: 4 }} />
                  <Text style={styles.addressLandmark}>{job.addressLandmark}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Escrow */}
        {escrow && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('jobDetail.escrow')}</Text>
            <View style={styles.escrowCard}>
              <Text style={styles.escrowAmount}>LKR {escrow.amount}</Text>
              <View style={[styles.escrowBadge, escrow.status === 'PROTECTED' ? styles.escrowActive : styles.escrowInactive]}>
                <Text style={styles.escrowBadgeText}>{escrow.status}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Progress + Workspace */}
        {workspace && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('tracking.inProgress')}</Text>
            <View style={styles.progressCard}>
              <View style={styles.progressSteps}>
                {['ACCEPTED', 'IN_PROGRESS', 'COMPLETION_REQUESTED', 'COMPLETED'].map((step, i) => {
                  const stepOrder = ['ACCEPTED', 'IN_PROGRESS', 'COMPLETION_REQUESTED', 'COMPLETED']
                  const currentIdx = stepOrder.indexOf(workspace.progressStatus)
                  const isDone = i <= currentIdx
                  return (
                    <View key={step} style={styles.progressStep}>
                      <View style={[styles.progressDot, isDone && styles.progressDotDone]}>
                        {isDone ? <Ionicons name="checkmark" size={16} color={colors.ink} /> : <Text style={styles.progressNum}>{i + 1}</Text>}
                      </View>
                      <Text style={[styles.progressLabel, isDone && styles.progressLabelDone]}>
                        {step === 'COMPLETION_REQUESTED' ? t('tasker.reviews') : step === 'COMPLETED' ? t('common.done') : step.replace('_', ' ')}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </View>

            <View style={styles.progressActions}>
              {workspace.progressStatus === 'ACCEPTED' && !locationSharing && (
                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={startLocationSharing}
                >
                  <Ionicons name="navigate-outline" size={20} color={colors.ink} />
                  <Text style={styles.navBtnText}>{t('tracking.startNavigation')}</Text>
                </TouchableOpacity>
              )}
              {locationSharing && (
                <View style={styles.sharingActive}>
                  <Ionicons name="radio-outline" size={18} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sharingActiveText}>{t('tracking.sharingLocation')}</Text>
                    <Text style={styles.sharingHint}>{t('tracking.keepOpenShare')}</Text>
                  </View>
                  <TouchableOpacity onPress={stopLocationSharing} style={styles.stopSharingBtn}>
                    <Text style={styles.stopSharingText}>{t('tracking.stopSharing')}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {job.companyAssignment?.status === 'ASSIGNED' && (
                <View style={styles.waitingCard}>
                  <Ionicons name="business-outline" size={20} color={colors.amberDark} />
                  <Text style={styles.waitingText}>This is a company assignment. Accept it before verifying arrival.</Text>
                  <TouchableOpacity
                    style={styles.verifyPinBtn}
                    onPress={() => router.push(`/(company)/workforce/assignment/${job.companyAssignment.id}` as any)}
                  >
                    <Text style={styles.verifyPinText}>Review & Accept Assignment</Text>
                  </TouchableOpacity>
                </View>
              )}
              {workspace.progressStatus === 'ACCEPTED' && escrow?.status === 'PROTECTED' && job.companyAssignment?.status !== 'ASSIGNED' && !pinState?.arrivalVerifiedAt && (
                <TouchableOpacity
                  style={[styles.verifyPinBtn]}
                  onPress={() => router.push(`/(tasker)/jobs/v2/manage/${id}/verify-pin?purpose=ARRIVAL`)}
                >
                  <Ionicons name="location-outline" size={20} color={colors.ink} />
                  <Text style={styles.verifyPinText}>Verify Arrival PIN</Text>
                </TouchableOpacity>
              )}
              {workspace.progressStatus === 'ACCEPTED' && escrow?.status === 'PROTECTED' && job.companyAssignment?.status !== 'ASSIGNED' && pinState?.arrivalVerifiedAt && !pinState?.workStartVerifiedAt && (
                <TouchableOpacity
                  style={[styles.verifyPinBtn]}
                  onPress={() => router.push(`/(tasker)/jobs/v2/manage/${id}/verify-pin?purpose=WORK_START`)}
                >
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.ink} />
                  <Text style={styles.verifyPinText}>Start Work with PIN</Text>
                </TouchableOpacity>
              )}
              {workspace.progressStatus === 'ACCEPTED' && escrow?.status === 'PROTECTED' && !pinState?.hasActivePin && !pinState?.arrivalVerifiedAt && (
                <View style={styles.waitingCard}>
                  <Ionicons name="time-outline" size={20} color={colors.amberDark} />
                  <Text style={styles.waitingText}>Waiting for the customer to generate the one-time arrival PIN.</Text>
                </View>
              )}
              {workspace.progressStatus === 'ACCEPTED' && escrow?.status === 'PROTECTED' && !pinState?.hasActivePin && pinState?.arrivalVerifiedAt && !pinState?.workStartVerifiedAt && (
                <View style={styles.waitingCard}>
                  <Ionicons name="time-outline" size={20} color={colors.amberDark} />
                  <Text style={styles.waitingText}>Arrival is confirmed. Waiting for the customer to generate a fresh Start Work PIN.</Text>
                </View>
              )}
              {workspace.progressStatus === 'ACCEPTED' && escrow?.status !== 'PROTECTED' && (
                <View style={styles.waitingCard}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.amberDark} />
                  <Text style={styles.waitingText}>Waiting for the customer payment to be secured.</Text>
                </View>
              )}
              {workspace.progressStatus === 'COMPLETION_REQUESTED' && (
                <View style={styles.waitingCard}>
                  <Ionicons name="hourglass-outline" size={20} color={colors.amberDark} />
                  <Text style={styles.waitingText}>{t('jobDetail.waitingForQuotes')}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Mark Complete */}
        {workspace?.progressStatus === 'IN_PROGRESS' && (
          <View style={[styles.section, styles.highlightSection]}>
            <Ionicons name="flag-outline" size={32} color={colors.amberDark} style={{ marginBottom: 8 }} />
            <Text style={styles.highlightTitle}>{t('common.finish')}</Text>
            <Text style={styles.highlightDesc}>{t('jobDetail.confirmStart')}</Text>
            {ActionBtn({ label: t('common.done'), loadingKey: 'complete', onPress: handleMarkComplete })}
          </View>
        )}

        {/* Review Customer */}
        {job.status === 'COMPLETED' && reviews?.providerReviews?.length === 0 && (
          <View style={[styles.section, styles.reviewSection]}>
            <Text style={styles.reviewTitle}>{t('tasker.reviews')}</Text>
            <Text style={styles.reviewLabel}>{t('receipt.rateQuality')} (1-5)</Text>
            <TextInput style={styles.input} value={reviewCoop} onChangeText={setReviewCoop} keyboardType="numeric" placeholderTextColor={colors.muted} />
            <Text style={styles.reviewLabel}>{t('receipt.rateCommunication')} (1-5)</Text>
            <TextInput style={styles.input} value={reviewComm} onChangeText={setReviewComm} keyboardType="numeric" placeholderTextColor={colors.muted} />
            <Text style={styles.reviewLabel}>{t('receipt.rateValue')} (1-5)</Text>
            <TextInput style={styles.input} value={reviewExp} onChangeText={setReviewExp} keyboardType="numeric" placeholderTextColor={colors.muted} />
            <Text style={styles.reviewLabel}>{t('receipt.writeReview')}</Text>
            <TextInput style={[styles.input, styles.textArea]} value={reviewComment} onChangeText={setReviewComment} multiline placeholderTextColor={colors.muted} />
            {ActionBtn({ label: t('receipt.submitReview'), loadingKey: 'review', onPress: handleSubmitReview })}
          </View>
        )}

        {job.status === 'COMPLETED' && reviews?.providerReviews?.length > 0 && (
          <View style={styles.section}>
            <View style={styles.reviewedCard}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.reviewedText}>{t('receipt.reviewSubmitted')}</Text>
            </View>
          </View>
        )}

        {/* Start Next Job */}
        {job.status === 'COMPLETED' && nextJob && (
          <View style={[styles.section, styles.highlightSection]}>
            <Ionicons name="arrow-forward-circle-outline" size={32} color={colors.amberDark} style={{ marginBottom: 8 }} />
            <Text style={styles.highlightTitle}>{t('tasker.startNextJob')}</Text>
            <Text style={styles.highlightDesc}>{nextJob.title}</Text>
            {nextJob.preferredDate && (
              <Text style={[styles.scheduleText, { color: colors.amberDark, marginBottom: 12 }]}>
                {nextJob.timeSlot
                  ? t('booking.scheduledFor', { date: nextJob.preferredDate, timeSlot: nextJob.timeSlot })
                  : nextJob.preferredDate}
              </Text>
            )}
            <TouchableOpacity
              style={styles.startNextBtn}
              onPress={() => router.push(`/(tasker)/jobs/v2/manage/${nextJob.id}`)}
            >
              <Text style={styles.startNextBtnText}>{t('tasker.startNextJob')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Dispute */}
        {job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
          <TouchableOpacity style={styles.disputeBtn} onPress={handleDispute}>
            <Text style={styles.disputeBtnText}>{t('jobDetail.raiseDispute')}</Text>
          </TouchableOpacity>
        )}

        {/* Action shortcuts for active jobs */}
        {workspace?.progressStatus === 'IN_PROGRESS' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('jobDetail.whatsIncluded')}</Text>
            <View style={styles.shortcutsRow}>
              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={() => router.push(`/(tasker)/jobs/v2/manage/${id}/inspection` as any)}
              >
                <Ionicons name="search-outline" size={20} color={colors.amberDark} />
                <Text style={styles.shortcutText}>{t('inspection.title')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={() => router.push(`/(tasker)/jobs/v2/manage/${id}/evidence` as any)}
              >
                <Ionicons name="camera-outline" size={20} color={colors.amberDark} />
                <Text style={styles.shortcutText}>{t('evidence.title')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={() => router.push(`/(tasker)/jobs/v2/manage/${id}/change-order` as any)}
              >
                <Ionicons name="document-text-outline" size={20} color={colors.amberDark} />
                <Text style={styles.shortcutText}>{t('changeOrder.title')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  scroll: { flex: 1 },
  hero: { padding: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink, marginBottom: 10, lineHeight: 32 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  section: { padding: 20, paddingBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 12 },

  detailCard: { backgroundColor: colors.white, borderRadius: 14, padding: 16, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  detailDesc: { fontSize: 14, color: colors.ink, opacity: 0.8, lineHeight: 22, marginBottom: 14 },
  detailRow: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  detailItem: { flex: 1 },
  detailLabel: { fontSize: 11, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 16, fontWeight: '700', color: colors.ink, marginTop: 2 },
  detailLocation: { fontSize: 13, color: colors.muted },
  msgBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, marginTop: 12 },
  msgBtnText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },

  addressCard: { backgroundColor: colors.white, borderRadius: 14, padding: 16, shadowColor: colors.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  addressText: { fontSize: 14, color: colors.ink, lineHeight: 22 },
  addressLandmark: { fontSize: 13, color: colors.muted },

  escrowCard: { backgroundColor: colors.white, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: colors.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  escrowAmount: { fontSize: 20, fontWeight: '800', color: colors.ink },
  escrowBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  escrowActive: { backgroundColor: colors.amberBg },
  escrowInactive: { backgroundColor: colors.border },
  escrowBadgeText: { fontSize: 11, fontWeight: '700', color: colors.amberDark },

  progressCard: { backgroundColor: colors.white, borderRadius: 14, padding: 20, marginBottom: 12, shadowColor: colors.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  progressSteps: { flexDirection: 'row', justifyContent: 'space-between' },
  progressStep: { alignItems: 'center', flex: 1 },
  progressDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  progressDotDone: { backgroundColor: colors.amber },
  progressNum: { fontSize: 13, fontWeight: '700', color: colors.muted },
  progressLabel: { fontSize: 10, color: colors.muted, fontWeight: '600', textAlign: 'center' },
  progressLabelDone: { color: colors.amberDark },
  progressActions: { gap: 8 },
  navBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.amber, paddingVertical: 14, borderRadius: 12,
  },
  navBtnText: { fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.ink },
  progressBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.amber, paddingVertical: 14, borderRadius: 12,
  },
  progressBtnText: { fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.ink },
  verifyPinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.amber, paddingVertical: 14, borderRadius: 12,
  },
  verifyPinText: { fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.ink },

  scheduleCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, borderWidth: 1 },
  scheduleText: { fontSize: 13, fontFamily: fonts.bodyMedium, flex: 1 },

  highlightSection: { backgroundColor: colors.amberBg, borderRadius: 16, marginHorizontal: 0, marginBottom: 4, padding: 20, borderWidth: 1, borderColor: colors.amberLight, alignItems: 'center' },
  highlightTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  highlightDesc: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  startNextBtn: { backgroundColor: colors.amber, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  startNextBtnText: { fontSize: 15, fontWeight: '700', color: colors.ink },

  actionBtn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minWidth: 120, marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: 15, fontWeight: '700' },

  reviewSection: { backgroundColor: colors.amberBg, borderRadius: 16, marginHorizontal: 0, marginBottom: 4, padding: 20, borderWidth: 1, borderColor: colors.amberLight },
  reviewTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 12, textAlign: 'center' },
  reviewLabel: { fontSize: 13, fontWeight: '600', color: colors.ink, marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 12, fontSize: 14, color: colors.ink, backgroundColor: colors.white },
  textArea: { height: 80, textAlignVertical: 'top' },

  reviewedCard: { backgroundColor: '#D1FAE5', borderRadius: 14, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  reviewedText: { fontSize: 14, color: colors.success, fontWeight: '600' },

  disputeBtn: { alignItems: 'center', paddingVertical: 16, marginBottom: 12 },
  disputeBtnText: { fontSize: 13, color: colors.muted, fontWeight: '600', textDecorationLine: 'underline' },

  shortcutsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  shortcutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.white, paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
  },
  shortcutText: { fontSize: 13, fontWeight: '600', color: colors.ink },

  waitingCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.amberBg, borderRadius: 12, padding: 16 },
  waitingText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.amberDark },
  sharingActive: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#D1FAE5', borderRadius: 12, padding: 12 },
  sharingActiveText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.success },
  sharingHint: { fontSize: 11, fontFamily: fonts.body, color: '#065F46', marginTop: 2 },
  stopSharingBtn: { backgroundColor: '#065F46', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  stopSharingText: { fontSize: 11, fontFamily: fonts.bodyMedium, color: '#FFFFFF' },
})
