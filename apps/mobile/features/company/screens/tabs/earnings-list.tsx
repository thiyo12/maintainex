import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '@/lib/ThemeContext'
import { company } from '@/api/companies'

type Period = 'monthly' | 'quarterly' | 'yearly'

export default function CompanyEarnings() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
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
  const displayCurrency = earnings?.currency || earnings?.maintainexBalance?.currency || 'LKR'

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.amber} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>{t('company.earnings')}</Text>
      </View>

      <View style={styles.revenueCard}>
        <Text style={styles.revenueLabel}>{t('tasker.totalEarned')}</Text>
        <Text style={styles.revenueValue}>{displayCurrency} {Number(totalRevenue).toLocaleString()}</Text>
        <Text style={styles.revenuePeriod}>{t('company.thisPeriod', { period })}</Text>
        <View style={styles.revenueChange}>
          <Text style={styles.changeText}>↑ {revenueChange}% {t('company.fromLast', { period })}</Text>
        </View>
      </View>

      {earnings?.maintainexBalance && (
        <View style={styles.maintainexCard}>
          <View style={styles.maintainexHeader}>
            <View>
              <Text style={styles.maintainexTitle}>Company MaintainEX Balance</Text>
              <Text style={styles.maintainexStatus}>
                {String(earnings.maintainexBalance.status || 'CLEAR').replaceAll('_', ' ')}
              </Text>
            </View>
            <Ionicons
              name={Number(earnings.maintainexBalance.totalLiability || 0) > 0 ? 'alert-circle-outline' : 'checkmark-circle-outline'}
              size={26}
              color={Number(earnings.maintainexBalance.totalLiability || 0) > 0 ? colors.amber : colors.success}
            />
          </View>

          <Text style={styles.maintainexDueLabel}>Commission due</Text>
          <Text style={styles.maintainexDueValue}>
            {earnings.maintainexBalance.currency || 'LKR'} {Number(earnings.maintainexBalance.commissionDue || 0).toLocaleString()}
          </Text>
          {Number(earnings.maintainexBalance.adjustmentDue || 0) > 0 && (
            <>
              <Text style={styles.maintainexDueLabel}>Post-payment adjustment due</Text>
              <Text style={[styles.maintainexDueValue, { color: colors.error }]}>
                {earnings.maintainexBalance.currency || 'LKR'} {Number(earnings.maintainexBalance.adjustmentDue || 0).toLocaleString()}
              </Text>
            </>
          )}

          <View style={styles.maintainexRuleRow}>
            <Text style={styles.maintainexRuleLabel}>Cash jobs</Text>
            <Text style={[
              styles.maintainexRuleValue,
              { color: earnings.maintainexBalance.cashJobsAllowed ? colors.success : colors.error },
            ]}>
              {earnings.maintainexBalance.cashJobsAllowed ? 'Allowed' : 'Temporarily blocked'}
            </Text>
          </View>
          <View style={styles.maintainexRuleRow}>
            <Text style={styles.maintainexRuleLabel}>Online jobs</Text>
            <Text style={[
              styles.maintainexRuleValue,
              { color: earnings.maintainexBalance.onlineJobsAllowed ? colors.success : colors.error },
            ]}>
              {earnings.maintainexBalance.onlineJobsAllowed ? 'Allowed' : 'Restricted'}
            </Text>
          </View>

          {!earnings.maintainexBalance.cashJobsAllowed && earnings.maintainexBalance.onlineJobsAllowed && (
            <Text style={styles.maintainexHelp}>
              Online-paid jobs remain available so company commission debt can be recovered from future earnings.
            </Text>
          )}
          {earnings.maintainexBalance.manualReviewRequired && (
            <Text style={styles.maintainexWarning}>
              This company account requires MaintainEX finance review.
            </Text>
          )}
        </View>
      )}

      {(earnings?.recentCommissionRecoveries || []).length > 0 && (
        <View style={styles.recoverySection}>
          <Text style={styles.recoveryTitle}>Recent commission settlements</Text>
          <Text style={styles.recoveryHelp}>
            Online offsets and confirmed direct payments reduce older company cash-job commission.
          </Text>
          {earnings.recentCommissionRecoveries.slice(0, 5).map((recovery: any) => (
            <View key={recovery.id} style={styles.recoveryCard}>
              <View style={styles.recoveryIcon}>
                <Ionicons name="swap-horizontal-outline" size={18} color={colors.success} />
              </View>
              <View style={styles.recoveryBody}>
                <Text style={styles.recoveryAmount}>
                  {recovery.currency} {Number(recovery.amount || 0).toLocaleString()} {recovery.method === 'ONLINE_EARNINGS' ? 'recovered from online earnings' : 'direct payment confirmed'}
                </Text>
                <Text style={styles.recoveryMeta}>
                  {recovery.method === 'ONLINE_EARNINGS'
                    ? `Online job ${recovery.sourceJobId?.slice(0, 8) || '—'} → cash job ${String(recovery.originalCashJobId || '').slice(0, 8)}`
                    : `Cash job ${String(recovery.originalCashJobId || '').slice(0, 8)}`}
                </Text>
                <Text style={styles.recoveryMeta}>
                  {new Date(recovery.createdAt).toLocaleString()}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {(earnings?.pendingCommissionPayments || []).length > 0 && (
        <View style={styles.commissionSection}>
          <Text style={styles.commissionTitle}>Pending Commission Payments</Text>
          {earnings?.pendingCommissionPayments?.map((cp: any) => (
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
          <Text style={styles.statLabel}>{t('wallet.pending')}</Text>
          <Text style={styles.statValue}>{displayCurrency} {Number(pendingAmount).toLocaleString()}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t('wallet.withdraw')}</Text>
          <Text style={styles.statValue}>{displayCurrency} {Number(paidOut).toLocaleString()}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t('tasker.earnings')}</Text>
          <Text style={styles.statValue}>{displayCurrency} {Number(avgPerJob).toLocaleString()}</Text>
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
        <Text style={styles.payoutTitle}>{t('wallet.transactions')}</Text>
        {payouts.length === 0 ? (
          <Text style={styles.emptyText}>{t('wallet.noTransactions')}</Text>
        ) : (
          payouts.map((p, i) => {
            const status = p.status || (p.paid ? 'Paid' : 'Pending')
            const isPaid = status === 'Paid' || status === 'paid'
            const statusLabel = isPaid ? t('common.success') : t('common.pending')
            return (
              <View key={p.id || i} style={styles.payoutCard}>
                <View style={styles.payoutLeft}>
                  <View style={[styles.payoutDot, { backgroundColor: isPaid ? colors.success : colors.amber }]} />
                  <View style={styles.payoutInfo}>
                    <Text style={styles.payoutContract} numberOfLines={1}>{p.contract || p.title}</Text>
                    <Text style={styles.payoutDate}>{p.date || (p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '')}</Text>
                  </View>
                </View>
                <View style={styles.payoutRight}>
                  <Text style={[styles.payoutAmount, { color: isPaid ? colors.success : colors.amber }]}>
                    {p.currency || displayCurrency} {Number(p.amount).toLocaleString()}
                  </Text>
                  <Text style={styles.payoutStatus}>{statusLabel}</Text>
                </View>
              </View>
            )
          })
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  topBar: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  heading: { fontSize: 28, fontWeight: '800', color: colors.ink },
  revenueCard: {
    backgroundColor: colors.amber,
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
  maintainexTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  maintainexStatus: { fontSize: 12, fontWeight: '600', color: colors.muted, marginTop: 2 },
  maintainexDueLabel: { fontSize: 12, color: colors.muted },
  maintainexDueValue: { fontSize: 26, fontWeight: '800', color: colors.ink, marginTop: 2, marginBottom: 14 },
  maintainexRuleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  maintainexRuleLabel: { fontSize: 13, color: colors.muted },
  maintainexRuleValue: { fontSize: 13, fontWeight: '700' },
  maintainexHelp: { fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 10 },
  maintainexWarning: { fontSize: 12, fontWeight: '700', color: colors.error, lineHeight: 18, marginTop: 8 },
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
  statLabel: { fontSize: 11, color: colors.muted, marginBottom: 4 },
  statValue: { fontSize: 13, fontWeight: '800', color: colors.ink },
  periodTabs: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: colors.border,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  periodTab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  periodTabActive: { backgroundColor: colors.white },
  periodTabText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  periodTabTextActive: { color: colors.amber, fontWeight: '700' },
  payoutTitle: {
    fontSize: 16, fontWeight: '700', color: colors.ink,
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
  payoutContract: { fontSize: 13, fontWeight: '600', color: colors.ink },
  payoutDate: { fontSize: 11, color: colors.muted, marginTop: 2 },
  payoutRight: { alignItems: 'flex-end' },
  payoutAmount: { fontSize: 14, fontWeight: '700' },
  payoutStatus: { fontSize: 11, color: colors.muted, marginTop: 2 },
  emptyText: { textAlign: 'center', color: colors.muted, marginTop: 20, fontSize: 14 },
  recoverySection: {
    marginHorizontal: 24,
    marginBottom: 16,
  },
  recoveryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  recoveryHelp: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: 10,
  },
  recoveryCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 12,
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
    fontWeight: '700',
    color: colors.success,
  },
  recoveryMeta: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  commissionSection: {
    marginHorizontal: 24,
    marginBottom: 16,
  },
  commissionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 10,
  },
  commissionCard: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
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
    fontWeight: '800',
    color: colors.amber,
  },
  commissionAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 8,
  },
  commissionInstruction: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 4,
  },
  commissionWeek: {
    fontSize: 12,
    color: colors.muted,
  },
})
