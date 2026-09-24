import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CalendarBlank, ShieldCheck, Wallet } from 'phosphor-react-native'
import { company } from '../../../lib/api'
import { v3 } from '../../../theme/v3/tokens'

type WeeklyStatement = {
  weekStart: string
  weekEnd: string
  jobs: number
  grossAmount: number
  commissionRate: number
  commissionWithheld: number
  netPayout: number
  currency: string
  amountDue: number
  reconciliationStatus: string
}

export default function CompanyEarnings() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await company.earnings.get('monthly'))
    } catch {
      setData(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}><ActivityIndicator color={v3.colors.ink} /></View>
      </SafeAreaView>
    )
  }

  const statements: WeeklyStatement[] = data?.weeklyCommissionStatements || []
  const gross = Number(data?.marketplaceRevenue || 0)
  const commission = Number(data?.marketplaceCommissionWithheld || 0)
  const net = Number(data?.marketplaceNetPayout || 0)
  const rate = Number(data?.commissionRate ?? 10)
  const currency = String(data?.currency || 'LKR')

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>COMPANY FINANCE</Text>
          <Text style={styles.title}>Earnings</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}><Wallet size={22} color={v3.colors.ink} weight="fill" /></View>
          <Text style={styles.heroLabel}>NET MARKETPLACE PAYOUT</Text>
          <Text style={styles.heroValue}>{currency} {net.toLocaleString()}</Text>
          <Text style={styles.heroText}>
            MaintainEX withholds the {rate}% company commission automatically when each completed job is released.
          </Text>
        </View>

        <View style={styles.metrics}>
          <Metric label="GROSS JOB VALUE" value={`${currency} ${gross.toLocaleString()}`} />
          <Metric label="COMMISSION WITHHELD" value={`${currency} ${commission.toLocaleString()}`} />
        </View>

        <View style={styles.policyCard}>
          <ShieldCheck size={20} color={v3.colors.success} weight="fill" />
          <View style={styles.policyCopy}>
            <Text style={styles.policyTitle}>No second weekly charge</Text>
            <Text style={styles.policyText}>
              Commission is already deducted per completed job. Weekly statements below are reconciliation records only.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Weekly statements</Text>

        {statements.length ? statements.map((statement) => (
          <View key={statement.weekStart} style={styles.statement}>
            <View style={styles.statementHeader}>
              <View style={styles.weekIcon}><CalendarBlank size={17} color={v3.colors.ink} weight="bold" /></View>
              <View style={styles.weekCopy}>
                <Text style={styles.weekTitle}>
                  {new Date(statement.weekStart).toLocaleDateString()} – {new Date(statement.weekEnd).toLocaleDateString()}
                </Text>
                <Text style={styles.weekMeta}>{statement.jobs} completed job{statement.jobs === 1 ? '' : 's'}</Text>
              </View>
              <View style={[
                styles.status,
                statement.reconciliationStatus === 'RECONCILED' ? styles.statusDone : styles.statusPending,
              ]}>
                <Text style={[
                  styles.statusText,
                  statement.reconciliationStatus === 'RECONCILED' ? styles.statusTextDone : styles.statusTextPending,
                ]}>
                  {statement.reconciliationStatus === 'RECONCILED' ? 'RECONCILED' : 'PENDING'}
                </Text>
              </View>
            </View>

            <View style={styles.line} />
            <MoneyRow label="Gross" value={statement.grossAmount} currency={statement.currency || currency} />
            <MoneyRow label={`MaintainEX commission (${statement.commissionRate}%)`} value={-statement.commissionWithheld} currency={statement.currency || currency} />
            <MoneyRow label="Net payout" value={statement.netPayout} currency={statement.currency || currency} strong last />
          </View>
        )) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No marketplace earnings yet</Text>
            <Text style={styles.emptyText}>Completed and released Company jobs will appear here by week.</Text>
          </View>
        )}

        <View style={{ height: 28 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  )
}

function MoneyRow({ label, value, currency, strong = false, last = false }: { label: string; value: number; currency: string; strong?: boolean; last?: boolean }) {
  const sign = value < 0 ? '−' : ''
  return (
    <View style={[styles.moneyRow, !last && styles.moneyBorder]}>
      <Text style={[styles.moneyLabel, strong && styles.moneyStrong]}>{label}</Text>
      <Text style={[styles.moneyValue, strong && styles.moneyValueStrong]}>
        {sign}{currency} {Math.abs(value).toLocaleString()}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingBottom: 20 },
  header: { paddingTop: 8, paddingBottom: 14 },
  eyebrow: { ...v3.typography.label, color: v3.colors.amberDark, letterSpacing: 1 },
  title: { ...v3.typography.h4, color: v3.colors.ink, marginTop: 2 },
  hero: { backgroundColor: v3.colors.ink, borderRadius: 24, padding: 18 },
  heroIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: v3.colors.amber, alignItems: 'center', justifyContent: 'center' },
  heroLabel: { ...v3.typography.smallBold, color: v3.colors.textLight, letterSpacing: 0.8, marginTop: 14 },
  heroValue: { ...v3.typography.h4, color: v3.colors.paper, marginTop: 3 },
  heroText: { ...v3.typography.caption, color: v3.colors.textLight, lineHeight: 17, marginTop: 7 },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 10 },
  metric: { flex: 1, backgroundColor: v3.colors.paper, borderRadius: 18, borderWidth: 1, borderColor: v3.colors.line, padding: 14 },
  metricLabel: { ...v3.typography.smallBold, color: v3.colors.textMuted, letterSpacing: 0.4 },
  metricValue: { ...v3.typography.bodyLarge, color: v3.colors.ink, marginTop: 5 },
  policyCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: v3.colors.successSoft, borderRadius: 18, padding: 14, marginTop: 10 },
  policyCopy: { flex: 1, marginLeft: 9 },
  policyTitle: { ...v3.typography.bodyBold, color: v3.colors.ink },
  policyText: { ...v3.typography.caption, color: v3.colors.textSecondary, lineHeight: 17, marginTop: 2 },
  sectionTitle: { ...v3.typography.title, color: v3.colors.ink, marginTop: 21, marginBottom: 9 },
  statement: { backgroundColor: v3.colors.paper, borderRadius: 19, borderWidth: 1, borderColor: v3.colors.line, padding: 14, marginBottom: 9 },
  statementHeader: { flexDirection: 'row', alignItems: 'center' },
  weekIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center' },
  weekCopy: { flex: 1, marginLeft: 9 },
  weekTitle: { ...v3.typography.bodyBold, color: v3.colors.ink },
  weekMeta: { ...v3.typography.small, color: v3.colors.textMuted, marginTop: 2 },
  status: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4 },
  statusDone: { backgroundColor: v3.colors.successSoft },
  statusPending: { backgroundColor: v3.colors.amberSoft },
  statusText: { ...v3.typography.smallBold },
  statusTextDone: { color: v3.colors.success },
  statusTextPending: { color: v3.colors.amberDark },
  line: { height: 1, backgroundColor: v3.colors.line, marginVertical: 12 },
  moneyRow: { minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moneyBorder: { borderBottomWidth: 1, borderBottomColor: v3.colors.line },
  moneyLabel: { ...v3.typography.caption, color: v3.colors.textSecondary },
  moneyStrong: { ...v3.typography.bodyBold, color: v3.colors.ink },
  moneyValue: { ...v3.typography.captionBold, color: v3.colors.ink },
  moneyValueStrong: { ...v3.typography.bodyLarge, color: v3.colors.success },
  empty: { backgroundColor: v3.colors.paper, borderRadius: 18, borderWidth: 1, borderColor: v3.colors.line, padding: 22, alignItems: 'center' },
  emptyTitle: { ...v3.typography.bodyLarge, color: v3.colors.ink },
  emptyText: { ...v3.typography.caption, color: v3.colors.textMuted, textAlign: 'center', lineHeight: 17, marginTop: 4 },
})
