import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Linking, AppState } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Lock, CheckCircle, Check } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { v2Jobs, v2JobActions } from '@/api/v2-jobs'
import { v2Payments } from '@/api/v2-payments'
import Avatar from '@/components/ui/Avatar'


const CANVAS = '#0D0D0D'
const PAPER = '#FFFFFF'
const FREEZE_BG = '#111111'
const AMBER = '#F5A623'
const SUCCESS = '#06C167'
const ERROR = '#E11900'
const LINE = '#2E2E2E'
const MUTED = '#888888'

export default function V2ConfirmBookingScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<any>(null)
  const [escrow, setEscrow] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleSlot, setScheduleSlot] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const [paymentProvider, setPaymentProvider] = useState<string | null>(null)

  useEffect(() => { loadData() }, [id])

  useEffect(() => {
    if (!['CREATED', 'PENDING'].includes(paymentStatus || '')) return
    const timer = setInterval(() => { loadData() }, 3000)
    return () => clearInterval(timer)
  }, [id, paymentStatus])

  const loadData = async () => {
    try {
      const [jobRes, paymentRes] = await Promise.all([
        v2Jobs.get(id),
        v2Payments.status(id).catch(() => ({ payment: null })),
      ])
      setJob(jobRes.job)
      setEscrow(jobRes.job.escrow || null)
      setPaymentStatus(paymentRes.payment?.status || null)
      setPaymentProvider(paymentRes.payment?.gateway || null)
      if (jobRes.job.preferredTimeSlot && !scheduleSlot) {
        setScheduleSlot(jobRes.job.preferredTimeSlot)
      }
      if (jobRes.job.preferredDate && !scheduleDate) {
        setScheduleDate(String(jobRes.job.preferredDate).slice(0, 10))
      }
    } catch (e) {
      Alert.alert(t('common.error'), t('errors.generic'))
      router.back()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadData()
    })
    return () => subscription.remove()
  }, [id])

  const handleDeposit = async () => {
    setActionLoading('escrow')
    try {
      const payment = await v2Payments.start(id)
      if (!payment.checkoutUrl) throw new Error('Secure checkout is not available')
      setPaymentStatus('PENDING')
      setPaymentProvider(payment.gateway || null)
      await Linking.openURL(payment.checkoutUrl)
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleCash = () => {
    Alert.alert(
      'Use Cash Payment?',
      'Cash is paid directly to the provider and is not held by MaintainEX. The provider platform amount is recorded separately after completion.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Use Cash',
          onPress: async () => {
            setActionLoading('cash')
            try {
              await v2JobActions.confirmCashPayment(id)
              await loadData()
            } catch (e: any) {
              Alert.alert(t('common.error'), e?.message || 'Could not select cash payment.')
            } finally {
              setActionLoading('')
            }
          },
        },
      ],
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={AMBER} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  const steps = [
    { label: escrow?.status === 'CASH_CONFIRMED' ? 'Cash payment selected' : t('booking.paymentSecured'), done: ['PROTECTED', 'CASH_CONFIRMED'].includes(escrow?.status) },
    { label: t('tracking.inProgress'), done: job?.status === 'IN_PROGRESS' || job?.status === 'COMPLETED' },
    { label: t('booking.confirmComplete'), done: job?.workspace?.progressStatus === 'COMPLETION_REQUESTED' || job?.status === 'COMPLETED' },
    { label: t('tracking.completed'), done: job?.status === 'COMPLETED' },
  ]

  const acceptedQuote = job?.quotes?.find((q: any) => q.status === 'ACCEPTED')

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('booking.confirm')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {acceptedQuote && (
          <View style={styles.card}>
            <Text style={styles.label}>{t('booking.professional')}</Text>
            <View style={styles.providerRow}>
              <Avatar
                name={acceptedQuote.provider?.name || t('jobDetail.provider')}
                size={48}
                color={acceptedQuote.providerType === 'COMPANY' ? colors.company : AMBER}
              />
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>{acceptedQuote.provider?.name || t('jobDetail.provider')}</Text>
                <Text style={styles.providerType}>{acceptedQuote.providerType}</Text>
              </View>
              <Text style={styles.providerPrice}>LKR {acceptedQuote.price.toLocaleString()}</Text>
            </View>
          </View>
        )}

        {job && (
          <View style={styles.card}>
            <Text style={styles.label}>{t('dispute.job')}</Text>
            <Text style={styles.jobTitle}>{job.title}</Text>
            {job.category && <Text style={styles.jobCategory}>{job.category}</Text>}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.label}>Scheduled service</Text>
          <Text style={styles.jobTitle}>
            {(scheduleDate || 'Date to be confirmed') + (scheduleSlot ? ` · ${scheduleSlot}` : '')}
          </Text>
          <Text style={styles.jobCategory}>Accepted bookings keep a locked schedule. Rescheduling uses a dedicated workflow.</Text>
        </View>

        <View style={styles.freezeCard}>
          <View style={styles.freezeIconWrap}>
            <Lock size={24} color={AMBER} weight="regular" />
          </View>
          <Text style={styles.freezeLabel}>{t('wallet.balance')}</Text>
          <Text style={styles.freezeAmount}>
            {escrow?.currency || 'LKR'} {(escrow?.totalAmount || acceptedQuote?.price || job?.budgetAmount || 0).toLocaleString()}
          </Text>
          <Text style={styles.freezeDesc}>
            {escrow?.status === 'CASH_CONFIRMED'
              ? 'Cash is paid directly to the provider. MaintainEX does not hold these funds.'
              : t('booking.escrowInfo')}
          </Text>

          {escrow?.status === 'PENDING_PAYMENT' && !['REFUND_REQUIRED', 'CHARGEDBACK'].includes(paymentStatus || '') && (
            <>
              <TouchableOpacity
                style={[styles.ctaBtn, actionLoading !== '' && { opacity: 0.6 }]}
                onPress={handleDeposit}
                disabled={actionLoading !== ''}
                activeOpacity={0.8}
              >
                {actionLoading === 'escrow' ? (
                  <ActivityIndicator color={CANVAS} />
                ) : (
                  <Text style={styles.ctaText}>
                    {paymentStatus === 'PENDING' ? 'Continue Secure Payment' : 'Pay Securely with PayPal'}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ctaBtn, styles.cashBtn, actionLoading !== '' && { opacity: 0.6 }]}
                onPress={handleCash}
                disabled={actionLoading !== ''}
                activeOpacity={0.8}
              >
                {actionLoading === 'cash' ? (
                  <ActivityIndicator color={CANVAS} />
                ) : (
                  <Text style={[styles.ctaText, styles.cashBtnText]}>Use Cash Instead</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {escrow && ['PROTECTED', 'CASH_CONFIRMED'].includes(escrow.status) && (
            <View style={styles.successBadge}>
              <CheckCircle size={18} color={SUCCESS} weight="fill" />
              <Text style={styles.successText}>
                {escrow.status === 'CASH_CONFIRMED' ? 'Cash payment selected' : t('booking.paymentSecured')}
              </Text>
            </View>
          )}

          {paymentStatus === 'REFUND_REQUIRED' && (
            <Text style={[styles.freezeDesc, styles.errorText]}>
              Payment was captured after the booking changed. MaintainEX has flagged it for refund review.
            </Text>
          )}
          {paymentStatus === 'CHARGEDBACK' && (
            <Text style={[styles.freezeDesc, styles.errorText]}>
              This payment has a chargeback and the escrow is on hold.
            </Text>
          )}
        </View>

        <View style={styles.stepsCard}>
          <Text style={styles.label}>{t('booking.paymentSecured')}</Text>
          {steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepTrack}>
                <View style={[styles.stepDot, step.done && styles.stepDotDone]}>
                  {step.done ? (
                    <Check size={12} color={PAPER} weight="bold" />
                  ) : (
                    <Text style={styles.stepNum}>{i + 1}</Text>
                  )}
                </View>
                {i < steps.length - 1 && (
                  <View style={[styles.stepLine, step.done && styles.stepLineDone]} />
                )}
              </View>
              <Text style={[styles.stepLabel, step.done && styles.stepLabelDone]}>{step.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CANVAS,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: LINE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 20,
    fontFamily: fonts.bodyMedium,
    color: PAPER,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.headingBold,
    color: PAPER,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  label: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  card: {
    backgroundColor: PAPER,
    borderRadius: 18,
    padding: 18,
    marginTop: 14,
  },

  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  providerName: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: '#000000',
  },
  providerType: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: '#6B6B6B',
    marginTop: 2,
  },
  providerPrice: {
    fontSize: 18,
    fontFamily: fonts.headingBold,
    color: '#000000',
  },

  jobTitle: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: '#000000',
  },
  jobCategory: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: '#6B6B6B',
    marginTop: 4,
  },

  dateInput: {
    borderWidth: 1.5,
    borderColor: LINE,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontFamily: fonts.body,
    color: '#000000',
    backgroundColor: '#F7F7F7',
  },

  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: LINE,
    backgroundColor: '#F7F7F7',
  },
  chipActive: {
    backgroundColor: 'rgba(245,166,35,0.12)',
    borderColor: AMBER,
  },
  chipText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: '#000000',
  },
  chipTextActive: {
    color: AMBER,
    fontFamily: fonts.bodyMedium,
  },

  freezeCard: {
    backgroundColor: FREEZE_BG,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginTop: 18,
  },
  freezeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(245,166,35,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  freezeLabel: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: '#888888',
    marginBottom: 4,
  },
  freezeAmount: {
    fontSize: 28,
    fontFamily: fonts.heading,
    color: AMBER,
    marginBottom: 8,
  },
  freezeDesc: {
    fontSize: 12,
    fontFamily: fonts.bodyLight,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  ctaBtn: {
    backgroundColor: AMBER,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: CANVAS,
  },
  cashBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: AMBER,
    marginTop: 10,
  },
  cashBtnText: {
    color: AMBER,
  },
  errorText: {
    color: ERROR,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(6,193,103,0.14)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  successText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: SUCCESS,
  },

  stepsCard: {
    backgroundColor: PAPER,
    borderRadius: 18,
    padding: 18,
    marginTop: 18,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  stepTrack: {
    alignItems: 'center',
    width: 28,
    marginRight: 14,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: LINE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotDone: {
    backgroundColor: SUCCESS,
  },
  stepNum: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: '#888888',
  },
  stepLine: {
    width: 2,
    height: 24,
    backgroundColor: LINE,
    marginTop: 4,
  },
  stepLineDone: {
    backgroundColor: SUCCESS,
  },
  stepLabel: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: '#888888',
    paddingTop: 3,
  },
  stepLabelDone: {
    color: '#000000',
    fontFamily: fonts.bodyMedium,
  },
})
