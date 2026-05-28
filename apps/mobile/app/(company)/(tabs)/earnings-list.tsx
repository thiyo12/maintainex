import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../../lib/colors'
import { company } from '../../../lib/api'

type Period = 'monthly' | 'quarterly' | 'yearly'

export default function CompanyEarnings() {
  const [period, setPeriod] = useState<Period>('monthly')
  const [loading, setLoading] = useState(true)
  const [earnings, setEarnings] = useState<any>(null)
  const [payouts, setPayouts] = useState<any[]>([])

  const fetchEarnings = useCallback(async (p?: Period) => {
    try {
      const data = await company.earnings.get(p || period)
      setEarnings(data)
      setPayouts(data.recentPayouts || data.payouts || [])
    } catch {
      setEarnings(null)
      setPayouts([])
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchEarnings(period)
  }, [period, fetchEarnings])

  const totalRevenue = earnings?.totalRevenue || earnings?.monthlyRevenue || 0
  const pendingAmount = earnings?.pendingAmount || 0
  const paidOut = earnings?.paidOut || 0
  const avgPerJob = earnings?.avgPerJob || 0
  const revenueChange = earnings?.revenueChange || 0

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Earnings</Text>
      </View>

      <View style={styles.revenueCard}>
        <Text style={styles.revenueLabel}>Total revenue</Text>
        <Text style={styles.revenueValue}>LKR {Number(totalRevenue).toLocaleString()}</Text>
        <Text style={styles.revenuePeriod}>This {period}</Text>
        <View style={styles.revenueChange}>
          <Text style={styles.changeText}>↑ {revenueChange}% from last {period}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Pending</Text>
          <Text style={styles.statValue}>LKR {Number(pendingAmount).toLocaleString()}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Paid out</Text>
          <Text style={styles.statValue}>LKR {Number(paidOut).toLocaleString()}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Avg per job</Text>
          <Text style={styles.statValue}>LKR {Number(avgPerJob).toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.periodTabs}>
        {(['monthly', 'quarterly', 'yearly'] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodTab, period === p && styles.periodTabActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodTabText, period === p && styles.periodTabTextActive]}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.payoutTitle}>Recent payouts</Text>
        {payouts.length === 0 ? (
          <Text style={styles.emptyText}>No payouts yet</Text>
        ) : (
          payouts.map((p, i) => {
            const status = p.status || (p.paid ? 'Paid' : 'Pending')
            const isPaid = status === 'Paid' || status === 'paid'
            return (
              <View key={p.id || i} style={styles.payoutCard}>
                <View style={styles.payoutLeft}>
                  <View style={[styles.payoutDot, { backgroundColor: isPaid ? colors.green : colors.companyAccent }]} />
                  <View style={styles.payoutInfo}>
                    <Text style={styles.payoutContract} numberOfLines={1}>{p.contract || p.title}</Text>
                    <Text style={styles.payoutDate}>{p.date || (p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '')}</Text>
                  </View>
                </View>
                <View style={styles.payoutRight}>
                  <Text style={[styles.payoutAmount, { color: isPaid ? colors.green : colors.companyAccent }]}>
                    LKR {Number(p.amount).toLocaleString()}
                  </Text>
                  <Text style={styles.payoutStatus}>{status}</Text>
                </View>
              </View>
            )
          })
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  topBar: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark },
  revenueCard: {
    backgroundColor: colors.companyAccent,
    marginHorizontal: 24,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  revenueLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  revenueValue: { fontSize: 34, fontWeight: '800', color: colors.white, marginBottom: 4 },
  revenuePeriod: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 12 },
  revenueChange: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  changeText: { fontSize: 13, fontWeight: '600', color: colors.white },
  statsRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statLabel: { fontSize: 11, color: colors.gray, marginBottom: 4 },
  statValue: { fontSize: 13, fontWeight: '800', color: colors.dark },
  periodTabs: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: colors.lightGray,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  periodTab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  periodTabActive: { backgroundColor: colors.white },
  periodTabText: { fontSize: 14, fontWeight: '600', color: colors.gray },
  periodTabTextActive: { color: colors.companyAccent, fontWeight: '700' },
  payoutTitle: {
    fontSize: 16, fontWeight: '700', color: colors.dark,
    paddingHorizontal: 24, marginBottom: 10,
  },
  payoutCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 24,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  payoutLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  payoutDot: { width: 8, height: 8, borderRadius: 4 },
  payoutInfo: { flex: 1 },
  payoutContract: { fontSize: 13, fontWeight: '600', color: colors.dark },
  payoutDate: { fontSize: 11, color: colors.gray, marginTop: 2 },
  payoutRight: { alignItems: 'flex-end' },
  payoutAmount: { fontSize: 14, fontWeight: '700' },
  payoutStatus: { fontSize: 11, color: colors.gray, marginTop: 2 },
  emptyText: { textAlign: 'center', color: colors.gray, marginTop: 20, fontSize: 14 },
})
