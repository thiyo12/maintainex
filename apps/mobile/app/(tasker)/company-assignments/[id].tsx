import { useEffect, useState } from 'react'
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
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  Briefcase,
  Buildings,
  Calendar,
  CaretLeft,
  CheckCircle,
  MapPin,
  XCircle,
} from 'phosphor-react-native'
import { v2Request } from '../../../lib/api-v2'
import { v3 } from '../../../theme/v3/tokens'

type Assignment = {
  id: string
  jobId: string
  workerUserId: string
  status: string
  assignedAt: string
  acceptedAt: string | null
  startedAt: string | null
  completedAt: string | null
  rejectReason?: string | null
  job: {
    id: string
    title: string
    status: string
    preferredDate?: string | null
    preferredTimeSlot?: string | null
  }
  company: {
    id: string
    companyName: string
  }
}

export default function TaskerCompanyAssignmentScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')

  const load = async () => {
    try {
      const data = await v2Request<Assignment>(`/api/mobile/company/assignments/${id}`)
      setAssignment(data)
    } catch (error: any) {
      Alert.alert('Assignment unavailable', error?.message || 'This assignment is no longer available.', [
        { text: 'Back', onPress: () => router.back() },
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (id) load() }, [id])

  const respond = async (nextAction: 'accept' | 'reject') => {
    setAction(nextAction)
    try {
      await v2Request(`/api/mobile/company/assignments/${id}`, {
        method: 'POST',
        body: JSON.stringify({ action: nextAction }),
      })
      await load()
      if (nextAction === 'accept') {
        Alert.alert('Assignment accepted', 'This Company job is now in your work pipeline.')
      } else {
        Alert.alert('Assignment declined', 'The Company can assign another available worker.', [
          { text: 'Done', onPress: () => router.back() },
        ])
      }
    } catch (error: any) {
      Alert.alert('Unable to update assignment', error?.message || 'Please try again.')
    } finally {
      setAction('')
    }
  }

  if (loading || !assignment) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loading}><ActivityIndicator color={v3.colors.ink} /></View>
      </SafeAreaView>
    )
  }

  const accepted = ['ACCEPTED', 'IN_PROGRESS'].includes(assignment.status)
  const completed = assignment.status === 'COMPLETED'
  const schedule = [
    assignment.job?.preferredDate
      ? new Date(assignment.job.preferredDate).toLocaleDateString()
      : null,
    assignment.job?.preferredTimeSlot,
  ].filter(Boolean).join(' · ') || 'Schedule set in job details'

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.circle} onPress={() => router.back()}>
          <CaretLeft size={18} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>COMPANY ASSIGNMENT</Text>
          <Text style={styles.headerTitle}>Assigned work</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{assignment.status.replaceAll('_', ' ')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.companyIcon}><Buildings size={22} color={v3.colors.ink} weight="fill" /></View>
          <Text style={styles.companyName}>{assignment.company?.companyName || 'Company'}</Text>
          <Text style={styles.assignedText}>assigned this job to you</Text>
          <Text style={styles.jobTitle}>{assignment.job?.title || 'MaintainEX job'}</Text>
        </View>

        <View style={styles.detailCard}>
          <Detail icon={<Calendar size={17} color={v3.colors.textMuted} />} label="Schedule" value={schedule} />
          <Detail icon={<Briefcase size={17} color={v3.colors.textMuted} />} label="Job status" value={String(assignment.job?.status || '—').replaceAll('_', ' ')} />
          <Detail icon={<MapPin size={17} color={v3.colors.textMuted} />} label="Work access" value={accepted ? 'Unlocked after protected payment / PIN rules' : 'Accept assignment first'} last />
        </View>

        {assignment.status === 'ASSIGNED' ? (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.accept}
              onPress={() => respond('accept')}
              disabled={!!action}
              activeOpacity={0.78}
            >
              {action === 'accept'
                ? <ActivityIndicator size="small" color={v3.colors.paper} />
                : <><CheckCircle size={18} color={v3.colors.paper} weight="fill" /><Text style={styles.acceptText}>Accept assignment</Text></>}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reject}
              onPress={() => Alert.alert(
                'Decline assignment?',
                'The Company will be able to dispatch another worker.',
                [
                  { text: 'Keep assignment', style: 'cancel' },
                  { text: 'Decline', style: 'destructive', onPress: () => respond('reject') },
                ],
              )}
              disabled={!!action}
              activeOpacity={0.78}
            >
              {action === 'reject'
                ? <ActivityIndicator size="small" color={v3.colors.error} />
                : <><XCircle size={18} color={v3.colors.error} weight="fill" /><Text style={styles.rejectText}>Decline</Text></>}
            </TouchableOpacity>
          </View>
        ) : null}

        {accepted ? (
          <TouchableOpacity
            style={styles.openJob}
            activeOpacity={0.78}
            onPress={() => router.push((`/(tasker)/jobs/v2/manage/${assignment.jobId}`) as any)}
          >
            <Text style={styles.openJobText}>
              {assignment.status === 'IN_PROGRESS' ? 'Continue work' : 'Open job & prepare'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {completed ? (
          <View style={styles.doneCard}>
            <CheckCircle size={21} color={v3.colors.success} weight="fill" />
            <View style={{ flex: 1 }}>
              <Text style={styles.doneTitle}>Assignment completed</Text>
              <Text style={styles.doneText}>This job has completed the Company work lifecycle.</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.security}>
          <Text style={styles.securityTitle}>Secure work flow</Text>
          <Text style={styles.securityText}>
            After accepting, travel to the customer through the job screen. Arrival PIN must be verified before the work-start PIN. Company dispatch will see your real assignment status.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Detail({ icon, label, value, last = false }: { icon: React.ReactNode; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, !last && styles.detailBorder]}>
      <View style={styles.detailIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 },
  circle: { width: 40, height: 40, borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, marginLeft: 11 },
  eyebrow: { ...v3.typography.smallBold, color: v3.colors.amberDark, letterSpacing: 0.7 },
  headerTitle: { ...v3.typography.title, color: v3.colors.ink, marginTop: 1 },
  statusPill: { backgroundColor: v3.colors.amberSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { ...v3.typography.smallBold, color: v3.colors.amberDark },
  content: { paddingHorizontal: 18, paddingBottom: 36 },
  hero: { backgroundColor: v3.colors.ink, borderRadius: 22, padding: 18, alignItems: 'flex-start' },
  companyIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: v3.colors.amber, alignItems: 'center', justifyContent: 'center' },
  companyName: { ...v3.typography.bodyBold, color: v3.colors.amber, marginTop: 12 },
  assignedText: { ...v3.typography.caption, color: v3.colors.textLight, marginTop: 1 },
  jobTitle: { ...v3.typography.h5, color: v3.colors.paper, marginTop: 9 },
  detailCard: { backgroundColor: v3.colors.paper, borderRadius: 18, borderWidth: 1, borderColor: v3.colors.line, overflow: 'hidden', marginTop: 10 },
  detailRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  detailBorder: { borderBottomWidth: 1, borderBottomColor: v3.colors.line },
  detailIcon: { width: 35, height: 35, borderRadius: 12, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  detailLabel: { ...v3.typography.smallBold, color: v3.colors.textMuted },
  detailValue: { ...v3.typography.body, color: v3.colors.ink, marginTop: 2 },
  actions: { gap: 9, marginTop: 14 },
  accept: { height: 52, borderRadius: 16, backgroundColor: v3.colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  acceptText: { ...v3.typography.bodyBold, color: v3.colors.paper },
  reject: { height: 50, borderRadius: 16, backgroundColor: v3.colors.errorSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  rejectText: { ...v3.typography.bodyBold, color: v3.colors.error },
  openJob: { height: 53, borderRadius: 16, backgroundColor: v3.colors.amber, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  openJobText: { ...v3.typography.bodyLarge, color: v3.colors.ink },
  doneCard: { flexDirection: 'row', gap: 10, backgroundColor: v3.colors.successSoft, borderRadius: 18, padding: 15, marginTop: 14 },
  doneTitle: { ...v3.typography.bodyBold, color: v3.colors.ink },
  doneText: { ...v3.typography.caption, color: v3.colors.textSecondary, marginTop: 2 },
  security: { backgroundColor: v3.colors.paper, borderRadius: 18, borderWidth: 1, borderColor: v3.colors.line, padding: 15, marginTop: 14 },
  securityTitle: { ...v3.typography.bodyBold, color: v3.colors.ink },
  securityText: { ...v3.typography.caption, color: v3.colors.textSecondary, lineHeight: 17, marginTop: 4 },
})
