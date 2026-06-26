import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { v2JobActions } from '../../../lib/api-v2'

export default function ConfirmCompleteScreen() {
  const colors = useColors()
  const router = useRouter()
  const params = useLocalSearchParams<{
    bookingId: string; jobTitle: string; taskerName: string;
    taskerPayout: string; platformFee: string; currency?: string
  }>()
  const { bookingId, jobTitle, taskerName, taskerPayout = '0', platformFee = '0', currency = 'LKR' } = params
  const [rating, setRating] = useState(0)
  const [loading, setLoading] = useState(false)
  const styles = makeStyles(colors)

  const payout = parseFloat(taskerPayout) || 0
  const fee = parseFloat(platformFee) || 0
  const total = payout + fee

  const handleRelease = async () => {
    if (rating === 0) { Alert.alert('Please rate the work first'); return }
    setLoading(true)
    try {
      await v2JobActions.complete(bookingId, 'APPROVE_COMPLETION')
      await v2JobActions.createReview(bookingId, {
        reviewType: 'CUSTOMER_REVIEWS_PROVIDER',
        quality: rating,
        communication: rating,
        timeliness: rating,
        comment: '',
      })
      Alert.alert('Payment Released!', `LKR ${payout.toLocaleString()} has been sent to ${taskerName}.`, [
        { text: 'OK', onPress: () => router.replace('/(customer)/(tabs)') },
      ])
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to release payment.')
    } finally {
      setLoading(false)
    }
  }

  const handleDispute = () => {
    router.push({ pathname: '/(customer)/payment/dispute', params: { bookingId, jobTitle, taskerName } })
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
          <Text style={styles.title}>{taskerName} marked the job done</Text>
          <Text style={styles.sub}>{jobTitle}</Text>
          <View style={[styles.row, { borderTopWidth: 0 }]}>
            <Text style={styles.rowL}>Tasker receives</Text>
            <Text style={[styles.rowV, { color: '#10B981' }]}>{currency} {payout.toLocaleString()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowL}>Platform fee</Text>
            <Text style={styles.rowV}>{currency} {fee.toLocaleString()}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalL}>Total released</Text>
            <Text style={styles.totalV}>{currency} {total.toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={{ fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink, marginBottom: 10 }}>
            How was {taskerName}'s work?
          </Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map(i => (
              <TouchableOpacity key={i} onPress={() => setRating(i)}>
                <Ionicons
                  name={i <= rating ? 'star' : 'star-outline'}
                  size={32}
                  color={i <= rating ? colors.amber : colors.border}
                  style={{ marginRight: 4 }}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.btn, rating === 0 && { backgroundColor: colors.muted }]}
          onPress={handleRelease}
          disabled={loading || rating === 0}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.btnTxt}>
            {loading ? 'Releasing...' : 'Confirm & Release Payment'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.disputeBtn} onPress={handleDispute}>
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
  stars: { flexDirection: 'row', marginBottom: 14 },
  btn: { backgroundColor: '#10B981', borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6, marginBottom: 10 },
  btnTxt: { fontSize: 15, fontFamily: fonts.headingBold, color: '#FFFFFF' },
  disputeBtn: { alignItems: 'center', padding: 12, marginBottom: 24 },
  disputeTxt: { fontSize: 13, fontFamily: fonts.body, color: colors.error || '#EF4444' },
})
