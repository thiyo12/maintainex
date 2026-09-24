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
import { CheckCircle, Receipt, ShieldCheck } from 'phosphor-react-native'
import { company } from '../../../lib/api'
import { v3 } from '../../../theme/v3/tokens'

function money(value: unknown) {
  return `LKR ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export default function CompanyEarnings() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [earnings, setEarnings] = useState<any>(null)

  const load = useCallback(async () => {
    try {
      setEarnings(await company.earnings.get('monthly'))
    } catch {
      setEarnings(null)
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

  const statements = earnings?.weeklyCommissionStatements || []
  const rate = Number(earnings?.commissionRate ?? 10)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>COMPANY FINANCE</Text>
        <Text style={styles.title}>Earnings</Text>
        <Text style={styles.subtitle}>Commission is withheld automatically when each protected payment is released.</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
      >
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Net marketplace payout</Text>
          <Text style={styles.heroValue}>{money(earnings?.marketplaceNetPayout)}</Text>
          <View style={styles.heroBadge}>
            <ShieldCheck size={14} color={v3.colors.ink} weight="fill" />
            <Text style={styles.heroBadgeText}>{rate}% platform commission · withheld per completed job</Text>
          </View>
        </View>

        <View style={styles.stats}>
          <Stat label="Gross jobs" value={money(earnings?.marketplaceRevenue)} />
          <Stat label="Commission withheld" value={money(earnings?.marketplaceCommissionWithheld)} />
        </View>

        <View style={styles.safeCard}>
          <CheckCircle size={19} color={v3.colors.success} weight="fill" />
          <View style={styles.safeCopy}>
            <Text style={styles.safeTitle}>No second weekly commission payment</Text>
            <Text style={styles.safeText}>Weekly statements reconcile commission already withheld. Amount due is always zero unless a future, separately approved billing model is introduced.</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Weekly statements</Text>
        {statements.length === 0 ? (
          <View style={styles.empty}>
            <Receipt size={26} color={v3.colors.textMuted} />
            <Text style={styles.emptyTitle}>No marketplace settlements yet</Text>
            <Text style={styles.emptyText}>Completed paid jobs will appear here by week.</Text>
          </View>
        ) : statements.map((statement: any) => (
          <View key={statement.weekStart} style={styles.statement}>
            <View style={styles.statementTop}>
              <View>
                <Text style={styles.week}>
                  {new Date(statement.weekStart).toLocaleDateString()} – {new Date(statement.weekEnd).toLocaleDateString()}
                </Text>
                <Text style={styles.jobs}>{statement.jobs} completed job{statement.jobs === 1 ? '' : 's'}</Text>
              </View>
              <View style={[styles.status, statement.reconciliationStatus === 'RECONCILED' && styles.statusDone]}>
                <Text style={[styles.statusText, statement.reconciliationStatus === 'RECONCILED' && styles.statusTextDone]}>
                  {statement.reconciliationStatus === 'RECONCILED' ? 'RECONCILED' : 'PENDING CHECK'}
                </Text>
              </View>
            </View>

            <Row label="Gross" value={money(statement.grossAmount)} />
            <Row label={`Commission (${rate}%)`} value={`− ${money(statement.commissionWithheld)}`} />
            <Row label="Net payout" value={money(statement.netPayout)} strong />
            <View style={styles.dueRow}>
              <Text style={styles.dueLabel}>Additional amount due</Text>
              <Text style={styles.dueValue}>{money(statement.amountDue)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  )
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, strong && styles.rowStrong]}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowStrong]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  eyebrow: { ...v3.typography.smallBold, color: v3.colors.amberDark, letterSpacing: 0.8 },
  title: { ...v3.typography.h4, color: v3.colors.ink, marginTop: 2 },
  subtitle: { ...v3.typography.caption, color: v3.colors.textSecondary, lineHeight: 17, marginTop: 5, maxWidth: 340 },
  content: { paddingHorizontal: 18, paddingBottom: 38 },
  hero: { backgroundColor: v3.colors.ink, borderRadius: 23, padding: 19 },
  heroLabel: { ...v3.typography.caption, color: v3.colors.textLight },
  heroValue: { ...v3.typography.h4, color: v3.colors.paper, marginTop: 4 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, backgroundColor: v3.colors.amber, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginTop: 13 },
  heroBadgeText: { ...v3.typography.smallBold, color: v3.colors.ink },
  stats: { flexDirection: 'row', gap: 9, marginTop: 10 },
  stat: { flex: 1, backgroundColor: v3.colors.paper, borderRadius: 17, borderWidth: 1, borderColor: v3.colors.line, padding: 13 },
  statLabel: { ...v3.typography.small, color: v3.colors.textMuted },
  statValue: { ...v3.typography.bodyBold, color: v3.colors.ink, marginTop: 5 },
  safeCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: v3.colors.successSoft, borderRadius: 17, padding: 14, marginTop: 10 },
  safeCopy: { flex: 1, marginLeft: 9 },
  safeTitle: { ...v3.typography.bodyBold, color: v3.colors.ink },
  safeText: { ...v3.typography.caption, color: v3.colors.textSecondary, lineHeight: 17, marginTop: 3 },
  sectionTitle: { ...v3.typography.title, color: v3.colors.ink, marginTop: 22, marginBottom: 9 },
  empty: { alignItems: 'center', backgroundColor: v3.colors.paper, borderRadius: 18, borderWidth: 1, borderColor: v3.colors.line, padding: 24 },
  emptyTitle: { ...v3.typography.bodyBold, color: v3.colors.ink, marginTop: 8 },
  emptyText: { ...v3.typography.caption, color: v3.colors.textMuted, marginTop: 3 },
  statement: { backgroundColor: v3.colors.paper, borderRadius: 19, borderWidth: 1, borderColor: v3.colors.line, padding: 15, marginBottom: 9 },
  statementTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 11 },
  week: { ...v3.typography.bodyBold, color: v3.colors.ink },
  jobs: { ...v3.typography.small, color: v3.colors.textMuted, marginTop: 2 },
  status: { backgroundColor: v3.colors.amberSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusDone: { backgroundColor: v3.colors.successSoft },
  statusText: { ...v3.typography.smallBold, color: v3.colors.amberDark },
  statusTextDone: { color: v3.colors.success },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  rowLabel: { ...v3.typography.caption, color: v3.colors.textSecondary },
  rowValue: { ...v3.typography.captionBold, color: v3.colors.ink },
  rowStrong: { color: v3.colors.ink, fontFamily: 'Outfit_800ExtraBold' },
  dueRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: v3.colors.line, marginTop: 7, paddingTop: 10 },
  dueLabel: { ...v3.typography.captionBold, color: v3.colors.textSecondary },
  dueValue: { ...v3.typography.captionBold, color: v3.colors.success },
})
