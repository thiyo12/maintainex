import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Briefcase, CaretLeft, CheckCircle, UserCircle, UsersThree } from 'phosphor-react-native'
import { getActiveCompanyId } from '../../../lib/api'
import { v2Jobs, v2Request } from '../../../lib/api-v2'
import { v3 } from '../../../theme/v3/tokens'

type TeamMember = {
  id: string
  userId: string | null
  name: string
  role: string
  skills: string[]
  isOnline: boolean
  rating: number
  completedJobs: number
}

type DispatchJob = {
  id: string
  title: string
  status: string
  preferredDate?: string | null
  preferredTimeSlot?: string | null
}

export default function AssignWorkerScreen() {
  const router = useRouter()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [jobs, setJobs] = useState<DispatchJob[]>([])
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const activeCompanyId = await getActiveCompanyId()
      if (!activeCompanyId) {
        setCompanyId(null)
        return
      }
      setCompanyId(activeCompanyId)

      const [teamData, assignmentsData, quotedJobs] = await Promise.all([
        v2Request<{ members: TeamMember[] }>(`/api/mobile/company/team?companyId=${activeCompanyId}`),
        v2Request<{ assignments: any[] }>(`/api/mobile/company/assignments?companyId=${activeCompanyId}`),
        v2Jobs.list('myQuotes=true'),
      ])

      const activeAssignedJobs = new Set(
        (assignmentsData.assignments || [])
          .filter(row => ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(row.status))
          .map(row => row.jobId)
      )

      const candidateJobs = (quotedJobs.jobs || []).filter(job =>
        ['QUOTE_ACCEPTED', 'IN_PROGRESS'].includes(job.status) && !activeAssignedJobs.has(job.id)
      )

      const details = await Promise.all(
        candidateJobs.slice(0, 30).map(job =>
          v2Jobs.get(job.id).then(result => result.job).catch(() => null)
        )
      )

      setJobs(
        details
          .filter((job): job is any => Boolean(job))
          .filter(job =>
            (job.quotes || []).some((quote: any) =>
              quote.providerType === 'COMPANY'
              && quote.providerId === activeCompanyId
              && quote.status === 'ACCEPTED'
            )
          )
          .map(job => ({
            id: job.id,
            title: job.title,
            status: job.status,
            preferredDate: job.preferredDate,
            preferredTimeSlot: job.preferredTimeSlot,
          }))
      )

      setWorkers(
        (teamData.members || []).filter(member =>
          Boolean(member.userId)
          && member.status !== 'SUSPENDED'
          && ['WORKER', 'DISPATCHER', 'MANAGER', 'COMPANY_OWNER'].includes(member.role)
        )
      )
    } catch (error: any) {
      Alert.alert('Could not load dispatch', error?.message || 'Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const selectedWorkerData = useMemo(
    () => workers.find(worker => worker.userId === selectedWorker),
    [workers, selectedWorker]
  )
  const selectedJobData = useMemo(
    () => jobs.find(job => job.id === selectedJob),
    [jobs, selectedJob]
  )

  const assign = async () => {
    if (!companyId || !selectedWorker || !selectedJob) return
    setSubmitting(true)
    try {
      await v2Request('/api/mobile/company/assign', {
        method: 'POST',
        body: JSON.stringify({
          companyId,
          jobId: selectedJob,
          workerUserId: selectedWorker,
        }),
      })
      Alert.alert(
        'Worker assigned',
        `${selectedWorkerData?.name || 'Worker'} will receive the job notification now.`,
        [{ text: 'Done', onPress: () => router.replace('/(company)/(tabs)/dispatch' as any) }],
      )
    } catch (error: any) {
      Alert.alert('Unable to assign', error?.message || 'The worker may be busy or missing the required capability.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}><ActivityIndicator color={v3.colors.ink} /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.circle} onPress={() => router.back()}>
          <CaretLeft size={18} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>DISPATCH</Text>
          <Text style={styles.title}>Assign work</Text>
        </View>
        <View style={styles.circlePlaceholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>1 · Select accepted job</Text>
        {jobs.length === 0 ? (
          <View style={styles.empty}>
            <Briefcase size={25} color={v3.colors.textMuted} />
            <Text style={styles.emptyTitle}>No jobs waiting for assignment</Text>
            <Text style={styles.emptyText}>A company quote must be accepted before the job can be dispatched to an employee.</Text>
          </View>
        ) : jobs.map(job => {
          const active = selectedJob === job.id
          const date = job.preferredDate ? new Date(job.preferredDate).toLocaleDateString() : 'As soon as possible'
          return (
            <TouchableOpacity
              key={job.id}
              style={[styles.option, active && styles.optionActive]}
              onPress={() => setSelectedJob(job.id)}
              activeOpacity={0.72}
            >
              <View style={styles.optionIcon}><Briefcase size={18} color={v3.colors.ink} weight="bold" /></View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>{job.title}</Text>
                <Text style={styles.optionMeta}>{date}{job.preferredTimeSlot ? ` · ${job.preferredTimeSlot}` : ''}</Text>
              </View>
              {active ? <CheckCircle size={20} color={v3.colors.success} weight="fill" /> : null}
            </TouchableOpacity>
          )
        })}

        <Text style={styles.sectionTitle}>2 · Select employee</Text>
        {workers.length === 0 ? (
          <View style={styles.empty}>
            <UsersThree size={25} color={v3.colors.textMuted} />
            <Text style={styles.emptyTitle}>No eligible team accounts</Text>
            <Text style={styles.emptyText}>Invite employees and make sure their identity and job capabilities are ready.</Text>
          </View>
        ) : workers.map(worker => {
          const active = selectedWorker === worker.userId
          return (
            <TouchableOpacity
              key={worker.id}
              style={[styles.option, active && styles.optionActive]}
              onPress={() => worker.userId && setSelectedWorker(worker.userId)}
              activeOpacity={0.72}
            >
              <View style={[styles.avatar, worker.isOnline && styles.avatarOnline]}>
                <Text style={styles.avatarText}>{worker.name?.[0]?.toUpperCase() || '?'}</Text>
              </View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>{worker.name}</Text>
                <Text style={styles.optionMeta}>
                  {worker.role.replaceAll('_', ' ')} · {worker.completedJobs || 0} jobs
                  {worker.rating > 0 ? ` · ${worker.rating.toFixed(1)}★` : ''}
                </Text>
              </View>
              <View style={[styles.presence, worker.isOnline ? styles.online : styles.offline]}>
                <Text style={[styles.presenceText, worker.isOnline ? styles.onlineText : styles.offlineText]}>
                  {worker.isOnline ? 'ONLINE' : 'OFFLINE'}
                </Text>
              </View>
            </TouchableOpacity>
          )
        })}

        {selectedJobData && selectedWorkerData ? (
          <View style={styles.summary}>
            <UserCircle size={20} color={v3.colors.ink} weight="bold" />
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryTitle}>Ready to dispatch</Text>
              <Text style={styles.summaryText}>{selectedWorkerData.name} → {selectedJobData.title}</Text>
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.assignButton, (!selectedWorker || !selectedJob || submitting) && styles.disabled]}
          disabled={!selectedWorker || !selectedJob || submitting}
          onPress={assign}
        >
          {submitting
            ? <ActivityIndicator size="small" color={v3.colors.paper} />
            : <Text style={styles.assignText}>Assign employee</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 },
  circle: { width: 40, height: 40, borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  circlePlaceholder: { width: 40 },
  headerCopy: { flex: 1, marginLeft: 11 },
  eyebrow: { ...v3.typography.smallBold, color: v3.colors.amberDark, letterSpacing: 0.8 },
  title: { ...v3.typography.title, color: v3.colors.ink, marginTop: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 34 },
  sectionTitle: { ...v3.typography.bodyLarge, color: v3.colors.ink, marginTop: 18, marginBottom: 8 },
  option: { minHeight: 72, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  optionActive: { borderColor: v3.colors.amber, borderWidth: 2 },
  optionIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center' },
  optionCopy: { flex: 1, marginLeft: 10 },
  optionTitle: { ...v3.typography.bodyBold, color: v3.colors.ink },
  optionMeta: { ...v3.typography.caption, color: v3.colors.textMuted, marginTop: 3 },
  avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: v3.colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  avatarOnline: { backgroundColor: v3.colors.ink },
  avatarText: { ...v3.typography.bodyBold, color: v3.colors.paper },
  presence: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4 },
  online: { backgroundColor: v3.colors.successSoft },
  offline: { backgroundColor: v3.colors.surfaceGray },
  presenceText: { ...v3.typography.smallBold },
  onlineText: { color: v3.colors.success },
  offlineText: { color: v3.colors.textMuted },
  empty: { borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, padding: 18, alignItems: 'center' },
  emptyTitle: { ...v3.typography.bodyBold, color: v3.colors.ink, marginTop: 8 },
  emptyText: { ...v3.typography.caption, color: v3.colors.textMuted, textAlign: 'center', lineHeight: 17, marginTop: 4 },
  summary: { flexDirection: 'row', alignItems: 'center', backgroundColor: v3.colors.amberSoft, borderRadius: 17, padding: 14, marginTop: 14 },
  summaryCopy: { flex: 1, marginLeft: 10 },
  summaryTitle: { ...v3.typography.bodyBold, color: v3.colors.ink },
  summaryText: { ...v3.typography.caption, color: v3.colors.amberDark, marginTop: 2 },
  assignButton: { height: 54, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  assignText: { ...v3.typography.bodyLarge, color: v3.colors.paper },
  disabled: { opacity: 0.45 },
})
