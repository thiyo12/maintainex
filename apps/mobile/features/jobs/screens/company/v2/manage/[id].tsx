import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  Briefcase,
  CaretLeft,
  ChatCircleDots,
  CheckCircle,
  Clock,
  MapPin,
  Play,
  ShieldCheck,
  UsersThree,
  WarningCircle,
} from 'phosphor-react-native'
import { getActiveCompanyId } from '@/api/companies'
import { v2JobActions, v2Jobs } from '@/api/v2-jobs'
import { v3 } from '@/theme/v3/tokens'
import NewChatModal from '@/features/messaging/components/NewChatModal'

export default function CompanyManageJobScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [job, setJob] = useState<any>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [pinState, setPinState] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [chatVisible, setChatVisible] = useState(false)
  const [reviewCoop, setReviewCoop] = useState('5')
  const [reviewComm, setReviewComm] = useState('5')
  const [reviewExp, setReviewExp] = useState('5')
  const [reviewComment, setReviewComment] = useState('')

  const load = async () => {
    try {
      const [jobRes, activeCompanyId, pinRes] = await Promise.all([
        v2Jobs.get(id, 'company'),
        getActiveCompanyId(),
        v2JobActions.getPinState(id).catch(() => ({ pinState: null })),
      ])
      setJob(jobRes.job)
      setCompanyId(activeCompanyId)
      setPinState(pinRes.pinState)
    } catch (error: any) {
      Alert.alert('Unable to load job', error?.message || 'Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const myQuote = useMemo(
    () => job?.quotes?.find((quote: any) => quote.providerType === 'COMPANY' && quote.providerId === companyId) || null,
    [job?.quotes, companyId],
  )

  const progress = job?.workspace?.progressStatus || (
    job?.status === 'IN_PROGRESS'
      ? 'IN_PROGRESS'
      : job?.status === 'COMPLETED'
        ? 'COMPLETED'
        : job?.status === 'QUOTE_ACCEPTED'
          ? 'ACCEPTED'
          : job?.status
  )

  const accepted = myQuote?.status === 'ACCEPTED'
  const protectedPayment = ['PROTECTED', 'CASH_CONFIRMED'].includes(job?.escrow?.status)
  const isReadyToTravel = accepted && protectedPayment && progress === 'ACCEPTED'
  const isInProgress = progress === 'IN_PROGRESS'
  const isWaitingCustomer = progress === 'COMPLETION_REQUESTED'
  const isCompleted = progress === 'COMPLETED' || job?.status === 'COMPLETED'
  const canOtpCancel = accepted && progress === 'ACCEPTED' && ['QUOTE_ACCEPTED', 'IN_PROGRESS'].includes(job?.status)
  const customerName = job?.customer?.name || 'Customer'
  const customerInitial = customerName.charAt(0).toUpperCase() || 'C'

  const handleSubmitReview = async () => {
    const ratings = [reviewCoop, reviewComm, reviewExp].map((value) => Number.parseInt(value, 10))
    if (ratings.some((value) => !Number.isInteger(value) || value < 1 || value > 5)) {
      Alert.alert('Invalid rating', 'Ratings must be whole numbers from 1 to 5.')
      return
    }
    setActionLoading('review')
    try {
      await v2JobActions.createReview(id, {
        reviewType: 'PROVIDER_REVIEWS_CUSTOMER',
        cooperation: ratings[0],
        communication: ratings[1],
        overallExperience: ratings[2],
        comment: reviewComment.trim() || undefined,
      })
      Alert.alert('Review submitted', 'Thanks for sharing your feedback.')
      await load()
    } catch (error: any) {
      Alert.alert('Could not submit review', error?.message || 'Please try again.')
    } finally {
      setActionLoading('')
    }
  }

  const markComplete = async () => {
    setActionLoading('complete')
    try {
      await v2JobActions.complete(id, 'MARK_COMPLETE')
      await load()
      Alert.alert('Work submitted', 'The customer can now review and release payment.')
    } catch (error: any) {
      Alert.alert('Unable to complete', error?.message || 'Please try again.')
    } finally {
      setActionLoading('')
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loading}><ActivityIndicator color={v3.colors.ink} /></View>
      </SafeAreaView>
    )
  }

  if (!job) return null

  const quotePrice = myQuote?.price ? Number(myQuote.price) : 0

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.circle} onPress={() => router.back()}>
          <CaretLeft size={18} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>COMPANY JOB</Text>
          <Text style={styles.headerTitle}>Manage work</Text>
        </View>
        <TouchableOpacity style={styles.circle} onPress={() => router.push('/(company)/(tabs)/dispatch' as any)}>
          <UsersThree size={18} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{String(progress || job.status).replaceAll('_', ' ')}</Text>
            </View>
            <Text style={styles.heroMoney}>{quotePrice ? `LKR ${quotePrice.toLocaleString()}` : 'Company quote'}</Text>
          </View>
          <Text style={styles.heroTitle}>{job.title || 'MaintainEX job'}</Text>
          <Text style={styles.heroText} numberOfLines={3}>{job.description || 'Review the job details and continue when the next step is available.'}</Text>
        </View>

        <View style={styles.customerCard}>
          <View style={styles.customerAvatar}><Text style={styles.customerInitial}>{customerInitial}</Text></View>
          <View style={styles.customerCopy}>
            <Text style={styles.customerName}>{customerName}</Text>
            <Text style={styles.customerMeta}>{job.addressStreet || job.locationName || 'Customer location is protected until payment.'}</Text>
          </View>
          {job.customer?.id ? (
            <TouchableOpacity style={styles.messageBtn} onPress={() => setChatVisible(true)}>
              <ChatCircleDots size={17} color={v3.colors.ink} weight="bold" />
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Current step</Text>

        {!myQuote ? (
          <StepCard
            icon={<Briefcase size={21} color={v3.colors.ink} weight="bold" />}
            title="No company quote on this job"
            text="Return to opportunities and send a company quote first."
          >
            <Action label="Browse opportunities" onPress={() => router.push('/(company)/jobs/v2/browse' as any)} />
          </StepCard>
        ) : myQuote.status === 'PENDING' ? (
          <StepCard
            icon={<Clock size={21} color={v3.colors.amberDark} weight="fill" />}
            title="Quote sent"
            text="The customer is comparing offers. You will be notified if your company is selected."
          />
        ) : myQuote.status === 'REJECTED' ? (
          <StepCard
            icon={<Briefcase size={21} color={v3.colors.textMuted} weight="bold" />}
            title="Another quote was selected"
            text="This job is no longer assigned to your company."
          />
        ) : accepted && !protectedPayment ? (
          <StepCard
            icon={<ShieldCheck size={21} color={v3.colors.info} weight="fill" />}
            title="Selected · waiting for protected payment"
            text="Do not travel to the job until the customer funds escrow. The address and work-start controls unlock after payment."
          />
        ) : isReadyToTravel && pinState?.hasActivePin && !pinState?.arrivalVerifiedAt ? (
          <StepCard
            icon={<MapPin size={21} color={v3.colors.info} weight="fill" />}
            title="Travel to the customer"
            text="When your team arrives, verify the customer's arrival PIN. Work cannot begin before arrival is verified."
          >
            <Action
              label="Verify arrival PIN"
              outline
              onPress={() => router.push((`/(company)/jobs/v2/manage/${id}/verify-pin?purpose=ARRIVAL`) as any)}
            />
          </StepCard>
        ) : isReadyToTravel && pinState?.hasActivePin && pinState?.arrivalVerifiedAt && !pinState?.workStartVerifiedAt ? (
          <StepCard
            icon={<ShieldCheck size={21} color={v3.colors.info} weight="fill" />}
            title="Arrival verified"
            text="Ask the customer for the one-time Start Work PIN before beginning the job."
          >
            <Action
              label="Start work with PIN"
              onPress={() => router.push(`/(company)/jobs/v2/manage/${id}/verify-pin?purpose=WORK_START` as any)}
            />
          </StepCard>
        ) : isReadyToTravel && !pinState?.hasActivePin && !pinState?.arrivalVerifiedAt ? (
          <StepCard
            icon={<Clock size={21} color={v3.colors.amberDark} weight="fill" />}
            title="Waiting for the customer"
            text="Waiting for the customer to generate the one-time arrival PIN."
          />
        ) : isReadyToTravel && !pinState?.hasActivePin && pinState?.arrivalVerifiedAt && !pinState?.workStartVerifiedAt ? (
          <StepCard
            icon={<Clock size={21} color={v3.colors.amberDark} weight="fill" />}
            title="Waiting for the customer"
            text="Arrival is confirmed. Waiting for the customer to generate a fresh Start Work PIN."
          />
        ) : isInProgress ? (
          <StepCard
            icon={<Play size={21} color={v3.colors.success} weight="fill" />}
            title="Work in progress"
            text="The arrival and work-start checks are complete. Keep job evidence and scope updates inside MaintainEX."
          >
            <Action
              label={actionLoading === 'complete' ? 'Submitting…' : 'Mark work complete'}
              disabled={!!actionLoading}
              onPress={markComplete}
            />
          </StepCard>
        ) : isReadyToTravel ? (
          <StepCard
            icon={<MapPin size={21} color={v3.colors.info} weight="fill" />}
            title="Travel to the customer"
            text="When your team arrives, verify the customer's arrival PIN. Work cannot begin before arrival is verified."
          >
            <Action
              label="Verify arrival PIN"
              outline
              onPress={() => router.push(`/(company)/jobs/v2/manage/${id}/verify-pin?purpose=ARRIVAL` as any)}
            />
            <Action
              label="Start work with PIN"
              onPress={() => router.push(`/(company)/jobs/v2/manage/${id}/verify-pin?purpose=WORK_START` as any)}
            />
          </StepCard>
        ) : isWaitingCustomer ? (
          <StepCard
            icon={<Clock size={21} color={v3.colors.amberDark} weight="fill" />}
            title="Waiting for customer approval"
            text="Completion was submitted. The customer must confirm the work before protected funds are released."
          />
        ) : isCompleted ? (
          <StepCard
            icon={<CheckCircle size={21} color={v3.colors.success} weight="fill" />}
            title="Job completed"
            text="The job is closed and payment settlement has been processed through the protected payment flow."
          />
        ) : (
          <StepCard
            icon={<Briefcase size={21} color={v3.colors.ink} weight="bold" />}
            title="Job status updated"
            text="Refresh the job if the next action is not visible yet."
          />
        )}

        {job?.status === 'COMPLETED' && (job?.reviews?.providerReviews || []).length === 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Review Customer</Text>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Cooperation (1–5)</Text>
              <TextInput
                style={styles.reviewInput}
                value={reviewCoop}
                onChangeText={setReviewCoop}
                keyboardType="number-pad"
                maxLength={1}
              />
              <Text style={styles.reviewLabel}>Communication (1–5)</Text>
              <TextInput
                style={styles.reviewInput}
                value={reviewComm}
                onChangeText={setReviewComm}
                keyboardType="number-pad"
                maxLength={1}
              />
              <Text style={styles.reviewLabel}>Overall experience (1–5)</Text>
              <TextInput
                style={styles.reviewInput}
                value={reviewExp}
                onChangeText={setReviewExp}
                keyboardType="number-pad"
                maxLength={1}
              />
              <Text style={styles.reviewLabel}>Comment</Text>
              <TextInput
                style={[styles.reviewInput, styles.reviewTextArea]}
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                maxLength={1000}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.reviewBtn, actionLoading !== '' && { opacity: 0.55 }]}
                onPress={handleSubmitReview}
                disabled={actionLoading !== ''}
              >
                {actionLoading === 'review'
                  ? <ActivityIndicator color="#111827" />
                  : <Text style={styles.reviewBtnText}>Submit Review</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Job details</Text>
        <View style={styles.detailCard}>
          <Detail label="Customer" value={customerName} />
          <Detail label="Quote" value={quotePrice ? `LKR ${quotePrice.toLocaleString()}` : '—'} />
          <Detail label="Escrow" value={job.escrow?.status || 'Not funded'} />
          <Detail label="Job status" value={String(job.status || '—').replaceAll('_', ' ')} last />
        </View>

        {canOtpCancel ? (
          <TouchableOpacity
            style={styles.cancelCard}
            onPress={() => router.push((`/(company)/jobs/v2/manage/${id}/cancel`) as any)}
            activeOpacity={0.72}
          >
            <WarningCircle size={20} color={v3.colors.error} weight="fill" />
            <View style={styles.cancelCopy}>
              <Text style={styles.cancelTitle}>Cancel before work starts</Text>
              <Text style={styles.cancelText}>OTP required. If payment is protected, it returns to the customer.</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.dispatchCard} onPress={() => router.push('/(company)/(tabs)/dispatch' as any)}>
          <UsersThree size={20} color={v3.colors.ink} weight="bold" />
          <View style={styles.dispatchCopy}>
            <Text style={styles.dispatchTitle}>Dispatch your workforce</Text>
            <Text style={styles.dispatchText}>Assign accepted company work to the right team member.</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </ScrollView>

      <NewChatModal
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        recipient={job.customer ? { id: job.customer.id, name: customerName } : null}
        jobId={job.id}
        jobTitle={job.title}
      />
    </SafeAreaView>
  )
}

function StepCard({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children?: React.ReactNode }) {
  return (
    <View style={styles.stepCard}>
      <View style={styles.stepIcon}>{icon}</View>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepText}>{text}</Text>
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  )
}

function Action({ label, onPress, outline = false, disabled = false }: { label: string; onPress: () => void; outline?: boolean; disabled?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.action, outline && styles.actionOutline, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.76}
    >
      <Text style={[styles.actionText, outline && styles.actionTextOutline]}>{label}</Text>
    </TouchableOpacity>
  )
}

function Detail({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, !last && styles.detailBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 },
  circle: { width: 40, height: 40, borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, marginHorizontal: 11 },
  eyebrow: { ...v3.typography.smallBold, color: v3.colors.amberDark, letterSpacing: 0.7 },
  headerTitle: { ...v3.typography.title, color: v3.colors.ink, marginTop: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 36 },
  hero: { backgroundColor: v3.colors.ink, borderRadius: 22, padding: 18 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusPill: { backgroundColor: v3.colors.amber, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  statusPillText: { ...v3.typography.smallBold, color: v3.colors.ink },
  heroMoney: { ...v3.typography.captionBold, color: v3.colors.amber },
  heroTitle: { ...v3.typography.h5, color: v3.colors.paper, marginTop: 12 },
  heroText: { ...v3.typography.caption, color: v3.colors.textLight, lineHeight: 18, marginTop: 5 },
  customerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: v3.colors.paper, borderRadius: 18, borderWidth: 1, borderColor: v3.colors.line, padding: 13, marginTop: 10 },
  customerAvatar: { width: 44, height: 44, borderRadius: 15, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center' },
  customerInitial: { ...v3.typography.title, color: v3.colors.ink },
  customerCopy: { flex: 1, marginLeft: 10 },
  customerName: { ...v3.typography.bodyLarge, color: v3.colors.ink },
  customerMeta: { ...v3.typography.caption, color: v3.colors.textMuted, marginTop: 2 },
  messageBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: v3.colors.amberSoft, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { ...v3.typography.title, color: v3.colors.ink, marginTop: 20, marginBottom: 9 },
  reviewCard: { backgroundColor: v3.colors.paper, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: v3.colors.line, marginTop: 8 },
  reviewLabel: { ...v3.typography.caption, color: v3.colors.textSecondary, marginTop: 10, marginBottom: 4 },
  reviewInput: { borderWidth: 1, borderColor: v3.colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: v3.colors.ink, backgroundColor: v3.colors.canvas },
  reviewTextArea: { minHeight: 90, textAlignVertical: 'top' },
  reviewBtn: { marginTop: 16, backgroundColor: v3.colors.ink, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  reviewBtnText: { color: v3.colors.paper, fontSize: 14, fontWeight: '700' },
  stepCard: { backgroundColor: v3.colors.paper, borderRadius: 20, borderWidth: 1, borderColor: v3.colors.line, padding: 16 },
  stepIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { ...v3.typography.title, color: v3.colors.ink, marginTop: 12 },
  stepText: { ...v3.typography.caption, color: v3.colors.textSecondary, lineHeight: 18, marginTop: 4 },
  actions: { gap: 9, marginTop: 14 },
  action: { height: 50, borderRadius: 15, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  actionOutline: { backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.ink },
  actionText: { ...v3.typography.bodyBold, color: v3.colors.paper },
  actionTextOutline: { color: v3.colors.ink },
  disabled: { opacity: 0.5 },
  detailCard: { backgroundColor: v3.colors.paper, borderRadius: 18, borderWidth: 1, borderColor: v3.colors.line, overflow: 'hidden' },
  detailRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  detailBorder: { borderBottomWidth: 1, borderBottomColor: v3.colors.line },
  detailLabel: { ...v3.typography.caption, color: v3.colors.textMuted },
  detailValue: { ...v3.typography.captionBold, color: v3.colors.ink, maxWidth: '58%', textAlign: 'right' },
  cancelCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: v3.colors.errorSoft, borderRadius: 18, padding: 14, marginTop: 12 },
  cancelCopy: { flex: 1, marginLeft: 10 },
  cancelTitle: { ...v3.typography.bodyBold, color: v3.colors.ink },
  cancelText: { ...v3.typography.caption, color: v3.colors.textSecondary, lineHeight: 16, marginTop: 2 },
  dispatchCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: v3.colors.amberSoft, borderRadius: 18, padding: 14, marginTop: 12 },
  dispatchCopy: { flex: 1, marginLeft: 10 },
  dispatchTitle: { ...v3.typography.bodyBold, color: v3.colors.ink },
  dispatchText: { ...v3.typography.caption, color: v3.colors.amberDark, marginTop: 2 },
  chevron: { fontSize: 23, color: v3.colors.ink },
})
