import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useColors } from '@/lib/ThemeContext'
import { v2Request } from '@/api/v2-client'
import { v2Jobs } from '@/api/v2-jobs'
import { getActiveCompanyId } from '@/api/companies'

interface TeamMember {
  id: string
  userId: string
  name: string
  role: string
  skills: string[]
  isOnline: boolean
  rating: number
  completedJobs: number
}

interface Job {
  id: string
  title: string
  status: string
  preferredDate: string | null
}

export default function AssignWorkerScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { jobId: requestedJobId } = useLocalSearchParams<{ jobId?: string }>()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [availableJobs, setAvailableJobs] = useState<Job[]>([])
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [requestedJobId])

  const loadData = async () => {
    try {
      const companyId = await getActiveCompanyId()
      if (!companyId) return

      const [teamData, assignmentsData, quotedJobs] = await Promise.all([
        v2Request<{ members: TeamMember[] }>(`/api/mobile/company/team?companyId=${companyId}`),
        v2Request<{ assignments: any[] }>(`/api/mobile/company/assignments?companyId=${companyId}`),
        v2Jobs.list(`myQuotes=true&context=company&companyId=${encodeURIComponent(companyId)}`),
      ])

      const assignedJobIds = new Set(
        (assignmentsData.assignments || [])
          .filter((a: any) => ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(a.status))
          .map((a: any) => a.jobId)
      )

      setWorkers(
        (teamData.members || []).filter(
          (m) => m.role === 'WORKER' || m.role === 'DISPATCHER'
        )
      )

      const eligibleJobs = (quotedJobs.jobs || [])
        .filter((job: any) => job.status === 'QUOTE_ACCEPTED' && !assignedJobIds.has(job.id))
        .map((job: any) => ({
          id: job.id,
          title: job.title,
          status: job.status,
          preferredDate: job.preferredDate,
        }))
      setAvailableJobs(eligibleJobs)

      if (requestedJobId && eligibleJobs.some((job: any) => job.id === requestedJobId)) {
        setSelectedJob(requestedJobId)
      } else if (eligibleJobs.length === 1) {
        setSelectedJob(eligibleJobs[0].id)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleAssign = async () => {
    if (!selectedWorker || !selectedJob) {
      Alert.alert(t('common.error'), 'Select both a worker and a job')
      return
    }

    setSubmitting(true)
    try {
      const companyId = await getActiveCompanyId()
      await v2Request('/api/mobile/company/assign', {
        method: 'POST',
        body: JSON.stringify({
          companyId,
          jobId: selectedJob,
          workerUserId: selectedWorker,
        }),
      })
      Alert.alert(t('common.success'), t('company.workforce.assigned'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ])
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || 'Failed to assign worker')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.amber} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>{t('company.workforce.assignWorker')}</Text>

        <Text style={styles.label}>{t('company.team')} — Worker</Text>
        {workers.length === 0 ? (
          <Text style={styles.emptyText}>No workers available. Invite workers first.</Text>
        ) : (
          workers.map((w) => (
            <TouchableOpacity
              key={w.id}
              style={[styles.optionCard, selectedWorker === w.userId && styles.optionCardActive]}
              onPress={() => setSelectedWorker(w.userId)}
            >
              <View style={styles.optionLeft}>
                <View style={[styles.avatar, { backgroundColor: w.isOnline ? colors.success : colors.muted }]}>
                  <Text style={styles.avatarText}>{w.name?.[0] || '?'}</Text>
                </View>
                <View>
                  <Text style={styles.optionName}>{w.name}</Text>
                  <Text style={styles.optionMeta}>
                    {w.completedJobs} jobs · {w.rating > 0 ? `${w.rating}★` : 'No rating'}
                  </Text>
                </View>
              </View>
              {selectedWorker === w.userId && (
                <Ionicons name="checkmark-circle" size={22} color={colors.amber} />
              )}
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.label}>Accepted Job</Text>
        {availableJobs.length === 0 ? (
          <Text style={styles.emptyText}>No accepted company jobs are waiting for assignment.</Text>
        ) : (
          availableJobs.map((job) => (
            <TouchableOpacity
              key={job.id}
              style={[styles.optionCard, selectedJob === job.id && styles.optionCardActive]}
              onPress={() => setSelectedJob(job.id)}
            >
              <View style={styles.optionLeft}>
                <View style={[styles.avatar, { backgroundColor: colors.companyAccent || colors.amber }]}>
                  <Ionicons name="briefcase-outline" size={20} color={colors.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionName}>{job.title}</Text>
                  <Text style={styles.optionMeta}>
                    {job.preferredDate ? new Date(job.preferredDate).toLocaleDateString() : 'Schedule not set'}
                  </Text>
                </View>
              </View>
              {selectedJob === job.id && (
                <Ionicons name="checkmark-circle" size={22} color={colors.amber} />
              )}
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity
          style={[styles.assignBtn, (!selectedWorker || !selectedJob || submitting) && styles.assignBtnDisabled]}
          onPress={handleAssign}
          disabled={!selectedWorker || !selectedJob || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.assignBtnText}>{t('company.workforce.assignWorker')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 24 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: colors.ink, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 8, marginTop: 16 },
  optionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardActive: { borderColor: colors.amber },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: colors.white },
  optionName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  optionMeta: { fontSize: 12, color: colors.muted },
  assignBtn: {
    backgroundColor: colors.amber,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  assignBtnDisabled: { opacity: 0.5 },
  assignBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 20 },
})
