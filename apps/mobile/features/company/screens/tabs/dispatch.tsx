import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Briefcase, Plus, UserCircle } from 'phosphor-react-native'
import { getActiveCompanyId } from '@/api/companies'
import { v2Request } from '@/api/v2-client'
import { v3 } from '@/theme/v3/tokens'

type Assignment = {
  id: string
  status: string
  assignedAt: string
  job: { id: string; title: string; status: string }
  worker: { id: string; name: string; email: string }
}

type CrewRoster = {
  id: string
  status: 'FORMING'
  version: number
  requiredWorkersCount: number
  dispatchEnabled: false
  job: { id: string; title: string; countryCode: string }
  assignments: {
    id: string
    status: string
    crewSlot: number
    crewRole: string
    worker: { id: string; name: string }
  }[]
}

export default function CompanyDispatch() {
  const router = useRouter()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [formingCrews, setFormingCrews] = useState<CrewRoster[]>([])
  const [cancellingCrewId, setCancellingCrewId] = useState<string | null>(null)
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'active' | 'in_progress' | 'completed'>('active')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const companyId = await getActiveCompanyId()
      if (!companyId) {
        setAssignments([])
        setFormingCrews([])
        setActiveCompanyId(null)
        return
      }
      setActiveCompanyId(companyId)
      const params = new URLSearchParams({ companyId })
      if (filter === 'in_progress') params.set('status', 'IN_PROGRESS')
      if (filter === 'completed') params.set('status', 'COMPLETED')
      const [data, crewData] = await Promise.all([
        v2Request<{ assignments: Assignment[] }>(`/api/mobile/company/assignments?${params.toString()}`),
        v2Request<{ crews: CrewRoster[] }>(
          `/api/mobile/company/crew/roster?companyId=${encodeURIComponent(companyId)}`,
        ).catch(() => ({ crews: [] as CrewRoster[] })),
      ])
      setFormingCrews(crewData.crews || [])
      const rows = data.assignments || []
      setAssignments(filter === 'active' ? rows.filter((row) => !['COMPLETED', 'REJECTED', 'REVOKED'].includes(row.status)) : rows)
    } catch {
      setAssignments([])
      setFormingCrews([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter])

  useEffect(() => { setLoading(true); load() }, [load])

  const cancelCrew = async (crew: CrewRoster) => {
    if (!activeCompanyId || cancellingCrewId) return
    setCancellingCrewId(crew.id)
    try {
      await v2Request('/api/mobile/company/crew/roster', {
        method: 'PATCH',
        body: JSON.stringify({
          companyId: activeCompanyId,
          crewDispatchId: crew.id,
          expectedVersion: crew.version,
          reason: 'Cancelled by company dispatcher',
        }),
      })
      await load()
      Alert.alert('Crew reservation cancelled', 'All staged worker capacity was released. Customer booking remains pending.')
    } catch (error: any) {
      Alert.alert('Unable to cancel crew', error?.message || 'Refresh the roster and try again.')
      await load()
    } finally {
      setCancellingCrewId(null)
    }
  }

  const confirmCancelCrew = (crew: CrewRoster) => Alert.alert(
    'Cancel this unstarted crew?',
    'All worker reservations will be released together. An accepted customer booking is not cancelled.',
    [
      { text: 'Keep crew', style: 'cancel' },
      { text: 'Release crew', style: 'destructive', onPress: () => { void cancelCrew(crew) } },
    ],
  )

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color={v3.colors.ink} /></View></SafeAreaView>

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
      >
        <View style={styles.header}>
          <View><Text style={styles.eyebrow}>OPERATIONS</Text><Text style={styles.title}>Dispatch</Text></View>
          <TouchableOpacity style={styles.add} onPress={() => router.push('/(company)/workforce/assign' as any)}><Plus size={17} color={v3.colors.paper} weight="bold" /><Text style={styles.addText}>Assign</Text></TouchableOpacity>
        </View>

        <View style={styles.filters}>
          {[
            ['active', 'Active'],
            ['in_progress', 'In progress'],
            ['completed', 'Completed'],
          ].map(([key, label]) => (
            <TouchableOpacity key={key} style={[styles.filter, filter === key && styles.filterActive]} onPress={() => setFilter(key as any)}>
              <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {formingCrews.length > 0 && filter === 'active' ? (
          <View style={styles.crewSection}>
            <Text style={styles.crewHeading}>Pending multi-worker rosters</Text>
            <Text style={styles.crewNote}>
              These are internal capacity reservations. They do not authorize arrival,
              customer PIN verification, job start or payouts.
            </Text>
            {formingCrews.map(crew => (
              <View key={crew.id} style={styles.crewCard}>
                <Text style={styles.jobTitle}>{crew.job.title}</Text>
                <Text style={styles.crewNote}>
                  {crew.assignments.filter(row => row.status === 'CREW_ACCEPTED').length}
                  {' / '}{crew.requiredWorkersCount} workers accepted · FORMING
                </Text>
                {crew.assignments.map(row => (
                  <Text key={row.id} style={styles.crewWorker}>
                    {row.crewRole === 'LEAD' ? 'Lead: ' : 'Member: '}
                    {row.worker.name} — {row.status === 'CREW_ACCEPTED' ? 'Accepted' : 'Pending response'}
                  </Text>
                ))}
                <TouchableOpacity style={styles.crewCancel} disabled={!!cancellingCrewId}
                  onPress={() => confirmCancelCrew(crew)}>
                  <Text style={styles.crewCancelText}>Release staged crew</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        {assignments.length ? assignments.map((assignment) => (
          <TouchableOpacity key={assignment.id} style={styles.card} activeOpacity={0.72} onPress={() => router.push(`/(company)/workforce/assignment/${assignment.id}` as any)}>
            <View style={styles.cardHeader}>
              <View style={styles.jobIcon}><Briefcase size={18} color={v3.colors.ink} weight="bold" /></View>
              <View style={styles.jobCopy}><Text style={styles.jobTitle}>{assignment.job?.title || 'Company job'}</Text><Text style={styles.jobStatus}>{assignment.job?.status || 'ACTIVE'}</Text></View>
              <Status value={assignment.status} />
            </View>
            <View style={styles.workerRow}><UserCircle size={17} color={v3.colors.textMuted} /><Text style={styles.workerName}>{assignment.worker?.name || 'Unassigned worker'}</Text><Text style={styles.date}>{new Date(assignment.assignedAt).toLocaleDateString()}</Text></View>
          </TouchableOpacity>
        )) : (
          <View style={styles.empty}><Briefcase size={30} color={v3.colors.textMuted} /><Text style={styles.emptyTitle}>No assignments here</Text><Text style={styles.emptyText}>After a company quote is accepted, assign the job to a team member and track progress from this workspace.</Text><TouchableOpacity style={styles.browse} onPress={() => router.push('/(company)/jobs/v2/browse' as any)}><Text style={styles.browseText}>Browse opportunities</Text></TouchableOpacity></View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Status({ value }: { value: string }) {
  const good = ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(value)
  return <View style={[styles.status, good ? styles.statusGood : styles.statusWarm]}><Text style={[styles.statusText, good ? styles.statusTextGood : styles.statusTextWarm]}>{value.replaceAll('_', ' ')}</Text></View>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingBottom: 34 },
  crewSection: { gap: 8, marginBottom: 16 },
  crewHeading: { ...v3.typography.bodyLarge, color: v3.colors.ink },
  crewNote: { ...v3.typography.small, color: v3.colors.textMuted, marginTop: 5, lineHeight: 17 },
  crewCard: { backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, borderRadius: 16, padding: 14, gap: 5 },
  crewWorker: { ...v3.typography.caption, color: v3.colors.textSecondary },
  crewCancel: { borderRadius: 12, borderWidth: 1, borderColor: v3.colors.amberDark, padding: 11, alignItems: 'center', marginTop: 9 },
  crewCancelText: { ...v3.typography.captionBold, color: v3.colors.amberDark },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 14 },
  eyebrow: { ...v3.typography.label, color: v3.colors.amberDark, letterSpacing: 1 },
  title: { ...v3.typography.h4, color: v3.colors.ink, marginTop: 2 },
  add: { height: 40, borderRadius: 14, backgroundColor: v3.colors.ink, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 5 },
  addText: { ...v3.typography.captionBold, color: v3.colors.paper },
  filters: { flexDirection: 'row', backgroundColor: v3.colors.paper, padding: 4, borderRadius: 16, borderWidth: 1, borderColor: v3.colors.line, marginBottom: 12 },
  filter: { flex: 1, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  filterActive: { backgroundColor: v3.colors.ink },
  filterText: { ...v3.typography.captionBold, color: v3.colors.textMuted },
  filterTextActive: { color: v3.colors.paper },
  card: { backgroundColor: v3.colors.paper, borderRadius: 18, borderWidth: 1, borderColor: v3.colors.line, padding: 14, marginBottom: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  jobIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center' },
  jobCopy: { flex: 1, marginLeft: 10 },
  jobTitle: { ...v3.typography.bodyLarge, color: v3.colors.ink },
  jobStatus: { ...v3.typography.small, color: v3.colors.textMuted, marginTop: 2 },
  status: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusGood: { backgroundColor: v3.colors.successSoft },
  statusWarm: { backgroundColor: v3.colors.amberSoft },
  statusText: { ...v3.typography.smallBold },
  statusTextGood: { color: v3.colors.success },
  statusTextWarm: { color: v3.colors.amberDark },
  workerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: v3.colors.line },
  workerName: { ...v3.typography.caption, color: v3.colors.textSecondary, marginLeft: 5, flex: 1 },
  date: { ...v3.typography.small, color: v3.colors.textMuted },
  empty: { alignItems: 'center', paddingTop: 65, paddingHorizontal: 34 },
  emptyTitle: { ...v3.typography.title, color: v3.colors.ink, marginTop: 12 },
  emptyText: { ...v3.typography.caption, color: v3.colors.textMuted, textAlign: 'center', lineHeight: 17, marginTop: 5 },
  browse: { height: 46, borderRadius: 14, backgroundColor: v3.colors.ink, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  browseText: { ...v3.typography.bodyBold, color: v3.colors.paper },
})
