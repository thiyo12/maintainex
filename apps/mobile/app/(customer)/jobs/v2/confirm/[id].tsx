import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Linking, AppState } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../../../lib/ThemeContext'
import { fonts } from '../../../../../lib/fonts'
import { v2Jobs, v2JobActions, v2Payments } from '../../../../../lib/api-v2'
import Avatar from '../../../../../components/ui/Avatar'

const TIME_SLOTS = [
  { value: 'morning', label: 'Morning (8 AM–12 PM)' },
  { value: 'afternoon', label: 'Afternoon (12–5 PM)' },
  { value: 'evening', label: 'Evening (5–9 PM)' },
]

export default function V2ConfirmBookingScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<any>(null)
  const [escrow, setEscrow] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleSlot, setScheduleSlot] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)

  useEffect(() => { loadData() }, [id])

  useEffect(() => {
    if (!['CREATED', 'PENDING'].includes(paymentStatus || '')) return
    const timer = setInterval(() => { loadData() }, 3000)
    return () => clearInterval(timer)
  }, [id, paymentStatus])

  useEffect(() => {
    if (!scheduleDate) {
      setScheduleDate(new Date().toISOString().split('T')[0])
    }
  }, [])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadData()
    })
    return () => subscription.remove()
  }, [id])

  const loadData = async () => {
    try {
      const [jobRes, paymentRes] = await Promise.all([
        v2Jobs.get(id),
        v2Payments.status(id).catch(() => ({ payment: null })),
      ])
      setJob(jobRes.job)
      setEscrow(jobRes.job.escrow || null)
      setPaymentStatus(paymentRes.payment?.status || null)
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

  const handleDeposit = async () => {
    if (!scheduleSlot) {
      Alert.alert(t('booking.timeSlot'), t('components.selectTime'))
      return
    }
    setActionLoading('escrow')
    try {
      await v2JobActions.update(id, {
        preferredDate: scheduleDate,
        preferredTimeSlot: scheduleSlot,
      })
      const payment = await v2Payments.start(id)
      if (!payment.checkoutUrl) throw new Error('Secure checkout is not available')
      setPaymentStatus('PENDING')
      await Linking.openURL(payment.checkoutUrl)
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setActionLoading('')
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  const steps = [
    { label: t('booking.paymentSecured'), done: escrow?.status === 'PROTECTED' },
    { label: t('tracking.inProgress'), done: job?.status === 'IN_PROGRESS' || job?.status === 'COMPLETED' },
    { label: t('booking.confirmComplete'), done: job?.workspace?.progressStatus === 'COMPLETION_REQUESTED' || job?.status === 'COMPLETED' },
    { label: t('tracking.completed'), done: job?.status === 'COMPLETED' },
  ]

  const acceptedQuote = job?.quotes?.find((q: any) => q.status === 'ACCEPTED')

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('booking.confirm')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Provider Info */}
        {acceptedQuote && (
          <View style={styles.providerSection}>
            <Text style={styles.sectionLabel}>{t('booking.professional')}</Text>
            <View style={styles.providerRow}>
              <Avatar
                name={acceptedQuote.provider?.name || t('jobDetail.provider')}
                size={52}
                color={acceptedQuote.providerType === 'COMPANY' ? colors.company : colors.amber}
              />
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>{acceptedQuote.provider?.name || t('jobDetail.provider')}</Text>
                <Text style={styles.providerType}>{acceptedQuote.providerType}</Text>
              </View>
              <Text style={styles.providerPrice}>LKR {acceptedQuote.price.toLocaleString()}</Text>
            </View>
          </View>
        )}

        {/* Job Summary */}
        {job && (
          <View style={styles.jobSection}>
            <Text style={styles.sectionLabel}>{t('dispute.job')}</Text>
            <Text style={styles.jobTitle}>{job.title}</Text>
          </View>
        )}

        {/* Schedule Selection */}
        {escrow?.status === 'PENDING_PAYMENT' && (
        <View style={styles.scheduleSection}>
          <Text style={styles.sectionLabel}>{t('booking.selectDate')}</Text>
          <TextInput
            style={styles.dateInput}
            value={scheduleDate}
            onChangeText={setScheduleDate}
            placeholder={t('booking.datePlaceholder')}
            placeholderTextColor={colors.muted}
          />
          <Text style={[styles.sectionLabel, { marginTop: 12 }]}>{t('booking.timeSlot')}</Text>
          <View style={styles.timeGrid}>
            {TIME_SLOTS.map((slot) => (
              <TouchableOpacity
                key={slot.value}
                style={[
                  styles.timeChip,
                  scheduleSlot === slot.value && { backgroundColor: colors.amberBg, borderColor: colors.amber },
                  { borderColor: colors.border, backgroundColor: colors.white },
                ]}
                onPress={() => setScheduleSlot(slot.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.timeText, scheduleSlot === slot.value && { color: colors.amberDark, fontFamily: fonts.bodyMedium }]}>
                  {slot.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        )}

        {/* Payment Freeze Card */}
        <View style={styles.freezeCard}>
          <View style={styles.freezeIconWrap}>
            <Ionicons name="lock-closed-outline" size={28} color={colors.ink} />
          </View>
          <Text style={styles.freezeLabel}>{t('wallet.balance')}</Text>
          <Text style={styles.freezeAmount}>
            {escrow?.currency || 'LKR'} {(escrow?.totalAmount || acceptedQuote?.price || job?.budgetAmount || 0).toLocaleString()}
          </Text>
          <Text style={styles.freezeDesc}>
            {t('booking.escrowInfo')}
          </Text>
          {escrow?.status === 'PENDING_PAYMENT' && !['REFUND_REQUIRED', 'CHARGEDBACK'].includes(paymentStatus || '') && (
            <TouchableOpacity
              style={styles.depositBtn}
              onPress={handleDeposit}
              disabled={actionLoading !== ''}
            >
              {actionLoading === 'escrow' ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Text style={styles.depositBtnText}>{paymentStatus === 'PENDING' ? 'Continue Secure Payment' : 'Pay Securely with PayHere'}</Text>
              )}
            </TouchableOpacity>
          )}
          {escrow && escrow.status === 'PROTECTED' && (
            <View style={styles.frozenBadge}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.frozenBadgeText}>{t('booking.paymentSecured')}</Text>
            </View>
          )}
          {paymentStatus === 'REFUND_REQUIRED' && (
            <Text style={[styles.freezeDesc, { color: colors.error }]}>
              Payment was captured after the booking changed. MaintainEX has flagged it for refund review.
            </Text>
          )}
          {paymentStatus === 'CHARGEDBACK' && (
            <Text style={[styles.freezeDesc, { color: colors.error }]}>
              This payment has a chargeback and the escrow is on hold.
            </Text>
          )}
        </View>

        {/* 4-Step Payment Flow */}
        <View style={styles.stepsSection}>
          <Text style={styles.sectionLabel}>{t('booking.paymentSecured')}</Text>
          {steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepLeft}>
                <View style={[styles.stepDot, step.done && styles.stepDotDone]}>
                  {step.done ? (
                    <Ionicons name="checkmark" size={14} color={colors.white} />
                  ) : (
                    <Text style={styles.stepNum}>{i + 1}</Text>
                  )}
                </View>
                {i < steps.length - 1 && <View style={[styles.stepLine, step.done && styles.stepLineDone]} />}
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepLabel, step.done && styles.stepLabelDone]}>{step.label}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backText: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.amber },
  headerTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.ink },
  content: { flex: 1, paddingHorizontal: 20 },

  sectionLabel: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  providerSection: { marginTop: 16 },
  providerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 14, padding: 16, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  providerInfo: { flex: 1, marginLeft: 12 },
  providerName: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.ink },
  providerType: { fontSize: 12, fontFamily: fonts.body, color: colors.muted, marginTop: 2 },
  providerPrice: { fontSize: 18, fontFamily: fonts.heading, color: colors.primaryDark },

  jobSection: { marginTop: 16 },
  jobTitle: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.ink },

  scheduleSection: { marginTop: 20 },
  dateInput: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 15, color: colors.ink, backgroundColor: colors.white },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  timeChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
  timeText: { fontSize: 13, color: colors.ink },

  freezeCard: { backgroundColor: colors.ink, borderRadius: 20, padding: 24, alignItems: 'center', marginTop: 20 },
  freezeIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.amberBg, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  freezeLabel: { fontSize: 13, fontFamily: fonts.body, color: colors.muted, marginBottom: 4 },
  freezeAmount: { fontSize: 28, fontFamily: fonts.heading, color: colors.amber, marginBottom: 8 },
  freezeDesc: { fontSize: 12, fontFamily: fonts.bodyLight, color: colors.muted, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  depositBtn: { backgroundColor: colors.amber, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 14, width: '100%', alignItems: 'center' },
  depositBtnText: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.ink },
  frozenBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  frozenBadgeText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.success },

  stepsSection: { marginTop: 24, marginBottom: 40 },
  stepRow: { flexDirection: 'row', marginBottom: 4 },
  stepLeft: { alignItems: 'center', width: 32, marginRight: 12 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  stepDotDone: { backgroundColor: colors.success },
  stepNum: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.muted },
  stepLine: { width: 2, height: 28, backgroundColor: colors.border },
  stepLineDone: { backgroundColor: colors.success },
  stepContent: { paddingTop: 4, flex: 1 },
  stepLabel: { fontSize: 14, fontFamily: fonts.body, color: colors.muted },
  stepLabelDone: { color: colors.ink, fontFamily: fonts.bodyMedium },
})
