import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors } from '../../lib/colors'
import { earnings } from '../../lib/api'

type Period = 'weekly' | 'monthly' | 'yearly'

interface EarningsData {
  balance: number
  totalEarned: number
  totalJobs: number
  pendingAmount?: number
  transactions: { job: string; amount: number; date: string; status: string }[]
}

export default function TaskerEarnings() {
  const [period, setPeriod] = useState<Period>('weekly')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<EarningsData | null>(null)

  useEffect(() => {
    loadEarnings()
  }, [])

  async function loadEarnings() {
    try {
      const res = await earnings.get()
      setData(res)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Earnings</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available balance</Text>
            <Text style={styles.balanceValue}>LKR {(data?.balance || 0).toLocaleString()}</Text>
            <TouchableOpacity style={styles.withdrawBtn}>
              <Text style={styles.withdrawBtnText}>Withdraw</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>This {period}</Text>
              <Text style={styles.statValue}>LKR {(data?.totalEarned || 0).toLocaleString()}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Pending</Text>
              <Text style={styles.statValue}>LKR {(data?.pendingAmount || 0).toLocaleString()}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total all time</Text>
              <Text style={styles.statValue}>LKR {(data?.totalEarned || 0).toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.periodTabs}>
            {(['weekly', 'monthly', 'yearly'] as Period[]).map((p) => (
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
            <Text style={styles.transactionTitle}>Recent transactions</Text>
            {(data?.transactions || []).length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyTitle}>No transactions yet</Text>
              </View>
            ) : (
              (data?.transactions || []).map((tx, i) => (
                <View key={i} style={styles.txCard}>
                  <View style={styles.txLeft}>
                    <View style={[styles.txDot, { backgroundColor: tx.status === 'Cleared' ? colors.green : colors.primary }]} />
                    <View>
                      <Text style={styles.txJob}>{tx.job}</Text>
                      <Text style={styles.txDate}>{tx.date} • {tx.status}</Text>
                    </View>
                  </View>
                  <View style={styles.txRight}>
                    <Text style={[styles.txAmount, { color: tx.status === 'Cleared' ? colors.green : colors.primary }]}>
                      +LKR {tx.amount.toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  topBar: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  balanceCard: {
    backgroundColor: colors.teal,
    marginHorizontal: 24,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  balanceValue: { fontSize: 36, fontWeight: '800', color: colors.white, marginBottom: 16 },
  withdrawBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  withdrawBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
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
  statValue: { fontSize: 14, fontWeight: '800', color: colors.dark },
  periodTabs: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: colors.lightGray,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  periodTabActive: { backgroundColor: colors.white },
  periodTabText: { fontSize: 14, fontWeight: '600', color: colors.gray },
  periodTabTextActive: { color: colors.teal, fontWeight: '700' },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  txCard: {
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
  txLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  txDot: { width: 8, height: 8, borderRadius: 4 },
  txJob: { fontSize: 14, fontWeight: '600', color: colors.dark },
  txDate: { fontSize: 12, color: colors.gray, marginTop: 2 },
  txRight: {},
  txAmount: { fontSize: 15, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.gray },
})
