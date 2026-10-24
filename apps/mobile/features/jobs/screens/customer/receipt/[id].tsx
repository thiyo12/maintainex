import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated, ActivityIndicator, Share } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FileText, CheckCircle, Lock, CreditCard, ShareNetwork, Star } from 'phosphor-react-native'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { useTranslation } from 'react-i18next'
import { v2Jobs } from '@/api/v2-jobs'
import { v2Payments } from '@/api/v2-payments'
import type { V2Job } from '@/api/v2-types'
import { deriveReceiptPaymentState } from '../v2/confirm/payment-presentation'

export default function ReceiptScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const [job, setJob] = useState<(V2Job & { quotes: any[]; escrow?: any }) | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const [paidAt, setPaidAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start()
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      v2Jobs.get(id as string),
      v2Payments.status(id as string).catch(() => null),
    ])
      .then(([res, payment]) => {
        setJob(res.job)
        setPaymentStatus(payment?.payment?.status ?? null)
        setPaidAt(payment?.payment?.paidAt ?? res.job.escrow?.cashCollectionConfirmedAt ?? null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.amber} style={{ flex: 1 }} />
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    )
  }

  const acceptedQuote = job?.quotes?.find((q: any) => q.status === 'ACCEPTED')
  const currency = job?.escrow?.currency || 'LKR'
  const subtotal = Number(job?.escrow?.amount ?? acceptedQuote?.price ?? 0)
  const fee = Number(job?.escrow?.serviceFee ?? 0)
  const total = Number(job?.escrow?.totalAmount ?? subtotal + fee)
  const paymentState = deriveReceiptPaymentState({
    paymentStatus,
    paymentMethod: job?.escrow?.paymentMethod,
    escrowStatus: job?.escrow?.status,
    cashCollectionStatus: job?.escrow?.cashCollectionStatus,
    cashCollectedMinor: job?.escrow?.cashCollectedMinor,
    escrowTotalAmount: job?.escrow?.totalAmount,
  })
  const paymentStateLabel: Record<string, string> = {
    PAID: 'Paid', PARTIAL: 'Partially paid', REFUNDED: 'Refunded', DISPUTED: 'Disputed', FAILED: 'Failed',
    PENDING: 'Payment pending', CASH_SELECTED: 'Cash selected · collection not verified',
    UNVERIFIED: 'Payment status unavailable',
  }
  const paymentMethodLabel = job?.escrow?.paymentMethod === 'CASH'
    ? 'Cash'
    : paymentStatus
      ? 'Online payment'
      : 'Not confirmed'
  const reportedCash = job?.escrow?.cashCollectedMinor != null ? Number(job.escrow.cashCollectedMinor) / 100 : 0
  const amountPaid = job?.escrow?.paymentMethod === 'CASH' && job.escrow.cashCollectionStatus === 'CUSTOMER_CONFIRMED'
    ? Math.min(total, reportedCash)
    : paymentState === 'PAID' ? total : 0
  const amountDue = Math.max(0, total - amountPaid)
  const serviceDate = job?.preferredDate
    ? new Date(job.preferredDate).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : ''
  const serviceTime = job?.timeSlot || ''
  const dateDisplay = serviceTime ? `${serviceDate} at ${serviceTime}` : serviceDate
  const locationDisplay = job?.locationName || ''

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.receiptCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.receiptHeader}>
            <FileText size={40} color={colors.ink} weight="regular" style={{ marginBottom: 8 }} />
            <Text style={styles.receiptTitle}>{t('receipt.title')}</Text>
            <Text style={styles.receiptId}>{t('receipt.invoice', { id })}</Text>
            <View style={[styles.paidBadge, paymentState !== 'PAID' && styles.pendingBadge]}>
              {paymentState === 'PAID' && <CheckCircle size={14} color={colors.success} weight="fill" />}
              <Text style={[styles.paidText, paymentState !== 'PAID' && styles.pendingText]}>
                {paymentStateLabel[paymentState]}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.serviceSection}>
            <Text style={styles.serviceTitle}>{job?.title || t('receipt.service')}</Text>
            <Text style={styles.serviceMeta}>{locationDisplay}</Text>
            <Text style={styles.serviceDate}>{dateDisplay}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.lineItem}>
            <Text style={styles.lineLabel}>{t('receipt.serviceAmount')}</Text>
            <Text style={styles.lineValue}>{currency} {subtotal.toLocaleString()}</Text>
          </View>
          <View style={styles.lineItem}>
            <Text style={styles.lineLabel}>{t('receipt.platformFee')}</Text>
            <Text style={styles.lineValue}>{currency} {fee.toLocaleString()}</Text>
          </View>
          <View style={[styles.lineItem, styles.totalRow]}>
            <Text style={styles.totalLabel}>Invoice total</Text>
            <Text style={styles.totalValue}>{currency} {total.toLocaleString()}</Text>
          </View>
          <View style={styles.lineItem}>
            <Text style={styles.lineLabel}>Paid</Text>
            <Text style={styles.lineValue}>{currency} {amountPaid.toLocaleString()}</Text>
          </View>
          <View style={styles.lineItem}>
            <Text style={styles.lineLabel}>Due</Text>
            <Text style={styles.lineValue}>{currency} {amountDue.toLocaleString()}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.paymentSection}>
            <Text style={styles.paymentLabel}>{t('receipt.paymentMethod')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <CreditCard size={14} color={colors.ink} weight="regular" />
              <Text style={styles.paymentValue}>{paymentMethodLabel}</Text>
            </View>
          </View>
          <View style={styles.paymentSection}>
            <Text style={styles.paymentLabel}>{t('receipt.paidOn')}</Text>
            <Text style={styles.paymentValue}>
              {paidAt ? new Date(paidAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
            </Text>
          </View>

          <View style={styles.escrowNote}>
            <Lock size={16} color={colors.amber} weight="regular" />
            <Text style={styles.escrowText}>
              {paymentState === 'CASH_SELECTED'
                ? 'Selecting cash does not confirm collection. The provider must report what was received.'
              : job?.escrow?.paymentMethod === 'CASH' && ['PAID', 'PARTIAL'].includes(paymentState)
                  ? 'Cash amount was reported by the provider and confirmed by you. MaintainEX did not hold these funds.'
                  : 'Payment totals and status are shown only when confirmed by the payment record.'}
            </Text>
          </View>
        </Animated.View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.shareBtn} onPress={() => Share.share({ message: `${job?.title || 'MaintainEX invoice'} · ${currency} ${total.toLocaleString()} · ${paymentStateLabel[paymentState]}` })}>
            <ShareNetwork size={16} color={colors.ink} weight="regular" />
            <Text style={styles.shareBtnText}>{t('receipt.shareReceipt')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.reviewBtn} onPress={() => router.push('/(customer)/jobs/review/' + id as any)}>
            <Star size={16} color={colors.ink} weight="regular" />
            <Text style={styles.reviewBtnText}>{t('receipt.leaveReview')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(customer)')}>
        <Text style={styles.homeBtnText}>{t('receipt.backToHome')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: colors.error, textAlign: 'center' },
  receiptCard: {
    backgroundColor: colors.white,
    marginHorizontal: 24,
    borderRadius: 20,
    padding: 20,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  receiptHeader: { alignItems: 'center', marginBottom: 16 },
  receiptTitle: { fontSize: 20, fontFamily: fonts.heading, color: colors.ink, marginBottom: 4 },
  receiptId: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  paidBadge: { backgroundColor: colors.successSoft || '#E7F8EF', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
  pendingBadge: { backgroundColor: colors.amberBg },
  paidText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.success },
  pendingText: { color: colors.amberDark },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  serviceSection: { marginBottom: 4 },
  serviceTitle: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.ink, marginBottom: 6 },
  serviceMeta: { fontSize: 13, color: colors.muted, marginBottom: 2 },
  serviceDate: { fontSize: 13, color: colors.muted, marginTop: 4 },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  lineLabel: { fontSize: 14, color: colors.muted },
  lineValue: { fontSize: 14, fontFamily: fonts.body, color: colors.ink },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 12 },
  totalLabel: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.ink },
  totalValue: { fontSize: 16, fontFamily: fonts.heading, color: colors.amberDark },
  paymentSection: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  paymentLabel: { fontSize: 13, color: colors.muted },
  paymentValue: { fontSize: 13, fontFamily: fonts.body, color: colors.ink },
  escrowNote: { flexDirection: 'row', backgroundColor: colors.amberBg, padding: 12, borderRadius: 12, alignItems: 'center', gap: 8, marginTop: 12 },
  escrowText: { flex: 1, fontSize: 12, color: colors.amberDark, lineHeight: 18 },
  actions: { flexDirection: 'row', marginHorizontal: 24, gap: 12, marginBottom: 100 },
  shareBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, backgroundColor: colors.white },
  shareBtnText: { fontSize: 14, fontFamily: fonts.body, color: colors.ink },
  reviewBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.amber, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  reviewBtnText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.ink },
  homeBtn: { backgroundColor: colors.ink, marginHorizontal: 24, marginBottom: 32, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  homeBtnText: { fontSize: 17, fontFamily: fonts.bodyMedium, color: colors.white },
})
