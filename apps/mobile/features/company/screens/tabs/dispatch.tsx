import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useColors } from '@/lib/ThemeContext'
import { v2Request } from '@/lib/api-v2'
import { getActiveCompanyId } from '@/lib/api'

interface Assignment {
  id: string
  jobId: string
  workerUserId: string
  status: string
  assignedAt: string
  acceptedAt: string | null
  startedAt: string | null
  completedAt: string | null
  job: { id: string; title: string; status: string }
  worker: { id: string; name: string; email: string }
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ASSIGNED: { bg: '#FEF3C7', text: '#D97706' },
  ACCEPTED: { bg: '#DBEAFE', text: '#2563EB' },
  IN_PROGRESS: { bg: '#D1FAE5', text: '#059669' },
  COMPLETED: { bg: '#E0E7FF', text: '#4F46E5' },
  REJECTED: { bg: '#FEE2E2', text: '#DC2626' },
  REVOKED: { bg: '#F3F4F6', text: '#6B7280' },
}

export default function CompanyDispatch() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [filter, setFilter] = useState<string>('active')

  const fetchAssignments = useCallback(async () => {
    try {
      const companyId = await getActiveCompanyId()
      if (!companyId) return
      const params = new URLSearchParams({ companyId })
      if (filter === 'in_progress') params.set('status', 'IN_PROGRESS')
      else if (filter === 'completed') params.set('status', 'COMPLETED')

      try {
        const data = await v2Request<{ assignments: Assignment[] }>(
          `/api/mobile/company/assignments?${params.toString()}`
        )
        const visible = filter === 'active'
          ? (data.assignments || []).filter((a) => ['ASSIGNED', 'ACCEPTED'].includes(a.status))
          : (data.assignments || [])
        setAssignments(visible)
      } catch {
        const own = await v2Request<{ assignments: Assignment[] }>(
          `/api/mobile/worker/assignments?companyId=${encodeURIComponent(companyId)}`
        )
        const visible = (own.assignments || []).filter((a) =>
          filter === 'active'
            ? ['ASSIGNED', 'ACCEPTED'].includes(a.status)
            : filter === 'in_progress'
              ? a.status === 'IN_PROGRESS'
              : false
        )
        setAssignments(visible)
      }
    } catch {
      setAssignments([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter])

  useEffect(() => { fetchAssignments() }, [fetchAssignments])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchAssignments()
  }, [fetchAssignments])

  const filters = [
    { key: 'active', label: t('company.workforce.assigned') },
    { key: 'in_progress', label: t('company.workforce.inProgress') },
    { key: 'completed', label: t('company.workforce.completed') },
  ]

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
      <View style={styles.topBar}>
        <Text style={styles.heading}>{t('company.workforce.dispatch')}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/(company)/workforce/assign')}
        >
          <Text style={styles.addBtnText}>+ {t('company.workforce.assignWorker')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {assignments.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.muted} />
            <Text style={styles.emptyText}>{t('company.workforce.noAssignments')}</Text>
            <Text style={styles.emptyDesc}>{t('company.workforce.noAssignmentsDesc')}</Text>
          </View>
        ) : (
          assignments.map((a) => {
            const statusColor = STATUS_COLORS[a.status] || STATUS_COLORS.ASSIGNED
            return (
              <TouchableOpacity
                key={a.id}
                style={styles.assignmentCard}
                activeOpacity={0.8}
                onPress={() => router.push(`/(company)/workforce/assignment/${a.id}`)}
              >
                <View style={styles.assignmentHeader}>
                  <Text style={styles.jobTitle}>{a.job?.title || 'Job'}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                    <Text style={[styles.statusText, { color: statusColor.text }]}>
                      {t(`company.workforce.${a.status.toLowerCase()}`) || a.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.assignmentWorker}>
                  <Ionicons name="person-outline" size={14} color={colors.muted} />
                  <Text style={styles.workerName}>{a.worker?.name || 'Worker'}</Text>
                </View>
                <Text style={styles.assignmentDate}>
                  {new Date(a.assignedAt).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  heading: { fontSize: 28, fontWeight: '800', color: colors.ink },
  addBtn: {
    backgroundColor: colors.amber,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.amber,
    borderColor: colors.amber,
  },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  filterTextActive: { color: colors.white },
  assignmentCard: {
    backgroundColor: colors.white,
    marginHorizontal: 24,
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  assignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  jobTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, flex: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '600' },
  assignmentWorker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  workerName: { fontSize: 13, color: colors.muted },
  assignmentDate: { fontSize: 11, color: colors.muted },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 16,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 8,
    textAlign: 'center',
  },
})
