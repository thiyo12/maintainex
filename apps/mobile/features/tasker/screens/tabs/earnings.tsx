import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { earnings } from '@/api/payments'

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

interface CommissionRecovery {
  id: string
  amount: number
  currency: string
  method: string
  sourceJobId?: string | null
  originalCashJobId: string
  createdAt: string
}

interface MaintainEXBalance {
  commissionDue: number
  commissionDueMinor: string
  adjustmentDue: number
  adjustmentDueMinor: string
  totalLiability: number
  totalLiabilityMinor: string
  status: string
  cashJobsAllowed: boolean
  onlineJobsAllowed: boolean
  manualReviewRequired: boolean
  oldestCommissionDueAt?: string | null
  currency: string
}

interface EarningsData {
  currency: string
  balance: number
  totalEarned: number
  totalJobs: number
  pendingAmount?: number
  transactions: { job: string; amount: number; date: string; status: string }[]
  pendingCommissionPayments?: CommissionPayment[]
  recentCommissionRecoveries?: CommissionRecovery[]
  maintainexBalance?: MaintainEXBalance
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

  const displayCurrency = data?.currency || data?.maintainexBalance?.currency || 'LKR'

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
            <Text style={styles.balanceValue}>{displayCurrency} {(data?.balance || 0).toLocaleString()}</Text>
            <TouchableOpacity style={styles.withdrawBtn}>
              <Text style={styles.withdrawBtnText}>{t('wallet.withdraw')}</Text>
            </TouchableOpacity>
          </View>

          {data?.maintainexBalance && (
            <View style={styles.maintainexCard}>
              <View style={styles.maintainexHeader}>
                <View>
                  <Text style={styles.maintainexTitle}>MaintainEX Balance</Text>
                  <Text style={styles.maintainexStatus}>
                    {data.maintainexBalance.status.replaceAll('_', ' ')}
                  </Text>
                </View>
                <Ionicons
                  name={data.maintainexBalance.totalLiability > 0 ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                  size={26}
                  color={data.maintainexBalance.totalLiability > 0 ? colors.amber : colors.success}
                />
              </View>

              <Text style={styles.maintainexDueLabel}>Commission due</Text>
              <Text style={styles.maintainexDueValue}>
                {data.maintainexBalance.currency} {data.maintainexBalance.commissionDue.toLocaleString()}
              </Text>
              {data.maintainexBalance.adjustmentDue > 0 && (
                <>
                  <Text style={styles.maintainexDueLabel}>Post-payment adjustment due</Text>
                  <Text style={[styles.maintainexDueValue, { color: colors.error }]}>
                    {data.maintainexBalance.currency} {data.maintainexBalance.adjustmentDue.toLocaleString()}
                  </Text>
                </>
              )}

              <View style={styles.maintainexRuleRow}>
                <Text style={styles.maintainexRuleLabel}>Cash jobs</Text>
                <Text style={[
                  styles.maintainexRuleValue,
                  { color: data.maintainexBalance.cashJobsAllowed ? colors.success : colors.error },
                ]}>
                  {data.maintainexBalance.cashJobsAllowed ? 'Allowed' : 'Temporarily blocked'}
                </Text>
              </View>
              <View style={styles.maintainexRuleRow}>
                <Text style={styles.maintainexRuleLabel}>Online jobs</Text>
                <Text style={[
                  styles.maintainexRuleValue,
                  { color: data.maintainexBalance.onlineJobsAllowed ? colors.success : colors.error },
                ]}>
                  {data.maintainexBalance.onlineJobsAllowed ? 'Allowed' : 'Restricted'}
                </Text>
              </View>

              {!data.maintainexBalance.cashJobsAllowed && data.maintainexBalance.onlineJobsAllowed && (
                <Text style={styles.maintainexHelp}>
                  Online-paid jobs remain available so outstanding commission can be recovered safely from future earnings.
                </Text>
              )}
              {data.maintainexBalance.manualReviewRequired && (
                <Text style={styles.maintainexWarning}>
                  Your financial standing requires MaintainEX review.
                </Text>
              )}
            </View>
          )}

          {(data?.recentCommissionRecoveries || []).length > 0 && (
            <View style={styles.recoverySection}>
              <Text style={styles.recoveryTitle}>Recent commission settlements</Text>
              <Text style={styles.recoveryHelp}>
                Online offsets and confirmed direct payments reduce older cash-job commission due.
              </Text>
              {data?.recentCommissionRecoveries?.slice(0, 5).map((recovery) => (
                <View key={recovery.id} style={styles.recoveryCard}>
                  <View style={styles.recoveryIcon}>
                    <Ionicons name="swap-horizontal-outline" size={18} color={colors.success} />
                  </View>
                  <View style={styles.recoveryBody}>
                    <Text style={styles.recoveryAmount}>
                      {recovery.currency} {recovery.amount.toLocaleString()} {recovery.method === 'ONLINE_EARNINGS' ? 'recovered from online earnings' : 'direct payment confirmed'}
                    </Text>
                    <Text style={styles.recoveryMeta}>
                      {recovery.method === 'ONLINE_EARNINGS'
                        ? `Online job ${recovery.sourceJobId?.slice(0, 8) || '—'} → cash job ${recovery.originalCashJobId.slice(0, 8)}`
                        : `Cash job ${recovery.originalCashJobId.slice(0, 8)}`}
                    </Text>
                    <Text style={styles.recoveryMeta}>
                      {new Date(recovery.createdAt).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {(data?.pendingCommissionPayments || []).length > 0 && (
            <View style={styles.commissionSection}>
              <Text style={styles.commissionTitle}>Pending Commission Payments</Text>
              {data?.pendingCommissionPayments?.map((cp) => (
                <View key={cp.id} style={styles.commissionCard}>
                  <View style={styles.commissionHeader}>
                    <Ionicons name="cash-outline" size={20} color={colors.amber} />
                    <Text style={styles.commissionRef}>{cp.referenceNumber}</Text>
                  </View>
                  <Text style={styles.commissionAmount}>{displayCurrency} {cp.amountDue.toLocaleString()}</Text>
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
              <Text style={styles.statValue}>{displayCurrency} {(data?.totalEarned || 0).toLocaleString()}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>{t('tasker.pending')}</Text>
              <Text style={styles.statValue}>{displayCurrency} {(data?.pendingAmount || 0).toLocaleString()}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>{t('tasker.totalEarned')}</Text>
              <Text style={styles.statValue}>{displayCurrency} {(data?.totalEarned || 0).toLocaleString()}</Text>
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
                      +{displayCurrency} {tx.amount.toLocaleString()}
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
  topBar: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
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
  maintainexCard: {
    backgroundColor: colors.white,
    marginHorizontal: 24,
    padding: 18,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  maintainexHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  maintainexTitle: { fontSize: 17, fontFamily: fonts.heading, color: colors.ink },
  maintainexStatus: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.muted, marginTop: 2 },
  maintainexDueLabel: { fontSize: 12, fontFamily: fonts.body, color: colors.muted },
  maintainexDueValue: { fontSize: 26, fontFamily: fonts.heading, color: colors.ink, marginTop: 2, marginBottom: 14 },
  maintainexRuleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  maintainexRuleLabel: { fontSize: 13, fontFamily: fonts.body, color: colors.muted },
  maintainexRuleValue: { fontSize: 13, fontFamily: fonts.bodyMedium },
  maintainexHelp: { fontSize: 12, fontFamily: fonts.body, color: colors.muted, lineHeight: 18, marginTop: 10 },
  maintainexWarning: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.error, lineHeight: 18, marginTop: 8 },
  recoverySection: {
    marginHorizontal: 24,
    marginBottom: 16,
  },
  recoveryTitle: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    marginBottom: 4,
  },
  recoveryHelp: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: 10,
  },
  recoveryCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recoveryIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  recoveryBody: { flex: 1 },
  recoveryAmount: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.success,
  },
  recoveryMeta: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: colors.muted,
    marginTop: 2,
  },
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
