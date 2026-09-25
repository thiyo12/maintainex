import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useColors } from '../../../../lib/ThemeContext'
import { v2Request } from '../../../../lib/api-v2'

interface AssignmentDetail {
  id: string
  jobId: string
  workerUserId: string
  assignedBy: string
  status: string
  assignedAt: string
  acceptedAt: string | null
  startedAt: string | null
  completedAt: string | null
  rejectedAt: string | null
  revokedAt: string | null
  revokedReason: string | null
  rejectReason: string | null
  job: { id: string; title: string; status: string }
  worker: { id: string; name: string; email: string }
  company: { id: string; companyName: string }
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  ASSIGNED: { color: '#D97706', bg: '#FEF3C7', icon: 'time-outline' },
  ACCEPTED: { color: '#2563EB', bg: '#DBEAFE', icon: 'checkmark-circle-outline' },
  IN_PROGRESS: { color: '#059669', bg: '#D1FAE5', icon: 'play-circle-outline' },
  COMPLETED: { color: '#4F46E5', bg: '#E0E7FF', icon: 'ribbon-outline' },
  REJECTED: { color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle-outline' },
  REVOKED: { color: '#6B7280', bg: '#F3F4F6', icon: 'ban-outline' },
}

export default function AssignmentDetailScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [loading, setLoading] = useState(true)
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (id) fetchAssignment()
  }, [id])

  const fetchAssignment = async () => {
    try {
      const data = await v2Request<AssignmentDetail>(`/api/mobile/company/assignments/${id}`)
      setAssignment(data)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action: string, reason?: string) => {
    setActionLoading(true)
    try {
      await v2Request(`/api/mobile/company/assignments/${id}`, {
        method: 'POST',
        body: JSON.stringify({ action, reason }),
      })
      await fetchAssignment()
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  const confirmAction = (action: string, message: string) => {
    Alert.alert(t('common.confirm'), message, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.ok'), onPress: () => handleAction(action) },
    ])
  }

  if (loading || !assignment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.amber} />
        </View>
      </SafeAreaView>
    )
  }

  const statusConfig = STATUS_CONFIG[assignment.status] || STATUS_CONFIG.ASSIGNED

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.statusBanner, { backgroundColor: statusConfig.bg }]}>
          <Ionicons name={statusConfig.icon as any} size={20} color={statusConfig.color} />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {t(`company.workforce.${assignment.status.toLowerCase()}`) || assignment.status}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Job</Text>
          <Text style={styles.cardValue}>{assignment.job?.title || 'Job'}</Text>
          <Text style={styles.cardMeta}>Status: {assignment.job?.status}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Worker</Text>
          <Text style={styles.cardValue}>{assignment.worker?.name || 'Worker'}</Text>
          <Text style={styles.cardMeta}>{assignment.worker?.email}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Timeline</Text>
          <View style={styles.timelineItem}>
            <Text style={styles.timelineLabel}>Assigned</Text>
            <Text style={styles.timelineValue}>{new Date(assignment.assignedAt).toLocaleString()}</Text>
          </View>
          {assignment.acceptedAt && (
            <View style={styles.timelineItem}>
              <Text style={styles.timelineLabel}>Accepted</Text>
              <Text style={styles.timelineValue}>{new Date(assignment.acceptedAt).toLocaleString()}</Text>
            </View>
          )}
          {assignment.completedAt && (
            <View style={styles.timelineItem}>
              <Text style={styles.timelineLabel}>Completed</Text>
              <Text style={styles.timelineValue}>{new Date(assignment.completedAt).toLocaleString()}</Text>
            </View>
          )}
          {assignment.revokedAt && (
            <View style={styles.timelineItem}>
              <Text style={styles.timelineLabel}>Revoked</Text>
              <Text style={styles.timelineValue}>{new Date(assignment.revokedAt).toLocaleString()}</Text>
            </View>
          )}
          {assignment.revokedReason && (
            <Text style={styles.reasonText}>Reason: {assignment.revokedReason}</Text>
          )}
        </View>

        <View style={styles.actions}>
          {assignment.status === 'ASSIGNED' && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.acceptBtn]}
                onPress={() => handleAction('accept')}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.actionBtnText}>{t('company.workforce.accept')}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => confirmAction('reject', t('company.workforce.confirmReject'))}
                disabled={actionLoading}
              >
                <Text style={[styles.actionBtnText, { color: '#DC2626' }]}>{t('company.workforce.reject')}</Text>
              </TouchableOpacity>
            </>
          )}

          {['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(assignment.status) && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.revokeBtn]}
              onPress={() => confirmAction('revoke', t('company.workforce.confirmRevoke'))}
              disabled={actionLoading}
            >
              <Text style={[styles.actionBtnText, { color: '#6B7280' }]}>{t('company.workforce.revoke')}</Text>
            </TouchableOpacity>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 24 },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  statusText: { fontSize: 15, fontWeight: '700' },
  card: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  cardLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', marginBottom: 4 },
  cardValue: { fontSize: 16, fontWeight: '700', color: colors.ink },
  cardMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  timelineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timelineLabel: { fontSize: 13, color: colors.muted },
  timelineValue: { fontSize: 13, fontWeight: '600', color: colors.ink },
  reasonText: { fontSize: 13, color: '#DC2626', marginTop: 8, fontStyle: 'italic' },
  actions: { marginTop: 8, gap: 10 },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptBtn: { backgroundColor: colors.amber },
  rejectBtn: { backgroundColor: '#FEE2E2' },
  revokeBtn: { backgroundColor: '#F3F4F6' },
  completeBtn: { backgroundColor: '#059669' },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
})
