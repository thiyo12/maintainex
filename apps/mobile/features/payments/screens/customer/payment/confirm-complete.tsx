import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { v2Jobs, v2JobActions } from '@/api/v2-jobs'

export default function ConfirmCompleteScreen() {
  const colors = useColors()
  const router = useRouter()
  const { bookingId, jobTitle, taskerName } = useLocalSearchParams<{
    bookingId: string
    jobTitle?: string
    taskerName?: string
  }>()
  const styles = makeStyles(colors)
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [releasing, setReleasing] = useState(false)

  useEffect(() => {
    if (!bookingId) return
    v2Jobs.get(bookingId)
      .then((res) => setJob(res.job))
      .catch((e) => Alert.alert('Error', e?.message || 'Could not load this booking.'))
      .finally(() => setLoading(false))
  }, [bookingId])

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 80 }} />
      </SafeAreaView>
    )
  }

  if (!job) return null

  const escrow = job.escrow
  const currency = escrow?.currency || 'LKR'
  const providerAmount = Number(escrow?.amount || 0)
  const serviceFee = Number(escrow?.serviceFee || 0)
  const totalAmount = Number(escrow?.totalAmount || providerAmount + serviceFee)
  const completionReady = job.workspace?.progressStatus === 'COMPLETION_REQUESTED'
  const isCash = escrow?.status === 'CASH_CONFIRMED' || escrow?.paymentMethod === 'CASH'

  const handleRelease = async () => {
    if (!completionReady) {
      Alert.alert('Not ready', 'The provider has not requested completion for this job.')
      return
    }
    setReleasing(true)
    try {
      const result = await v2JobActions.complete(bookingId, 'APPROVE_COMPLETION')
      const released = Number(result.netAmount ?? 0)
      Alert.alert(
        'Job completed',
        result.paymentMethod === 'CASH' || isCash
          ? 'Completion is recorded. Pay cash directly to the provider as agreed; MaintainEX has not held or released this cash.'
          : released > 0
            ? `${currency} ${released.toLocaleString()} was released to ${taskerName || 'the provider'}.`
            : 'The job was completed and the protected payment was released.',
        [
          {
            text: 'Leave a review',
            onPress: () => router.replace(`/(customer)/jobs/review/${bookingId}` as any),
          },
        ],
      )
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to approve completion.')
    } finally {
      setReleasing(false)
    }
  }

  const handleDispute = () => {
    router.push({
      pathname: '/(customer)/payment/dispute',
      params: {
        bookingId,
        jobTitle: jobTitle || job.title || '',
        taskerName: taskerName || 'Provider',
      },
    })
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Completion</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView>
        <View style={styles.card}>
          <Text style={styles.title}>{taskerName || 'Provider'} marked the job done</Text>
          <Text style={styles.sub}>{jobTitle || job.title}</Text>

          <View style={[styles.row, { borderTopWidth: 0 }]}>
            <Text style={styles.rowL}>Accepted service amount</Text>
            <Text style={[styles.rowV, { color: '#10B981' }]}>
              {currency} {providerAmount.toLocaleString()}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowL}>Service fee</Text>
            <Text style={styles.rowV}>{currency} {serviceFee.toLocaleString()}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalL}>{isCash ? 'Cash amount due' : 'Protected total'}</Text>
            <Text style={styles.totalV}>{currency} {totalAmount.toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.amberDark} />
          <Text style={styles.infoText}>
            {isCash
              ? 'Confirm only after you have checked the completed work. Cash is paid directly to the provider; MaintainEX will record the provider platform amount separately.'
              : 'Confirm only after you have checked the completed work. MaintainEX will calculate the provider payout and commission on the server.'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.btn, (!completionReady || releasing) && { opacity: 0.55 }]}
          onPress={handleRelease}
          disabled={!completionReady || releasing}
          activeOpacity={0.8}
        >
          {releasing
            ? <ActivityIndicator color="#FFFFFF" />
            : <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />}
          <Text style={styles.btnTxt}>
            {releasing
              ? (isCash ? 'Completing...' : 'Releasing...')
              : (isCash ? 'Confirm Work Complete' : 'Confirm Work & Release Payment')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.disputeBtn} onPress={handleDispute} disabled={releasing}>
          <Text style={styles.disputeTxt}>Work not done properly? Raise a dispute</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: fonts.headingBold, color: colors.ink },
  card: { backgroundColor: colors.white, borderRadius: 18, padding: 18, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 16, elevation: 4 },
  title: { fontSize: 18, fontFamily: fonts.heading, color: colors.ink, letterSpacing: -0.3, marginBottom: 4 },
  sub: { fontSize: 13, fontFamily: fonts.body, color: colors.muted, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: colors.border },
  rowL: { fontSize: 12, fontFamily: fonts.body, color: colors.muted },
  rowV: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.ink },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 4, borderTopWidth: 1.5, borderTopColor: colors.border },
  totalL: { fontSize: 14, fontFamily: fonts.headingBold, color: colors.ink },
  totalV: { fontSize: 18, fontFamily: fonts.heading, color: colors.amberDark },
  infoCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 16 },
  infoText: { flex: 1, fontSize: 13, fontFamily: fonts.body, color: colors.muted, lineHeight: 19 },
  btn: { backgroundColor: '#10B981', borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6, marginBottom: 10 },
  btnTxt: { fontSize: 15, fontFamily: fonts.headingBold, color: '#FFFFFF' },
  disputeBtn: { alignItems: 'center', padding: 12, marginBottom: 24 },
  disputeTxt: { fontSize: 13, fontFamily: fonts.body, color: colors.error || '#EF4444' },
})
