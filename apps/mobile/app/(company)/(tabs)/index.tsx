import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  ArrowRight,
  Bell,
  Briefcase,
  CheckCircle,
  Gear,
  MagnifyingGlass,
  ShieldCheck,
  UsersThree,
  Wallet,
} from 'phosphor-react-native'
import { company } from '../../../lib/api'
import { v2Jobs } from '../../../lib/api-v2'
import { useAuth } from '../../../lib/auth'
import { v3 } from '../../../theme/v3/tokens'

type DashboardState = {
  profile: any
  opportunities: any[]
  contracts: any[]
  team: any[]
  monthlyRevenue: number
}

const EMPTY: DashboardState = {
  profile: null,
  opportunities: [],
  contracts: [],
  team: [],
  monthlyRevenue: 0,
}

export default function CompanyDashboard() {
  const router = useRouter()
  const { user } = useAuth()
  const [data, setData] = useState<DashboardState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const [profileRes, opportunitiesRes, contractsRes, teamRes, earningsRes] = await Promise.allSettled([
      company.profile.get(),
      v2Jobs.list('role=provider'),
      company.contracts.list(),
      company.team.list(),
      company.earnings.get(),
    ])

    const teamPayload: any = teamRes.status === 'fulfilled' ? teamRes.value : null
    setData({
      profile: profileRes.status === 'fulfilled' ? profileRes.value : null,
      opportunities: opportunitiesRes.status === 'fulfilled' ? opportunitiesRes.value.jobs || [] : [],
      contracts: contractsRes.status === 'fulfilled' ? contractsRes.value || [] : [],
      team: Array.isArray(teamPayload) ? teamPayload : teamPayload?.members || [],
      monthlyRevenue: earningsRes.status === 'fulfilled'
        ? Number((earningsRes.value as any)?.monthlyRevenue || (earningsRes.value as any)?.totalRevenue || 0)
        : 0,
    })
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  const readiness = useMemo(() => {
    const p = data.profile
    if (!p) return 0
    const checks = [
      Boolean(p.companyName),
      Boolean(p.description),
      Array.isArray(p.services) && p.services.length > 0,
      Array.isArray(p.serviceAreas) && p.serviceAreas.length > 0,
      data.team.length > 0,
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [data.profile, data.team.length])

  const activeContracts = data.contracts.filter((item: any) =>
    ['ACTIVE', 'IN_PROGRESS', 'In progress', 'active'].includes(item.status)
  )
  const onlineTeam = data.team.filter((member: any) => member.isOnline).length
  const companyName = data.profile?.companyName || 'Your company'
  const verified = Boolean(data.profile?.isVerified)

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loading}><ActivityIndicator size="small" color={v3.colors.ink} /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={v3.colors.ink} />}
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brand}>MΛINTΛINEX · BUSINESS</Text>
            <Text style={styles.pageTitle}>Company workspace</Text>
          </View>
          <View style={styles.topActions}>
            <TouchableOpacity style={styles.circleButton} onPress={() => router.push('/notifications' as any)}>
              <Bell size={18} color={v3.colors.ink} weight="bold" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.circleButton} onPress={() => router.push('/(company)/settings/edit-profile' as any)}>
              <Gear size={18} color={v3.colors.ink} weight="bold" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.companyMark}>
              <Text style={styles.companyMarkText}>{companyName.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.heroCopy}>
              <View style={styles.nameLine}>
                <Text style={styles.companyName} numberOfLines={1}>{companyName}</Text>
                {verified ? <ShieldCheck size={17} color={v3.colors.success} weight="fill" /> : null}
              </View>
              <Text style={styles.ownerText}>{user?.name || 'Company owner'} · {verified ? 'Verified business' : 'Verification pending'}</Text>
            </View>
          </View>

          <View style={styles.readinessRow}>
            <View style={styles.readinessCopy}>
              <Text style={styles.readinessLabel}>BUSINESS READINESS</Text>
              <Text style={styles.readinessValue}>{readiness}% complete</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(company)/(tabs)/profile' as any)}>
              <Text style={styles.completeLink}>{readiness < 100 ? 'Finish setup' : 'View profile'} →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${readiness}%` }]} />
          </View>
        </View>

        <View style={styles.metricGrid}>
          <Metric label="OPPORTUNITIES" value={String(data.opportunities.length)} />
          <Metric label="ACTIVE WORK" value={String(activeContracts.length)} />
          <Metric label="TEAM ONLINE" value={`${onlineTeam}/${data.team.length}`} />
          <Metric label="MONTH REVENUE" value={data.monthlyRevenue ? `LKR ${Math.round(data.monthlyRevenue / 1000)}K` : 'LKR 0'} />
        </View>

        <TouchableOpacity style={styles.primaryAction} activeOpacity={0.78} onPress={() => router.push('/(company)/jobs/v2/browse' as any)}>
          <View style={styles.primaryIcon}><MagnifyingGlass size={20} color={v3.colors.paper} weight="bold" /></View>
          <View style={styles.primaryCopy}>
            <Text style={styles.primaryTitle}>Find work & send quotes</Text>
            <Text style={styles.primaryText}>Jobs matching your verified services appear here.</Text>
          </View>
          <ArrowRight size={19} color={v3.colors.paper} weight="bold" />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Operations</Text>
        <View style={styles.actionGrid}>
          <ActionCard icon={<Briefcase size={20} color={v3.colors.ink} weight="bold" />} title="My jobs" detail="Quotes & active work" onPress={() => router.push('/(company)/jobs/v2/my-quotes' as any)} />
          <ActionCard icon={<UsersThree size={20} color={v3.colors.ink} weight="bold" />} title="Dispatch" detail="Assign your team" onPress={() => router.push('/(company)/(tabs)/dispatch' as any)} />
          <ActionCard icon={<CheckCircle size={20} color={v3.colors.ink} weight="bold" />} title="Team" detail="People & availability" onPress={() => router.push('/(company)/(tabs)/team' as any)} />
          <ActionCard icon={<Wallet size={20} color={v3.colors.ink} weight="bold" />} title="Earnings" detail="Revenue & payouts" onPress={() => router.push('/(company)/(tabs)/earnings-list' as any)} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>New opportunities</Text>
          <TouchableOpacity onPress={() => router.push('/(company)/jobs/v2/browse' as any)}><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
        </View>

        {data.opportunities.length ? data.opportunities.slice(0, 3).map((job: any) => (
          <TouchableOpacity key={job.id} style={styles.jobCard} activeOpacity={0.76} onPress={() => router.push(`/(company)/jobs/v2/quote/${job.id}` as any)}>
            <View style={styles.jobTop}>
              <View style={styles.openPill}><Text style={styles.openPillText}>OPEN</Text></View>
              <Text style={styles.jobBudget}>{job.budgetAmount ? `LKR ${Number(job.budgetAmount).toLocaleString()}` : 'Request quotes'}</Text>
            </View>
            <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
            <Text style={styles.jobDescription} numberOfLines={2}>{job.description}</Text>
            <View style={styles.jobBottom}><Text style={styles.jobMeta}>Matching your services</Text><Text style={styles.quoteLink}>Quote →</Text></View>
          </TouchableOpacity>
        )) : (
          <View style={styles.emptyCard}>
            <Briefcase size={23} color={v3.colors.textMuted} />
            <Text style={styles.emptyTitle}>No matching jobs right now</Text>
            <Text style={styles.emptyText}>Add services in your Company Profile so MaintainEX can route the right work to you.</Text>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>
}

function ActionCard({ icon, title, detail, onPress }: { icon: React.ReactNode; title: string; detail: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionCard} activeOpacity={0.72} onPress={onPress}>
      <View style={styles.actionIcon}>{icon}</View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionDetail}>{detail}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingBottom: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 14 },
  brand: { ...v3.typography.label, color: v3.colors.amberDark, letterSpacing: 1.1 },
  pageTitle: { ...v3.typography.h4, color: v3.colors.ink, marginTop: 2 },
  topActions: { flexDirection: 'row', gap: 8 },
  circleButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: v3.colors.ink, borderRadius: 24, padding: 18 },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  companyMark: { width: 50, height: 50, borderRadius: 17, backgroundColor: v3.colors.amber, alignItems: 'center', justifyContent: 'center' },
  companyMarkText: { ...v3.typography.title, color: v3.colors.ink },
  heroCopy: { flex: 1, marginLeft: 12 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  companyName: { ...v3.typography.title, color: v3.colors.paper, flexShrink: 1 },
  ownerText: { ...v3.typography.caption, color: v3.colors.textLight, marginTop: 2 },
  readinessRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 18 },
  readinessCopy: { gap: 2 },
  readinessLabel: { ...v3.typography.smallBold, color: v3.colors.textLight, letterSpacing: 0.8 },
  readinessValue: { ...v3.typography.bodyBold, color: v3.colors.paper },
  completeLink: { ...v3.typography.captionBold, color: v3.colors.amber },
  progressTrack: { height: 5, backgroundColor: '#333', borderRadius: 999, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: 5, backgroundColor: v3.colors.amber, borderRadius: 999 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  metric: { width: '48.7%', backgroundColor: v3.colors.paper, borderRadius: 17, borderWidth: 1, borderColor: v3.colors.line, padding: 14 },
  metricValue: { ...v3.typography.title, color: v3.colors.ink },
  metricLabel: { ...v3.typography.smallBold, color: v3.colors.textMuted, marginTop: 4, letterSpacing: 0.4 },
  primaryAction: { flexDirection: 'row', alignItems: 'center', backgroundColor: v3.colors.amber, borderRadius: 20, padding: 15, marginTop: 12 },
  primaryIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  primaryCopy: { flex: 1, marginHorizontal: 11 },
  primaryTitle: { ...v3.typography.bodyLarge, color: v3.colors.ink },
  primaryText: { ...v3.typography.caption, color: '#5D430D', marginTop: 2 },
  sectionTitle: { ...v3.typography.title, color: v3.colors.ink, marginTop: 20, marginBottom: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  seeAll: { ...v3.typography.captionBold, color: v3.colors.amberDark, marginBottom: 10 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionCard: { width: '48.7%', backgroundColor: v3.colors.paper, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: v3.colors.line },
  actionIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  actionTitle: { ...v3.typography.bodyLarge, color: v3.colors.ink },
  actionDetail: { ...v3.typography.caption, color: v3.colors.textMuted, marginTop: 2 },
  jobCard: { backgroundColor: v3.colors.paper, borderRadius: 18, borderWidth: 1, borderColor: v3.colors.line, padding: 15, marginBottom: 9 },
  jobTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  openPill: { backgroundColor: v3.colors.successSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  openPillText: { ...v3.typography.smallBold, color: v3.colors.success },
  jobBudget: { ...v3.typography.captionBold, color: v3.colors.ink },
  jobTitle: { ...v3.typography.bodyLarge, color: v3.colors.ink, marginTop: 10 },
  jobDescription: { ...v3.typography.caption, color: v3.colors.textSecondary, lineHeight: 17, marginTop: 3 },
  jobBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  jobMeta: { ...v3.typography.small, color: v3.colors.textMuted },
  quoteLink: { ...v3.typography.captionBold, color: v3.colors.amberDark },
  emptyCard: { backgroundColor: v3.colors.paper, borderRadius: 18, borderWidth: 1, borderColor: v3.colors.line, padding: 20, alignItems: 'center' },
  emptyTitle: { ...v3.typography.bodyLarge, color: v3.colors.ink, marginTop: 8 },
  emptyText: { ...v3.typography.caption, color: v3.colors.textMuted, textAlign: 'center', lineHeight: 17, marginTop: 4 },
})
