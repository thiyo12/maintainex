import { useCallback, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { getActiveCompanyId } from '@/api/companies'
import { v2Request } from '@/api/v2-client'

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

interface CrewInvitation {
  assignmentId: string
  status: 'CREW_RESERVED' | 'CREW_ACCEPTED'
  companyName: string
  job: {
    title: string
    countryCode: string
    preferredDate?: string | null
    preferredTimeSlot?: string | null
  }
  crew: { id: string; status: string; version: number; requiredWorkersCount: number } | null
  dispatchEnabled: false
}

export default function TaskerCompanyAssignmentsScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const [assignments, setAssignments] = useState<CompanyAssignment[]>([])
  const [crewInvitations, setCrewInvitations] = useState<CrewInvitation[]>([])
  const [crewBusyId, setCrewBusyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hasCompany, setHasCompany] = useState(true)

  const load = useCallback(async () => {
    try {
      const companyId = await getActiveCompanyId()
      if (!companyId) {
        setHasCompany(false)
        setAssignments([])
        setCrewInvitations([])
        return
      }
      setHasCompany(true)
      const [result, crewResult] = await Promise.all([
        v2Request<{ assignments: CompanyAssignment[] }>(
          `/api/mobile/worker/assignments?companyId=${encodeURIComponent(companyId)}`,
        ),
        v2Request<{ invitations: CrewInvitation[] }>('/api/mobile/worker/crew')
          .catch(() => ({ invitations: [] as CrewInvitation[] })),
      ])
      setAssignments(result.assignments || [])
      // The crew API is scoped to the signed-in worker. Never display another
      // worker's roster or expose crew PIN/start controls from this screen.
      setCrewInvitations((crewResult.invitations || []).filter(invitation =>
        invitation.crew?.status === 'FORMING' &&
        ['CREW_RESERVED', 'CREW_ACCEPTED'].includes(invitation.status)
      ))
    } catch {
      setAssignments([])
      setCrewInvitations([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const respondToCrew = async (
    invitation: CrewInvitation,
    action: 'accept' | 'reject',
  ) => {
    if (!invitation.crew || crewBusyId) return
    setCrewBusyId(invitation.crew.id)
    try {
      await v2Request('/api/mobile/worker/crew', {
        method: 'POST',
        body: JSON.stringify({
          crewDispatchId: invitation.crew.id,
          expectedVersion: invitation.crew.version,
          action,
        }),
      })
      await load()
      Alert.alert(
        action === 'accept' ? 'Invitation accepted' : 'Crew invitation declined',
        action === 'accept'
          ? 'Your response is recorded. Work and arrival remain blocked until the entire crew is confirmed.'
          : 'The staged crew is blocked and all reserved slots have been released.',
      )
    } catch (error: any) {
      Alert.alert('Crew invitation changed', error?.message || 'Refresh and try again.')
      await load()
    } finally {
      setCrewBusyId(null)
    }
  }

  const confirmDeclineCrew = (invitation: CrewInvitation) => Alert.alert(
    'Decline this crew?',
    'Declining releases the entire crew reservation. It does not cancel the customer booking.',
    [
      { text: 'Keep invitation', style: 'cancel' },
      { text: 'Decline crew', style: 'destructive', onPress: () => { void respondToCrew(invitation, 'reject') } },
    ],
  )

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
      ) : assignments.length === 0 && crewInvitations.length === 0 ? (
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
          {crewInvitations.length > 0 ? (
            <View style={styles.crewSection}>
              <Text style={styles.crewHeading}>Pending company crew</Text>
              <Text style={styles.crewNote}>
                Invitation only. Even after acceptance, no crew member may start work,
                verify arrival or request a PIN until all identity and safety checks are complete.
              </Text>
              {crewInvitations.map(invitation => (
                <View key={invitation.assignmentId} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.jobTitle}>{invitation.job.title}</Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>
                        {invitation.status === 'CREW_ACCEPTED' ? 'Response recorded' : 'Awaiting your response'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.meta}>
                    {invitation.companyName} · {invitation.crew?.requiredWorkersCount || 0} workers
                  </Text>
                  <Text style={styles.crewNote}>Crew status: FORMING · Dispatch not enabled</Text>
                  {invitation.status === 'CREW_RESERVED' ? (
                    <View style={styles.crewActions}>
                      <TouchableOpacity style={styles.crewAccept} disabled={!!crewBusyId}
                        onPress={() => { void respondToCrew(invitation, 'accept') }}>
                        <Text style={styles.crewAcceptText}>Accept invitation</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.crewDecline} disabled={!!crewBusyId}
                        onPress={() => confirmDeclineCrew(invitation)}>
                        <Text style={styles.crewDeclineText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
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
  crewSection: { gap: 10 },
  crewHeading: { fontSize: 17, fontFamily: fonts.headingBold, color: colors.ink },
  crewNote: { marginTop: 5, fontSize: 12, fontFamily: fonts.body, color: colors.muted, lineHeight: 18 },
  crewActions: { flexDirection: 'row', gap: 12, marginTop: 14 },
  crewAccept: { flex: 1, backgroundColor: colors.ink, borderRadius: 12, padding: 12, alignItems: 'center' },
  crewAcceptText: { color: colors.white, fontFamily: fonts.bodyMedium, fontSize: 12 },
  crewDecline: { borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12 },
  crewDeclineText: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 12 },
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
