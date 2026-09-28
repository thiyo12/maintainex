import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { v2JobActions } from '@/lib/api-v2'

export default function EscrowConfirmScreen() {
  const colors = useColors()
  const router = useRouter()
  const params = useLocalSearchParams<{
    bookingId: string; jobTitle: string; taskerName: string;
    quotedAmount: string; currency?: string; quoteId?: string
  }>()
  const { bookingId, jobTitle, taskerName, quotedAmount = '0', currency = 'LKR', quoteId } = params
  const [loading, setLoading] = useState(false)
  const styles = makeStyles(colors)

  const amount = parseFloat(quotedAmount) || 0

  const handleConfirm = async () => {
    if (!quoteId) { Alert.alert('Error', 'Missing quote information'); return }
    setLoading(true)
    try {
      await v2JobActions.selectQuote(bookingId, quoteId)
      router.replace(`/(customer)/jobs/v2/confirm/${bookingId}`)
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to accept quote.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Secure Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.lockBox}>
        <Ionicons name="lock-closed-outline" size={32} color={colors.amberDark} />
      </View>
      <Text style={styles.htitle}>Secure Your Booking</Text>
      <Text style={styles.hsub}>
        Your money is held safely until you confirm the job is done. {taskerName} cannot receive it until you approve.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Payment Breakdown</Text>
        <View style={[styles.row, { borderTopWidth: 0 }]}>
          <Text style={styles.rowL}>Job</Text>
          <Text style={styles.rowV}>{jobTitle}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowL}>Quote from {taskerName}</Text>
          <Text style={styles.rowV}>{currency} {amount.toLocaleString()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowL}>Service fee</Text>
          <Text style={styles.rowV}>Calculated securely after acceptance</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalL}>Quote amount</Text>
          <Text style={styles.totalV}>{currency} {amount.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.trustRow}>
        <Ionicons name="shield-checkmark-outline" size={18} color="#22C55E" />
        <Text style={styles.trustTxt}>
          Money is held securely by MΛINTΛINEX. It is only released to {taskerName} after you confirm the work is done. You are protected.
        </Text>
      </View>

      <TouchableOpacity style={styles.btn} onPress={handleConfirm} disabled={loading} activeOpacity={0.8}>
        <Ionicons name="lock-closed-outline" size={18} color="#111827" />
        <Text style={styles.btnTxt}>
          {loading ? 'Accepting...' : 'Accept Quote & Continue'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={styles.cancelTxt}>Go back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: fonts.headingBold, color: colors.ink },
  lockBox: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.amberBg, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginTop: 8, marginBottom: 12, shadowColor: '#F5A623', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 5 },
  htitle: { fontSize: 20, fontFamily: fonts.heading, color: colors.ink, letterSpacing: -0.4, marginBottom: 6, textAlign: 'center' },
  hsub: { fontSize: 13, fontFamily: fonts.body, color: colors.muted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8, marginBottom: 20 },
  card: { backgroundColor: colors.white, borderRadius: 18, padding: 18, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 16, elevation: 4 },
  cardTitle: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: colors.border },
  rowL: { fontSize: 13, fontFamily: fonts.body, color: colors.muted, flex: 1 },
  rowV: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 4, borderTopWidth: 1.5, borderTopColor: colors.border },
  totalL: { fontSize: 15, fontFamily: fonts.headingBold, color: colors.ink },
  totalV: { fontSize: 20, fontFamily: fonts.heading, color: colors.amberDark, letterSpacing: -0.5 },
  trustRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#D1FAE5', borderRadius: 12, padding: 12, marginBottom: 12 },
  trustTxt: { fontSize: 12, fontFamily: fonts.body, color: '#22C55E', flex: 1, lineHeight: 18 },
  btn: { backgroundColor: colors.amber, borderRadius: 14, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, shadowColor: '#F5A623', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  btnTxt: { fontSize: 15, fontFamily: fonts.headingBold, color: '#111827' },
  cancelBtn: { alignItems: 'center', marginTop: 12, padding: 12 },
  cancelTxt: { fontSize: 13, fontFamily: fonts.body, color: colors.muted },
})
