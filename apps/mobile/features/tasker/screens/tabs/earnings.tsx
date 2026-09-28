import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { earnings } from '@/lib/api'

type Period = 'weekly' | 'monthly' | 'yearly'

interface CommissionPayment {
  id: string
  referenceNumber: string
  amountDue: number
  method: string
  weekStart: string
  weekEnd: string
  dueAt: string
}

interface EarningsData {
  balance: number
  totalEarned: number
  totalJobs: number
  pendingAmount?: number
  transactions: { job: string; amount: number; date: string; status: string }[]
  pendingCommissionPayments?: CommissionPayment[]
}

export default function TaskerEarnings() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const [period, setPeriod] = useState<Period>('weekly')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState<EarningsData | null>(null)

  const loadEarnings = useCallback(async () => {
    try {
      const res = await earnings.get()
      setData(res)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadEarnings()
  }, [loadEarnings])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>{t('tasker.earnings')}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.amber} />
        </View>
      ) : (
        <>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>{t('wallet.available')}</Text>
            <Text style={styles.balanceValue}>LKR {(data?.balance || 0).toLocaleString()}</Text>
            <TouchableOpacity style={styles.withdrawBtn}>
              <Text style={styles.withdrawBtnText}>{t('wallet.withdraw')}</Text>
            </TouchableOpacity>
          </View>

          {(data?.pendingCommissionPayments || []).length > 0 && (
            <View style={styles.commissionSection}>
              <Text style={styles.commissionTitle}>Pending Commission Payments</Text>
              {data?.pendingCommissionPayments?.map((cp) => (
                <View key={cp.id} style={styles.commissionCard}>
                  <View style={styles.commissionHeader}>
                    <Ionicons name="cash-outline" size={20} color={colors.amber} />
                    <Text style={styles.commissionRef}>{cp.referenceNumber}</Text>
                  </View>
                  <Text style={styles.commissionAmount}>LKR {cp.amountDue.toLocaleString()}</Text>
                  <Text style={styles.commissionInstruction}>
                    Pay this amount to any MΛINTΛINEX agent using reference: {cp.referenceNumber}
                  </Text>
                  <Text style={styles.commissionWeek}>
                    Week: {new Date(cp.weekStart).toLocaleDateString()} - {new Date(cp.weekEnd).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>{t('tasker.totalEarned')}</Text>
              <Text style={styles.statValue}>LKR {(data?.totalEarned || 0).toLocaleString()}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>{t('tasker.pending')}</Text>
              <Text style={styles.statValue}>LKR {(data?.pendingAmount || 0).toLocaleString()}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>{t('tasker.totalEarned')}</Text>
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
                  {p === 'weekly' ? t('wallet.periodWeekly') : p === 'monthly' ? t('wallet.periodMonthly') : t('wallet.periodYearly')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadEarnings} tintColor={colors.amber} />}
          >
            <Text style={styles.transactionTitle}>{t('wallet.transactions')}</Text>
            {(data?.transactions || []).length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="cash-outline" size={48} color={colors.border} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>{t('wallet.noTransactions')}</Text>
              </View>
            ) : (
              (data?.transactions || []).map((tx, i) => (
                <View key={i} style={styles.txCard}>
                  <View style={styles.txLeft}>
                    <View style={[styles.txDot, { backgroundColor: tx.status === t('wallet.statusCleared') ? colors.success : colors.amber }]} />
                    <View>
                      <Text style={styles.txJob}>{tx.job}</Text>
                      <Text style={styles.txDate}>{tx.date} • {tx.status === 'Cleared' ? t('wallet.statusCleared') : tx.status}</Text>
                    </View>
                  </View>
                  <View style={styles.txRight}>
                    <Text style={[styles.txAmount, { color: tx.status === t('wallet.statusCleared') ? colors.success : colors.amber }]}>
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

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  heading: { fontSize: 28, fontFamily: fonts.heading, color: colors.ink },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  balanceCard: {
    backgroundColor: colors.amber,
    marginHorizontal: 24,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: { fontSize: 14, fontFamily: fonts.body, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  balanceValue: { fontSize: 36, fontFamily: fonts.heading, color: colors.white, marginBottom: 16 },
  withdrawBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 100,
  },
  withdrawBtnText: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.white },
  statsRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statLabel: { fontSize: 11, fontFamily: fonts.body, color: colors.muted, marginBottom: 4 },
  statValue: { fontSize: 14, fontFamily: fonts.heading, color: colors.ink },
  periodTabs: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: colors.border,
    borderRadius: 100,
    padding: 4,
    marginBottom: 16,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 100,
    alignItems: 'center',
  },
  periodTabActive: { backgroundColor: colors.white },
  periodTabText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.muted },
  periodTabTextActive: { color: colors.amber, fontFamily: fonts.bodyMedium },
  transactionTitle: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
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
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  txLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  txDot: { width: 8, height: 8, borderRadius: 4 },
  txJob: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.ink },
  txDate: { fontSize: 12, fontFamily: fonts.body, color: colors.muted, marginTop: 2 },
  txRight: {},
  txAmount: { fontSize: 15, fontFamily: fonts.bodyMedium },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyTitle: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.muted },
  commissionSection: {
    marginHorizontal: 24,
    marginBottom: 16,
  },
  commissionTitle: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    marginBottom: 10,
  },
  commissionCard: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.amber,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  commissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  commissionRef: {
    fontSize: 16,
    fontFamily: fonts.heading,
    color: colors.amber,
  },
  commissionAmount: {
    fontSize: 20,
    fontFamily: fonts.heading,
    color: colors.ink,
    marginBottom: 8,
  },
  commissionInstruction: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.muted,
    marginBottom: 4,
  },
  commissionWeek: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.muted,
  },
})
