import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, TextInput } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../../../lib/colors'
import { fonts } from '../../../../../lib/fonts'
import { v2Jobs, v2JobActions, V2Job } from '../../../../../lib/api-v2'

export default function V2ProviderManageJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<V2Job | null>(null)
  const [workspace, setWorkspace] = useState<any>(null)
  const [escrow, setEscrow] = useState<any>(null)
  const [reviews, setReviews] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')

  const [reviewQuality, setReviewQuality] = useState('5')
  const [reviewComm, setReviewComm] = useState('5')
  const [reviewExp, setReviewExp] = useState('5')
  const [reviewComment, setReviewComment] = useState('')

  const [generatedOtp, setGeneratedOtp] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)

  const loadJob = async () => {
    try {
      const res = await v2Jobs.get(id)
      setJob(res.job)
      setWorkspace(res.job.workspace || null)
      setEscrow(res.job.escrow || null)
      setReviews(res.job.reviews || null)
    } catch (e) {
      Alert.alert('Error', 'Failed to load job')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadJob() }, [id])

  const handleMarkComplete = async () => {
    setActionLoading('complete')
    try {
      await v2JobActions.complete(id, 'MARK_COMPLETE')
      Alert.alert('Done!', 'Marked complete. Waiting for customer approval.')
      loadJob()
    } catch (e: any) { Alert.alert('Error', e.message) }
    finally { setActionLoading('') }
  }

  const handleUpdateProgress = async (status: string) => {
    setActionLoading(status)
    try {
      await v2JobActions.updateProgress(id, status)
      loadJob()
    } catch (e: any) { Alert.alert('Error', e.message) }
    finally { setActionLoading('') }
  }

  const handleGenerateOtp = async () => {
    setOtpLoading(true)
    setGeneratedOtp('')
    try {
      const res = await v2JobActions.generateOtp(id)
      setGeneratedOtp(res.otp)
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to generate code')
    } finally {
      setOtpLoading(false)
    }
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
      Alert.alert('Review Submitted', 'Thanks for your feedback!')
      loadJob()
    } catch (e: any) { Alert.alert('Error', e.message) }
    finally { setActionLoading('') }
  }

  const [reviewCoop, setReviewCoop] = useState('5')

  const handleDispute = async () => {
    Alert.alert('Raise a Dispute', 'This will pause the job and notify admin to review.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Raise Dispute', style: 'destructive', onPress: async () => {
        setActionLoading('dispute')
        try {
          const res = await v2JobActions.dispute(id)
          Alert.alert('Dispute Raised', 'Admin will review the case')
          loadJob()
        } catch (e: any) { Alert.alert('Error', e.message) }
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
            <Text style={styles.statusText}>{job.status.replace(/_/g, ' ')}</Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.section}>
          <View style={styles.detailCard}>
            <Text style={styles.detailDesc}>{job.description}</Text>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Budget</Text>
                <Text style={styles.detailValue}>LKR {job.budgetAmount}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Type</Text>
                <Text style={styles.detailValue}>{job.budgetType}</Text>
              </View>
            </View>
            {job.locationName && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={colors.muted} style={{ marginRight: 4 }} />
                <Text style={styles.detailLocation}>{job.locationName}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Customer Address */}
        {job.addressStreet && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Address</Text>
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
            <Text style={styles.sectionTitle}>Escrow</Text>
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
            <Text style={styles.sectionTitle}>Progress</Text>
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
                        {step === 'COMPLETION_REQUESTED' ? 'REVIEW' : step === 'COMPLETED' ? 'DONE' : step.replace('_', ' ')}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </View>

            <View style={styles.progressActions}>
              {workspace.progressStatus === 'ACCEPTED' && !generatedOtp && (
                <TouchableOpacity
                  style={[styles.otpGenBtn, otpLoading && styles.btnDisabled]}
                  onPress={handleGenerateOtp}
                  disabled={otpLoading}
                >
                  {otpLoading ? (
                    <ActivityIndicator color={colors.ink} />
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark-outline" size={20} color={colors.ink} />
                      <Text style={styles.otpGenText}>Generate Confirmation Code</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              {workspace.progressStatus === 'ACCEPTED' && generatedOtp && (
                <View style={styles.otpDisplay}>
                  <Ionicons name="lock-closed-outline" size={24} color={colors.amberDark} />
                  <Text style={styles.otpDisplayLabel}>Show this code to the customer</Text>
                  <Text style={styles.otpCode}>{generatedOtp}</Text>
                  <Text style={styles.otpDisplayHint}>Customer will enter this code to confirm you arrived</Text>
                </View>
              )}
              {workspace.progressStatus === 'COMPLETION_REQUESTED' && (
                <View style={styles.waitingCard}>
                  <Ionicons name="hourglass-outline" size={20} color={colors.amberDark} />
                  <Text style={styles.waitingText}>Waiting for customer approval</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Mark Complete */}
        {workspace?.progressStatus === 'IN_PROGRESS' && (
          <View style={[styles.section, styles.highlightSection]}>
            <Ionicons name="flag-outline" size={32} color={colors.amberDark} style={{ marginBottom: 8 }} />
            <Text style={styles.highlightTitle}>Finish Job</Text>
            <Text style={styles.highlightDesc}>Mark as complete and request customer approval for payment release</Text>
            {ActionBtn({ label: 'Mark Complete', loadingKey: 'complete', onPress: handleMarkComplete })}
          </View>
        )}

        {/* Review Customer */}
        {job.status === 'COMPLETED' && reviews?.providerReviews?.length === 0 && (
          <View style={[styles.section, styles.reviewSection]}>
            <Text style={styles.reviewTitle}>Review Customer</Text>
            <Text style={styles.reviewLabel}>Cooperation (1-5)</Text>
            <TextInput style={styles.input} value={reviewCoop} onChangeText={setReviewCoop} keyboardType="numeric" placeholderTextColor={colors.muted} />
            <Text style={styles.reviewLabel}>Communication (1-5)</Text>
            <TextInput style={styles.input} value={reviewComm} onChangeText={setReviewComm} keyboardType="numeric" placeholderTextColor={colors.muted} />
            <Text style={styles.reviewLabel}>Overall Experience (1-5)</Text>
            <TextInput style={styles.input} value={reviewExp} onChangeText={setReviewExp} keyboardType="numeric" placeholderTextColor={colors.muted} />
            <Text style={styles.reviewLabel}>Comment (optional)</Text>
            <TextInput style={[styles.input, styles.textArea]} value={reviewComment} onChangeText={setReviewComment} multiline placeholderTextColor={colors.muted} />
            {ActionBtn({ label: 'Submit Review', loadingKey: 'review', onPress: handleSubmitReview })}
          </View>
        )}

        {job.status === 'COMPLETED' && reviews?.providerReviews?.length > 0 && (
          <View style={styles.section}>
            <View style={styles.reviewedCard}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.reviewedText}>You reviewed this customer</Text>
            </View>
          </View>
        )}

        {/* Dispute */}
        {job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
          <TouchableOpacity style={styles.disputeBtn} onPress={handleDispute}>
            <Text style={styles.disputeBtnText}>Having a problem? Raise a dispute</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

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

const styles = StyleSheet.create({
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
  progressBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.amber, paddingVertical: 14, borderRadius: 12,
  },
  progressBtnText: { fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.ink },
  otpGenBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.amber, paddingVertical: 14, borderRadius: 12,
  },
  otpGenText: { fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.ink },
  otpDisplay: { alignItems: 'center', padding: 20, backgroundColor: colors.amberBg, borderRadius: 16, borderWidth: 2, borderColor: colors.amber, marginBottom: 8 },
  otpDisplayLabel: { fontSize: 13, fontFamily: fonts.body, color: colors.muted, marginBottom: 12 },
  otpCode: { fontSize: 40, fontFamily: fonts.headingBold, color: colors.ink, letterSpacing: 12, marginBottom: 8 },
  otpDisplayHint: { fontSize: 12, fontFamily: fonts.body, color: colors.muted, textAlign: 'center' },

  highlightSection: { backgroundColor: colors.amberBg, borderRadius: 16, marginHorizontal: 0, marginBottom: 4, padding: 20, borderWidth: 1, borderColor: colors.amberLight, alignItems: 'center' },
  highlightTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  highlightDesc: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20, marginBottom: 16 },

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

  waitingCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.amberBg, borderRadius: 12, padding: 16 },
  waitingText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.amberDark },
})
