import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated, ActivityIndicator, Share } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '@/lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { v2Jobs } from '@/api/v2-jobs'
import type { V2Job } from '@/api/v2-types'

export default function ReceiptScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const [job, setJob] = useState<(V2Job & { quotes: any[]; escrow: any }) | null>(null)
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
    v2Jobs.get(id as string)
      .then((res) => setJob(res.job))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: colors.red, textAlign: 'center' }}>{error}</Text>
        </View>
      </SafeAreaView>
    )
  }

  const acceptedQuote = job?.quotes?.find((q: any) => q.status === 'ACCEPTED')
  const currency = job?.escrow?.currency || 'LKR'
  const subtotal = Number(job?.escrow?.amount ?? acceptedQuote?.price ?? job?.budgetAmount ?? 0)
  const fee = Number(job?.escrow?.serviceFee ?? 0)
  const total = Number(job?.escrow?.totalAmount ?? subtotal + fee)
  const alreadyReviewed = (job?.reviews?.customerReviews || []).length > 0
  const serviceDate = job?.preferredDate
    ? new Date(job.preferredDate).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : ''
  const slotLabels: Record<string, string> = {
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
    anytime: 'Anytime',
  }
  const serviceTime = job?.preferredTimeSlot ? slotLabels[job.preferredTimeSlot] || job.preferredTimeSlot : ''
  const dateDisplay = serviceTime ? `${serviceDate} · ${serviceTime}` : serviceDate

  const paymentMethod =
    job?.escrow?.paymentMethod === 'CASH'
      ? 'Cash'
      : job?.escrow?.paymentMethod === 'CARD'
        ? 'PayHere / Card'
        : job?.escrow?.paymentMethod || 'Protected payment'

  const handleShare = async () => {
    await Share.share({
      message: [
        'MaintainEX Receipt',
        job?.title || 'Service',
        `Invoice: ${id}`,
        `Service amount: ${currency} ${subtotal.toLocaleString()}`,
        `Service fee: ${currency} ${fee.toLocaleString()}`,
        `Total: ${currency} ${total.toLocaleString()}`,
      ].join('\n'),
    })
  }
  const locationDisplay = job?.locationName || ''

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.receiptCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.receiptHeader}>
            <Ionicons name="receipt-outline" size={40} color={colors.dark} style={{ marginBottom: 8 }} />
            <Text style={styles.receiptTitle}>{t('receipt.title')}</Text>
            <Text style={styles.receiptId}>{t('receipt.invoice', { id })}</Text>
            <View style={styles.paidBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.green} />
              <Text style={styles.paidText}>{t('receipt.paid')}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.serviceSection}>
            <Text style={styles.serviceTitle}>{job?.title || t('receipt.service')}</Text>
            <Text style={styles.serviceMeta}>
              {locationDisplay}
            </Text>
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
          <View style={styles.lineItem}>
            <Text style={styles.lineLabel}>{t('receipt.discount')}</Text>
            <Text style={[styles.lineValue, { color: colors.green }]}>- {currency} 0</Text>
          </View>
          <View style={[styles.lineItem, styles.totalRow]}>
            <Text style={styles.totalLabel}>{t('receipt.totalCharged')}</Text>
            <Text style={styles.totalValue}>{currency} {total.toLocaleString()}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.paymentSection}>
            <Text style={styles.paymentLabel}>{t('receipt.paymentMethod')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="card-outline" size={14} color={colors.dark} />
              <Text style={styles.paymentValue}>{paymentMethod}</Text>
            </View>
          </View>
          <View style={styles.paymentSection}>
            <Text style={styles.paymentLabel}>{t('receipt.paidOn')}</Text>
            <Text style={styles.paymentValue}>
              {job?.escrow?.releasedAt || job?.escrow?.heldAt
                ? new Date(job.escrow.releasedAt || job.escrow.heldAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                : '—'}
            </Text>
          </View>

          <View style={styles.escrowNote}>
            <Ionicons name="lock-closed-outline" size={16} color="#1E40AF" />
            <Text style={styles.escrowText}>
              {t('receipt.escrowInfo')}
            </Text>
          </View>
        </Animated.View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={16} color={colors.dark} />
            <Text style={styles.shareBtnText}>{t('receipt.shareReceipt')}</Text>
          </TouchableOpacity>
          {!alreadyReviewed && (
            <TouchableOpacity
              style={styles.reviewBtn}
              onPress={() => router.push(('/(customer)/jobs/review/' + id) as any)}
            >
              <Ionicons name="star-outline" size={16} color={colors.white} />
              <Text style={styles.reviewBtnText}>{t('receipt.leaveReview')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.homeBtn}
        onPress={() => router.replace('/(customer)')}
      >
        <Text style={styles.homeBtnText}>{t('receipt.backToHome')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backBtn: { paddingHorizontal: 24, paddingTop: 8 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  receiptCard: {
    backgroundColor: colors.white,
    marginHorizontal: 24,
    borderRadius: 20,
    padding: 20,
    marginTop: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  receiptHeader: { alignItems: 'center', marginBottom: 16 },
  receiptTitle: { fontSize: 20, fontWeight: '800', color: colors.dark, marginBottom: 4 },
  receiptId: { fontSize: 12, color: colors.gray, marginBottom: 8 },
  paidBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  paidText: { fontSize: 13, fontWeight: '700', color: colors.green },
  divider: { height: 1, backgroundColor: colors.lightGray, marginVertical: 12 },
  serviceSection: { marginBottom: 4 },
  serviceTitle: { fontSize: 16, fontWeight: '700', color: colors.dark, marginBottom: 6 },
  serviceMeta: { fontSize: 13, color: colors.gray, marginBottom: 2 },
  serviceDate: { fontSize: 13, color: colors.gray, marginTop: 4 },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  lineLabel: { fontSize: 14, color: colors.gray },
  lineValue: { fontSize: 14, fontWeight: '600', color: colors.dark },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    marginTop: 4,
    paddingTop: 12,
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: colors.dark },
  totalValue: { fontSize: 16, fontWeight: '800', color: colors.primary },
  paymentSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  paymentLabel: { fontSize: 13, color: colors.gray },
  paymentValue: { fontSize: 13, fontWeight: '600', color: colors.dark },
  escrowNote: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  escrowText: { flex: 1, fontSize: 12, color: '#1E40AF', lineHeight: 18 },
  actions: {
    flexDirection: 'row',
    marginHorizontal: 24,
    gap: 12,
    marginBottom: 100,
  },
  shareBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  shareBtnText: { fontSize: 14, fontWeight: '600', color: colors.dark },
  reviewBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  reviewBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
  homeBtn: {
    backgroundColor: colors.customerAccent,
    marginHorizontal: 24,
    marginBottom: 32,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  homeBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
})
