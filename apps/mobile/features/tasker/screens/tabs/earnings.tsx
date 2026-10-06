import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CaretLeft } from 'phosphor-react-native'
import { useRouter } from 'expo-router'
import { earnings } from '@/api/payments'
import { fonts } from '@/lib/fonts'
import { v3 } from '@/theme/v3/tokens'

interface CommissionPayment {
  id: string
  referenceNumber: string
  amountDue: number
  method: string
  weekStart: string
  weekEnd: string
  dueAt: string
}

interface EarningsTransaction {
  job: string
  amount: number
  date: string
  status: string
  createdAt?: string
}

interface EarningsData {
  balance?: number
  availableBalance?: number
  totalEarned?: number
  totalJobs?: number
  pendingAmount?: number
  transactions?: EarningsTransaction[]
  pendingCommissionPayments?: CommissionPayment[]
}

function parseTxDate(tx: EarningsTransaction) {
  const raw = tx.createdAt || tx.date
  const value = raw ? new Date(raw).getTime() : NaN
  return Number.isFinite(value) ? value : null
}

function relativeLabel(tx: EarningsTransaction) {
  const timestamp = parseTxDate(tx)
  if (timestamp == null) return tx.date || ''
  const d = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function TaskerEarnings() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState<EarningsData | null>(null)

  const loadEarnings = useCallback(async () => {
    try {
      const res = await earnings.get()
      setData(res)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadEarnings()
  }, [loadEarnings])

  const transactions = data?.transactions || []
  const availableBalance = Number(data?.balance ?? data?.availableBalance ?? 0)

  const weekly = useMemo(() => {
    const now = new Date()
    const start = new Date(now)
    const day = start.getDay()
    const offset = day === 0 ? 6 : day - 1
    start.setDate(start.getDate() - offset)
    start.setHours(0, 0, 0, 0)

    const inWeek = transactions.filter((tx) => {
      const timestamp = parseTxDate(tx)
      return timestamp != null && timestamp >= start.getTime()
    })

    if (inWeek.length > 0) {
      return {
        amount: inWeek.reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
        count: inWeek.length,
      }
    }

    return { amount: 0, count: 0 }
  }, [transactions])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.72}
          onPress={() => {
            if (router.canGoBack()) router.back()
            else router.replace('/(tasker)/(tabs)/index' as any)
          }}
        >
          <CaretLeft size={18} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Earnings</Text>
        <View style={styles.topSpacer} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={v3.colors.ink} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadEarnings() }} tintColor={v3.colors.ink} />}
        >
          <View style={styles.balanceRow}>
            <View style={styles.balanceCopy}>
              <Text style={styles.balanceValue}>LKR {availableBalance.toLocaleString()}</Text>
              <Text style={styles.balanceLabel}>Available balance</Text>
            </View>
            <TouchableOpacity
              style={styles.withdrawButton}
              activeOpacity={0.78}
              onPress={() => router.push('/(tasker)/wallet/withdraw' as any)}
            >
              <Text style={styles.withdrawText}>Withdraw</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekCard}>
            <Text style={styles.weekLabel}>THIS WEEK</Text>
            <Text style={styles.weekValue}>LKR {weekly.amount.toLocaleString()}</Text>
            <Text style={styles.weekMeta}>{weekly.count} {weekly.count === 1 ? 'job' : 'jobs'} · current week</Text>
          </View>

          <Text style={styles.sectionTitle}>Recent earnings</Text>

          {transactions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No earnings yet</Text>
              <Text style={styles.emptyText}>Completed and cleared jobs will appear here.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {transactions.slice(0, 10).map((tx, index) => (
                <View key={String(index) + '-' + tx.job} style={styles.txRow}>
                  <View style={styles.txCopy}>
                    <Text style={styles.txTitle} numberOfLines={1}>{tx.job || 'MaintainEX job'}</Text>
                    <Text style={styles.txDate}>{relativeLabel(tx)}</Text>
                  </View>
                  <Text style={styles.txAmount}>+ LKR {Number(tx.amount || 0).toLocaleString()}</Text>
                </View>
              ))}
            </View>
          )}

          {(data?.pendingCommissionPayments || []).length > 0 ? (
            <View style={styles.commissionSection}>
              <Text style={styles.sectionTitle}>Commission due</Text>
              {(data?.pendingCommissionPayments || []).map((payment) => (
                <View key={payment.id} style={styles.commissionRow}>
                  <View style={styles.txCopy}>
                    <Text style={styles.txTitle}>{payment.referenceNumber}</Text>
                    <Text style={styles.txDate}>Payment reference · {payment.method}</Text>
                  </View>
                  <Text style={styles.commissionAmount}>LKR {Number(payment.amountDue || 0).toLocaleString()}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  topBar: {
    height: 68,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    marginLeft: 10,
    fontSize: 17,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  topSpacer: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: 24,
    paddingTop: 5,
    paddingBottom: 32,
  },
  balanceRow: {
    minHeight: 94,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceCopy: { flex: 1, paddingRight: 14 },
  balanceValue: {
    fontSize: 32,
    lineHeight: 38,
    fontFamily: fonts.heading,
    color: v3.colors.ink,
    letterSpacing: -0.5,
  },
  balanceLabel: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: '#5B5B5B',
  },
  withdrawButton: {
    minWidth: 108,
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 15,
    backgroundColor: v3.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  withdrawText: {
    fontSize: 14,
    fontFamily: fonts.headingBold,
    color: v3.colors.paper,
  },
  weekCard: {
    marginTop: 19,
    height: 116,
    borderRadius: 18,
    backgroundColor: v3.colors.ink,
    paddingHorizontal: 18,
    paddingVertical: 17,
  },
  weekLabel: {
    fontSize: 9,
    fontFamily: fonts.headingBold,
    color: v3.colors.amber,
  },
  weekValue: {
    marginTop: 10,
    fontSize: 22,
    lineHeight: 27,
    fontFamily: fonts.heading,
    color: v3.colors.paper,
  },
  weekMeta: {
    marginTop: 7,
    fontSize: 10,
    fontFamily: fonts.bodySemiBold,
    color: '#CFCFCF',
  },
  sectionTitle: {
    marginTop: 36,
    marginBottom: 10,
    fontSize: 13,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  list: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
  },
  txRow: {
    minHeight: 70,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: v3.colors.line,
  },
  txCopy: { flex: 1, paddingRight: 12 },
  txTitle: {
    fontSize: 12.5,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  txDate: {
    marginTop: 3,
    fontSize: 9.5,
    fontFamily: fonts.bodySemiBold,
    color: v3.colors.textMuted,
  },
  txAmount: {
    fontSize: 12.5,
    fontFamily: fonts.headingBold,
    color: v3.colors.success,
  },
  emptyCard: {
    minHeight: 110,
    borderRadius: 16,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    padding: 18,
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 12.5,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  emptyText: {
    marginTop: 4,
    fontSize: 10,
    fontFamily: fonts.body,
    color: v3.colors.textMuted,
  },
  commissionSection: {
    marginTop: 2,
  },
  commissionRow: {
    minHeight: 64,
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
  },
  commissionAmount: {
    fontSize: 11.5,
    fontFamily: fonts.headingBold,
    color: v3.colors.amberDark,
  },
})
