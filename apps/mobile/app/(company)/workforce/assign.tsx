import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Briefcase, CaretLeft, Check, UserCircle, UsersThree } from 'phosphor-react-native'
import { getActiveCompanyId } from '../../../lib/api'
import { v2Jobs, v2Request, v2Team } from '../../../lib/api-v2'
import { v3 } from '../../../theme/v3/tokens'

type Member = {
  id: string
  userId?: string | null
  name: string
  role: string
  isOnline?: boolean
  skills?: string[]
}

export default function AssignWorkerScreen() {
  const router = useRouter()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [selectedWorkerId, setSelectedWorkerId] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const activeCompanyId = await getActiveCompanyId()
      if (!activeCompanyId) {
        setCompanyId(null)
        setMembers([])
        setJobs([])
        return
      }
      setCompanyId(activeCompanyId)

      const [teamRes, jobsRes, assignmentsRes] = await Promise.all([
        v2Team.list(),
        v2Jobs.list('myQuotes=true'),
        v2Request<{ assignments: any[] }>(`/api/mobile/company/assignments?companyId=${encodeURIComponent(activeCompanyId)}`),
      ])

      const activeAssignments = (assignmentsRes.assignments || []).filter(assignment =>
        ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(assignment.status),
      )
      setAssignments(activeAssignments)

      const candidateJobs = (jobsRes.jobs || []).filter(job =>
        ['QUOTE_ACCEPTED', 'IN_PROGRESS'].includes(job.status)
        && !activeAssignments.some(assignment => assignment.jobId === job.id),
      )

      const detailed = await Promise.all(candidateJobs.slice(0, 30).map(async job => {
        try {
          const detail = await v2Jobs.get(job.id)
          const accepted = detail.job.acceptedQuote
          return accepted?.providerType === 'COMPANY' && accepted?.providerId === activeCompanyId
            ? detail.job
            : null
        } catch {
          return null
        }
      }))

      setJobs(detailed.filter(Boolean))
      setMembers((teamRes.members || []).filter(member =>
        Boolean(member.userId) &&
        member.role !== 'FINANCE' &&
        member.role !== 'REMOVED',
      ))
    } catch (error: any) {
      Alert.alert('Could not load dispatch', error?.message || 'Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const selectedJob = useMemo(() => jobs.find(job => job.id === selectedJobId), [jobs, selectedJobId])
  const selectedWorker = useMemo(() => members.find(member => member.userId === selectedWorkerId), [members, selectedWorkerId])

  const assign = async () => {
    if (!companyId || !selectedJobId || !selectedWorkerId) {
      Alert.alert('Choose job and worker', 'Select both before assigning.')
      return
    }
    setSubmitting(true)
    try {
      await v2Request('/api/mobile/company/assign', {
        method: 'POST',
        body: JSON.stringify({
          companyId,
          jobId: selectedJobId,
          workerUserId: selectedWorkerId,
        }),
      })
      Alert.alert(
        'Worker assigned',
        `${selectedWorker?.name || 'Worker'} has been notified about "${selectedJob?.title || 'the job'}".`,
        [{ text: 'Open dispatch', onPress: () => router.replace('/(company)/(tabs)/dispatch' as any) }],
      )
    } catch (error: any) {
      Alert.alert('Could not assign worker', error?.message || 'Please check worker eligibility and schedule.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color={v3.colors.ink} /></View></SafeAreaView>
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.circle} onPress={() => router.back()}>
          <CaretLeft size={18} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>COMPANY OPERATIONS</Text>
          <Text style={styles.title}>Assign work</Text>
        </View>
        <View style={styles.circle}><UsersThree size={18} color={v3.colors.ink} weight="bold" /></View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
      >
        <View style={styles.info}>
          <Briefcase size={19} color={v3.colors.ink} weight="bold" />
          <Text style={styles.infoText}>Only jobs where the customer selected your Company appear here. Busy workers are rejected by server-side schedule checks.</Text>
        </View>

        <Text style={styles.sectionTitle}>1 · Choose accepted job</Text>
        {jobs.length ? jobs.map(job => (
          <TouchableOpacity
            key={job.id}
            style={[styles.choice, selectedJobId === job.id && styles.choiceSelected]}
            onPress={() => setSelectedJobId(job.id)}
          >
            <View style={styles.choiceIcon}><Briefcase size={18} color={v3.colors.ink} /></View>
            <View style={styles.choiceCopy}>
              <Text style={styles.choiceTitle}>{job.title}</Text>
              <Text style={styles.choiceMeta}>{String(job.status).replaceAll('_', ' ')} · {job.preferredTimeSlot || 'Flexible time'}</Text>
            </View>
            <SelectMark selected={selectedJobId === job.id} />
          </TouchableOpacity>
        )) : (
          <Empty text="No unassigned accepted Company jobs right now." />
        )}

        <Text style={styles.sectionTitle}>2 · Choose worker</Text>
        {members.length ? members.map(member => (
          <TouchableOpacity
            key={member.id}
            style={[styles.choice, selectedWorkerId === member.userId && styles.choiceSelected]}
            onPress={() => member.userId && setSelectedWorkerId(member.userId)}
          >
            <View style={styles.choiceIcon}><UserCircle size={20} color={v3.colors.ink} /></View>
            <View style={styles.choiceCopy}>
              <View style={styles.nameRow}>
                <Text style={styles.choiceTitle}>{member.name}</Text>
                {member.isOnline ? <View style={styles.onlineDot} /> : null}
              </View>
              <Text style={styles.choiceMeta}>{member.role.replaceAll('_', ' ')} · {member.isOnline ? 'Online' : 'Offline'}</Text>
            </View>
            <SelectMark selected={selectedWorkerId === member.userId} />
          </TouchableOpacity>
        )) : (
          <Empty text="Invite workers and have them accept the Company invitation before assigning jobs." />
        )}

        <TouchableOpacity
          style={[styles.assign, (!selectedJobId || !selectedWorkerId || submitting) && styles.assignDisabled]}
          disabled={!selectedJobId || !selectedWorkerId || submitting}
          onPress={assign}
        >
          {submitting ? <ActivityIndicator color={v3.colors.paper} /> : <Text style={styles.assignText}>Assign & notify worker</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function SelectMark({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.mark, selected && styles.markSelected]}>
      {selected ? <Check size={13} color={v3.colors.paper} weight="bold" /> : null}
    </View>
  )
}

function Empty({ text }: { text: string }) {
  return <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 },
  circle: { width: 40, height: 40, borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, marginHorizontal: 11 },
  eyebrow: { ...v3.typography.smallBold, color: v3.colors.amberDark, letterSpacing: 0.8 },
  title: { ...v3.typography.title, color: v3.colors.ink, marginTop: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 34 },
  info: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: v3.colors.amberSoft, borderRadius: 17, padding: 13 },
  infoText: { ...v3.typography.caption, color: v3.colors.textSecondary, lineHeight: 17, marginLeft: 9, flex: 1 },
  sectionTitle: { ...v3.typography.title, color: v3.colors.ink, marginTop: 21, marginBottom: 9 },
  choice: { minHeight: 72, backgroundColor: v3.colors.paper, borderRadius: 17, borderWidth: 1, borderColor: v3.colors.line, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  choiceSelected: { borderColor: v3.colors.ink, borderWidth: 1.5 },
  choiceIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center' },
  choiceCopy: { flex: 1, marginLeft: 10 },
  choiceTitle: { ...v3.typography.bodyLarge, color: v3.colors.ink },
  choiceMeta: { ...v3.typography.caption, color: v3.colors.textMuted, marginTop: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: v3.colors.success },
  mark: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  markSelected: { backgroundColor: v3.colors.ink, borderColor: v3.colors.ink },
  empty: { backgroundColor: v3.colors.paper, borderRadius: 17, borderWidth: 1, borderColor: v3.colors.line, padding: 18 },
  emptyText: { ...v3.typography.caption, color: v3.colors.textMuted, textAlign: 'center', lineHeight: 17 },
  assign: { height: 54, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  assignDisabled: { opacity: 0.35 },
  assignText: { ...v3.typography.bodyLarge, color: v3.colors.paper },
})
