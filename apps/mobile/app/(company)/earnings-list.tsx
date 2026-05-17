import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const colors = {
  coral: '#F97316',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  white: '#FFFFFF',
  green: '#10B981',
}

type Period = 'monthly' | 'quarterly' | 'yearly'

const payouts = [
  { contract: 'City Hotel - Plumbing', amount: 85000, date: 'May 14', status: 'Paid' },
  { contract: 'ABC Corp - AC Installation', amount: 150000, date: 'May 10', status: 'Paid' },
  { contract: 'Sunil Perera - Rewiring', amount: 25000, date: 'May 5', status: 'Paid' },
  { contract: 'Dilmah - Commercial Plumbing', amount: 200000, date: 'Apr 28', status: 'Paid' },
  { contract: 'City Hotel - Phase 1', amount: 170000, date: 'Apr 20', status: 'Pending' },
]

export default function CompanyEarnings() {
  const [period, setPeriod] = useState<Period>('monthly')

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Earnings</Text>
      </View>

      <View style={styles.revenueCard}>
        <Text style={styles.revenueLabel}>Total revenue</Text>
        <Text style={styles.revenueValue}>LKR 1,245,000</Text>
        <Text style={styles.revenuePeriod}>This month</Text>
        <View style={styles.revenueChange}>
          <Text style={styles.changeText}>↑ 12% from last month</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Pending</Text>
          <Text style={styles.statValue}>LKR 170,000</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Paid out</Text>
          <Text style={styles.statValue}>LKR 1,075,000</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Avg per job</Text>
          <Text style={styles.statValue}>LKR 103,750</Text>
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
        {payouts.map((p, i) => (
          <View key={i} style={styles.payoutCard}>
            <View style={styles.payoutLeft}>
              <View style={[styles.payoutDot, { backgroundColor: p.status === 'Paid' ? colors.green : colors.coral }]} />
              <View style={styles.payoutInfo}>
                <Text style={styles.payoutContract} numberOfLines={1}>{p.contract}</Text>
                <Text style={styles.payoutDate}>{p.date}</Text>
              </View>
            </View>
            <View style={styles.payoutRight}>
              <Text style={[styles.payoutAmount, { color: p.status === 'Paid' ? colors.green : colors.coral }]}>
                LKR {p.amount.toLocaleString()}
              </Text>
              <Text style={styles.payoutStatus}>{p.status}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  topBar: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark },
  revenueCard: {
    backgroundColor: colors.coral,
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
  periodTabTextActive: { color: colors.coral, fontWeight: '700' },
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
})
