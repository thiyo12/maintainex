import { useCallback, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { getActiveCompanyId } from '@/lib/api'
import { v2Request } from '@/lib/api-v2'

interface CompanyAssignment {
  id: string
  status: string
  assignedAt: string
  acceptedAt?: string | null
  startedAt?: string | null
  job: {
    id: string
    title: string
    status: string
    preferredDate?: string | null
    preferredTimeSlot?: string | null
  }
}

export default function TaskerCompanyAssignmentsScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const [assignments, setAssignments] = useState<CompanyAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hasCompany, setHasCompany] = useState(true)

  const load = useCallback(async () => {
    try {
      const companyId = await getActiveCompanyId()
      if (!companyId) {
        setHasCompany(false)
        setAssignments([])
        return
      }
      setHasCompany(true)
      const result = await v2Request<{ assignments: CompanyAssignment[] }>(
        `/api/mobile/worker/assignments?companyId=${encodeURIComponent(companyId)}`
      )
      setAssignments(result.assignments || [])
    } catch {
      setAssignments([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 80 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Company Assignments</Text>
        <View style={{ width: 40 }} />
      </View>

      {!hasCompany ? (
        <View style={styles.empty}>
          <Ionicons name="business-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>No active company membership</Text>
          <Text style={styles.emptyText}>When you join a company team, assigned jobs will appear here.</Text>
        </View>
      ) : assignments.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="briefcase-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>No active assignments</Text>
          <Text style={styles.emptyText}>New company jobs assigned to you will appear here.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load() }}
              tintColor={colors.amber}
            />
          }
        >
          {assignments.map((assignment) => (
            <TouchableOpacity
              key={assignment.id}
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => {
                if (assignment.status === 'ASSIGNED') {
                  router.push(`/(company)/workforce/assignment/${assignment.id}` as any)
                } else {
                  router.push(`/(company)/jobs/v2/manage/${assignment.job.id}` as any)
                }
              }}
            >
              <View style={styles.cardTop}>
                <Text style={styles.jobTitle} numberOfLines={2}>{assignment.job.title}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{assignment.status.replace('_', ' ')}</Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {assignment.job.preferredDate
                  ? new Date(assignment.job.preferredDate).toLocaleDateString()
                  : 'Schedule not set'}
                {assignment.job.preferredTimeSlot ? ` · ${assignment.job.preferredTimeSlot}` : ''}
              </Text>
              <View style={styles.actionRow}>
                <Text style={styles.actionText}>
                  {assignment.status === 'ASSIGNED'
                    ? 'Review & respond'
                    : assignment.status === 'ACCEPTED'
                      ? 'Open & verify arrival'
                      : 'Open active job'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.amberDark} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  title: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.ink },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  jobTitle: { flex: 1, fontSize: 16, fontFamily: fonts.headingBold, color: colors.ink },
  statusBadge: { backgroundColor: colors.amberBg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 10, fontFamily: fonts.bodyMedium, color: colors.amberDark },
  meta: { marginTop: 8, fontSize: 12, fontFamily: fonts.body, color: colors.muted },
  actionRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.amberDark },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { marginTop: 14, fontSize: 17, fontFamily: fonts.headingBold, color: colors.ink },
  emptyText: { marginTop: 6, fontSize: 13, fontFamily: fonts.body, color: colors.muted, textAlign: 'center', lineHeight: 19 },
})
