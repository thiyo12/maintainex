import { useEffect, useMemo, useRef, useState } from 'react'
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
import { getActiveCompanyId } from '@/api/companies'
import { v2Jobs } from '@/api/v2-jobs'
import { v2Request } from '@/api/v2-client'
import { v3 } from '@/theme/v3/tokens'

type TeamMember = {
  id: string
  userId: string | null
  name: string
  role: string
  status: string
  identityVerified?: boolean
  workerAccountEligible: boolean
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
  workersCount?: number
  workerIdentityCheckRequired?: boolean
}

type CrewReadinessReport = {
  previewOnly: true
  dispatchEnabled: false
  requiredWorkersCount: number
  selectedWorkersCount: number
  preflightReady: boolean
  blockers: string[]
  workers: { workerUserId: string; eligible: boolean; reasons: string[] }[]
}

export default function AssignWorkerScreen() {
  const router = useRouter()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [jobs, setJobs] = useState<DispatchJob[]>([])
  const [crewBookingsBlocked, setCrewBookingsBlocked] = useState(0)
  const [crewJobs, setCrewJobs] = useState<DispatchJob[]>([])
  const [selectedCrewJob, setSelectedCrewJob] = useState<string | null>(null)
  const [selectedCrewWorkers, setSelectedCrewWorkers] = useState<string[]>([])
  const [selectedCrewLead, setSelectedCrewLead] = useState<string | null>(null)
  const [stagingCrew, setStagingCrew] = useState(false)
  // Both client AND server must opt in. Server staging is *always* disabled
  // with NODE_ENV=production, even if this mobile flag was misconfigured.
  const allowDevCrewStaging = __DEV__ &&
    process.env.EXPO_PUBLIC_MAINTAINEX_PHASE04_CREW_STAGING_UI === 'true'
  const [crewReadiness, setCrewReadiness] = useState<CrewReadinessReport | null>(null)
  const [checkingCrew, setCheckingCrew] = useState(false)
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  // Prevent a slow preview response for a previous roster/job from being
  // presented as eligibility for the currently selected crew.
  const crewRequestVersion = useRef(0)
  const invalidateCrewReview = () => {
    crewRequestVersion.current += 1
    setCrewReadiness(null)
    setCheckingCrew(false)
  }

  const load = async () => {
    invalidateCrewReview()
    setLoading(true)
    setCrewBookingsBlocked(0)
    setCrewJobs([])
    setSelectedCrewJob(null)
    setSelectedCrewWorkers([])
    setSelectedCrewLead(null)
    setCrewReadiness(null)
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
        v2Jobs.list(`myQuotes=true&context=company&companyId=${encodeURIComponent(activeCompanyId)}`),
      ])

      const activeAssignedJobs = new Set(
        (assignmentsData.assignments || [])
          .filter(row => ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(row.status))
          .map(row => row.jobId)
      )

      const candidateJobs = (quotedJobs.jobs || []).filter(job =>
        job.status === 'QUOTE_ACCEPTED' && !activeAssignedJobs.has(job.id)
      )

      const details = await Promise.all(
        candidateJobs.slice(0, 30).map(job =>
          v2Jobs.get(job.id, 'company').then(result => result.job).catch(() => null)
        )
      )

      const acceptedCompanyJobs = details
        .filter((job): job is any => Boolean(job))
        .filter(job =>
          (job.quotes || []).some((quote: any) =>
            quote.providerType === 'COMPANY'
            && quote.providerId === activeCompanyId
            && quote.status === 'ACCEPTED'
          )
        )
      const crewBookings = acceptedCompanyJobs
        .filter(job => (job.workersCount ?? 1) > 1)
        .map(job => ({
          id: job.id,
          title: job.title,
          status: job.status,
          preferredDate: job.preferredDate,
          preferredTimeSlot: job.preferredTimeSlot,
          workersCount: job.workersCount,
          workerIdentityCheckRequired: job.workerIdentityCheckRequired,
        }))
      setCrewBookingsBlocked(crewBookings.length)
      setCrewJobs(crewBookings)
      setJobs(
        acceptedCompanyJobs
          .filter(job => (job.workersCount ?? 1) === 1)
          .map(job => ({
            id: job.id,
            title: job.title,
            status: job.status,
            preferredDate: job.preferredDate,
            preferredTimeSlot: job.preferredTimeSlot,
            workersCount: job.workersCount,
            workerIdentityCheckRequired: job.workerIdentityCheckRequired,
          }))
      )

      setWorkers(
        (teamData.members || []).filter(member =>
          Boolean(member.userId)
          && member.status === 'ACTIVE'
          && member.role === 'WORKER'
          && member.workerAccountEligible === true
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

  const selectedCrewJobData = crewJobs.find(job => job.id === selectedCrewJob)

  const toggleCrewWorker = (workerUserId: string) => {
    invalidateCrewReview()
    if (selectedCrewLead === workerUserId) setSelectedCrewLead(null)
    setSelectedCrewWorkers(current =>
      current.includes(workerUserId)
        ? current.filter(id => id !== workerUserId)
        : [...current, workerUserId].slice(0, 12)
    )
  }

  const reviewCrewReadiness = async () => {
    if (!companyId || !selectedCrewJob) return
    const requestVersion = ++crewRequestVersion.current
    const requestedCompanyId = companyId
    const requestedJobId = selectedCrewJob
    const requestedWorkers = [...selectedCrewWorkers]
    setCheckingCrew(true)
    setCrewReadiness(null)
    try {
      const report = await v2Request<CrewReadinessReport>(
        '/api/mobile/company/crew/readiness',
        {
          method: 'POST',
          body: JSON.stringify({
            companyId: requestedCompanyId,
            jobId: requestedJobId,
            workerUserIds: requestedWorkers,
          }),
        }
      )
      if (crewRequestVersion.current === requestVersion) setCrewReadiness(report)
    } catch (error: any) {
      if (crewRequestVersion.current === requestVersion) {
        Alert.alert('Crew readiness unavailable', error?.message || 'Please try again.')
      }
    } finally {
      if (crewRequestVersion.current === requestVersion) setCheckingCrew(false)
    }
  }

  const stageDevCrew = async () => {
    if (!allowDevCrewStaging || !companyId || !selectedCrewJob || !selectedCrewJobData ||
        !selectedCrewLead || stagingCrew || !crewReadiness?.preflightReady ||
        !selectedCrewWorkers.includes(selectedCrewLead) ||
        selectedCrewWorkers.length !== selectedCrewJobData.workersCount) return
    setStagingCrew(true)
    try {
      await v2Request('/api/mobile/company/crew/roster', {
        method: 'POST',
        body: JSON.stringify({
          companyId,
          jobId: selectedCrewJob,
          workerUserIds: [...selectedCrewWorkers],
          leadWorkerUserId: selectedCrewLead,
        }),
      })
      Alert.alert(
        'Internal crew staged (development only)',
        'Worker invitations are now available to test. Crew dispatch, arrival PIN, Start Work and payments remain disabled.',
        [{ text: 'Review rosters', onPress: () => router.replace('/(company)/(tabs)/dispatch' as any) }],
      )
    } catch (error: any) {
      Alert.alert(
        'Crew staging not available',
        error?.message || 'The server or worker eligibility checks blocked this test reservation.',
      )
      invalidateCrewReview()
    } finally {
      setStagingCrew(false)
    }
  }

  const confirmStageDevCrew = () => Alert.alert(
    'Stage a test-only crew?',
    'Development environment only. This reserves all selected workers and cannot enable work, PINs or payments.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Stage test roster', onPress: () => { void stageDevCrew() } },
    ],
  )

  const assign = async () => {
    if (!companyId || !selectedWorker || !selectedJob) return
    if ((selectedJobData?.workersCount ?? 1) !== 1) {
      Alert.alert('Crew dispatch not available', 'This booking needs multiple verified workers. It cannot be assigned to one person.')
      return
    }
    if (selectedJobData?.workerIdentityCheckRequired && !selectedWorkerData?.identityVerified) {
      Alert.alert('Verified photo required', 'This booking requires an approved worker identity photo before dispatch.')
      return
    }
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
        {crewBookingsBlocked > 0 ? (
          <View style={styles.empty}>
            <UsersThree size={25} color={v3.colors.textMuted} />
            <Text style={styles.emptyTitle}>{crewBookingsBlocked} crew booking{crewBookingsBlocked === 1 ? '' : 's'} blocked</Text>
            <Text style={styles.emptyText}>These bookings require multiple verified workers. Single-person dispatch is unavailable until crew scheduling, acceptance, identity and PIN checks are supported.</Text>
          </View>
        ) : null}
        {crewBookingsBlocked > 0 ? (
          <View style={styles.crewPreview}>
            <Text style={styles.sectionTitle}>Crew readiness preview · no dispatch</Text>
            <Text style={styles.emptyText}>Review eligible workers and conflicts. This does not reserve workers, change a booking, or authorize work.</Text>
            {crewJobs.map(job => (
              <TouchableOpacity
                key={job.id}
                style={[styles.option, selectedCrewJob === job.id && styles.optionActive]}
                onPress={() => {
                  invalidateCrewReview()
                  setSelectedCrewJob(job.id)
                  setSelectedCrewWorkers([])
                  setSelectedCrewLead(null)
                }}
              >
                <UsersThree size={19} color={v3.colors.ink} />
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>{job.title}</Text>
                  <Text style={styles.optionMeta}>Needs {job.workersCount} workers · dispatch blocked</Text>
                </View>
                {selectedCrewJob === job.id ? <CheckCircle size={20} color={v3.colors.success} weight="fill" /> : null}
              </TouchableOpacity>
            ))}
            {selectedCrewJobData ? (
              <>
                <Text style={styles.emptyText}>Select {selectedCrewJobData.workersCount} distinct workers to check. You can review an incomplete roster.</Text>
                {workers.map(worker => (
                  <TouchableOpacity
                    key={worker.id}
                    style={[styles.option, selectedCrewWorkers.includes(worker.userId || '') && styles.optionActive]}
                    onPress={() => worker.userId && toggleCrewWorker(worker.userId)}
                  >
                    <UserCircle size={20} color={v3.colors.ink} />
                    <View style={styles.optionCopy}>
                      <Text style={styles.optionTitle}>{worker.name}</Text>
                      <Text style={styles.optionMeta}>{worker.identityVerified ? 'Verified photo present' : 'Photo approval not confirmed'}</Text>
                    </View>
                    {selectedCrewWorkers.includes(worker.userId || '')
                      ? <CheckCircle size={20} color={v3.colors.success} weight="fill" />
                      : null}
                  </TouchableOpacity>
                ))}
                {allowDevCrewStaging && selectedCrewWorkers.length > 0 ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>Development-only crew lead</Text>
                    <Text style={styles.emptyText}>
                      Select one accepted worker as the named lead.
                      This is only for staging test invitations.
                    </Text>
                    {selectedCrewWorkers.map(workerId => (
                      <TouchableOpacity key={workerId}
                        style={[styles.option, selectedCrewLead === workerId && styles.optionActive]}
                        onPress={() => {
                          invalidateCrewReview()
                          setSelectedCrewLead(workerId)
                        }}>
                        <UserCircle size={19} color={v3.colors.ink} />
                        <Text style={styles.optionTitle}>
                          {workers.find(person => person.userId === workerId)?.name || 'Worker'}
                          {selectedCrewLead === workerId ? ' · Lead' : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                <TouchableOpacity
                  style={[styles.assignButton, checkingCrew && styles.disabled]}
                  disabled={checkingCrew}
                  onPress={reviewCrewReadiness}
                >
                  {checkingCrew
                    ? <ActivityIndicator size="small" color={v3.colors.paper} />
                    : <Text style={styles.assignText}>Check crew eligibility · preview only</Text>}
                </TouchableOpacity>
                {allowDevCrewStaging && crewReadiness?.preflightReady &&
                  selectedCrewLead && selectedCrewWorkers.includes(selectedCrewLead) &&
                  selectedCrewWorkers.length === selectedCrewJobData.workersCount ? (
                    <TouchableOpacity style={[styles.assignButton, stagingCrew && styles.disabled]}
                      disabled={stagingCrew} onPress={confirmStageDevCrew}>
                      {stagingCrew
                        ? <ActivityIndicator size="small" color={v3.colors.paper} />
                        : <Text style={styles.assignText}>Stage internal test crew · no dispatch</Text>}
                    </TouchableOpacity>
                ) : null}
                {crewReadiness ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>{crewReadiness.preflightReady ? 'Roster eligible (not dispatchable)' : 'Crew readiness blocked'}</Text>
                    <Text style={styles.emptyText}>{crewReadiness.selectedWorkersCount} of {crewReadiness.requiredWorkersCount} workers selected. Crew dispatch and PINs remain disabled.</Text>
                    {crewReadiness.blockers.map((blocker, index) => (
                      <Text key={index} style={styles.emptyText}>{blocker}</Text>
                    ))}
                    {crewReadiness.workers.map(worker => (
                      <Text key={worker.workerUserId} style={styles.emptyText}>
                        {workers.find(person => person.userId === worker.workerUserId)?.name || 'Worker'}:
                        {worker.eligible ? ' eligible in preview' : ` ${worker.reasons.join('; ')}`}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}
        {jobs.length === 0 ? (
          <View style={styles.empty}>
            <Briefcase size={25} color={v3.colors.textMuted} />
            <Text style={styles.emptyTitle}>No jobs waiting for assignment</Text>
            <Text style={styles.emptyText}>Only accepted, single-worker company jobs can be dispatched here. Multi-worker crew bookings require a separately verified crew workflow.</Text>
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
                  {worker.role.replaceAll('_', ' ')} · {worker.completedJobs || 0} jobs{worker.identityVerified ? ' · ID verified' : ' · ID photo not verified'}
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
  crewPreview: { marginTop: 12, marginBottom: 8 },
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
