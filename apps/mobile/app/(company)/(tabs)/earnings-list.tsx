import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Money } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { company } from '../../../lib/api'

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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={'#F5A623'} />
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
        <Text style={styles.revenueValue}>LKR {Number(totalRevenue).toLocaleString()}</Text>
        <Text style={styles.revenuePeriod}>{t('company.thisPeriod', { period })}</Text>
        <View style={styles.revenueChange}>
          <Text style={styles.changeText}>↑ {revenueChange}% {t('company.fromLast', { period })}</Text>
        </View>
      </View>

      {(earnings?.pendingCommissionPayments || []).length > 0 && (
        <View style={styles.commissionSection}>
          <Text style={styles.commissionTitle}>Pending Commission Payments</Text>
          {earnings?.pendingCommissionPayments?.map((cp: any) => (
            <View key={cp.id} style={styles.commissionCard}>
              <View style={styles.commissionHeader}>
                <Money size={20} color={'#F5A623'} />
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
          <Text style={styles.statLabel}>{t('wallet.pending')}</Text>
          <Text style={styles.statValue}>LKR {Number(pendingAmount).toLocaleString()}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t('wallet.withdraw')}</Text>
          <Text style={styles.statValue}>LKR {Number(paidOut).toLocaleString()}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t('tasker.earnings')}</Text>
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
                  <View style={[styles.payoutDot, { backgroundColor: isPaid ? '#06C167' : '#F5A623' }]} />
                  <View style={styles.payoutInfo}>
                    <Text style={styles.payoutContract} numberOfLines={1}>{p.contract || p.title}</Text>
                    <Text style={styles.payoutDate}>{p.date || (p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '')}</Text>
                  </View>
                </View>
                <View style={styles.payoutRight}>
                  <Text style={[styles.payoutAmount, { color: isPaid ? '#06C167' : '#F5A623' }]}>
                    LKR {Number(p.amount).toLocaleString()}
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
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  topBar: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  heading: { fontSize: 28, fontFamily: fonts.heading, color: '#FFFFFF' },
  revenueCard: {
    backgroundColor: '#F5A623',
    marginHorizontal: 24,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  revenueLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  revenueValue: { fontSize: 34, fontFamily: 'Outfit_900Black', color: '#FFFFFF', marginBottom: 4 },
  revenuePeriod: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 12 },
  revenueChange: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  changeText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: '#FFFFFF' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statLabel: { fontSize: 11, color: '#6F6B6B', marginBottom: 4 },
  statValue: { fontSize: 13, fontFamily: 'Outfit_900Black', color: '#FFFFFF' },
  periodTabs: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: '#2E2E2E',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  periodTab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  periodTabActive: { backgroundColor: '#FFFFFF' },
  periodTabText: { fontSize: 14, fontFamily: fonts.bodySemiBold, color: '#6F6B6B' },
  periodTabTextActive: { color: '#F5A623', fontFamily: fonts.bodyMedium },
  payoutTitle: {
    fontSize: 16, fontFamily: fonts.bodyMedium, color: '#FFFFFF',
    paddingHorizontal: 24, marginBottom: 10,
  },
  payoutCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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
  payoutContract: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: '#FFFFFF' },
  payoutDate: { fontSize: 11, color: '#6F6B6B', marginTop: 2 },
  payoutRight: { alignItems: 'flex-end' },
  payoutAmount: { fontSize: 14, fontFamily: fonts.bodyMedium },
  payoutStatus: { fontSize: 11, color: '#6F6B6B', marginTop: 2 },
  emptyText: { textAlign: 'center', color: '#6F6B6B', marginTop: 20, fontSize: 14 },
  commissionSection: {
    marginHorizontal: 24,
    marginBottom: 16,
  },
  commissionTitle: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: '#FFFFFF',
    marginBottom: 10,
  },
  commissionCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F5A623',
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
    fontFamily: 'Outfit_900Black',
    color: '#F5A623',
  },
  commissionAmount: {
    fontSize: 20,
    fontFamily: 'Outfit_900Black',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  commissionInstruction: {
    fontSize: 13,
    color: '#6F6B6B',
    marginBottom: 4,
  },
  commissionWeek: {
    fontSize: 12,
    color: '#6F6B6B',
  },
})
