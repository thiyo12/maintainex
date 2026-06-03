import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, TextInput } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../../../../lib/colors'
import { v2Jobs, v2JobActions, V2Job } from '../../../../../lib/api-v2'

export default function V2ProviderManageJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<V2Job | null>(null)
  const [workspace, setWorkspace] = useState<any>(null)
  const [escrow, setEscrow] = useState<any>(null)
  const [reviews, setReviews] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')

  const [reviewQuality, setReviewQuality] = useState('5')
  const [reviewComm, setReviewComm] = useState('5')
  const [reviewExp, setReviewExp] = useState('5')
  const [reviewComment, setReviewComment] = useState('')

  const loadJob = async () => {
    try {
      const res = await v2Jobs.get(id)
      setJob(res.job)
      setWorkspace(res.job.workspace || null)
      setEscrow(res.job.escrow || null)
      setReviews(res.job.reviews || null)
    } catch (e) {
      Alert.alert('Error', 'Failed to load job')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadJob() }, [id])

  const handleMarkComplete = async () => {
    setActionLoading('complete')
    try {
      await v2JobActions.markComplete(id, 'MARK_COMPLETE')
      Alert.alert('Success', 'Marked complete! Waiting for customer approval.')
      loadJob()
    } catch (e: any) { Alert.alert('Error', e.message) }
    finally { setActionLoading('') }
  }

  const handleUpdateProgress = async (status: string) => {
    setActionLoading(status)
    try {
      await v2JobActions.updateProgress(id, status)
      loadJob()
    } catch (e: any) { Alert.alert('Error', e.message) }
    finally { setActionLoading('') }
  }

  const handleSubmitReview = async () => {
    setActionLoading('review')
    try {
      await v2JobActions.createReview(id, {
        reviewType: 'PROVIDER_REVIEWS_CUSTOMER',
        cooperation: parseInt(reviewCoop),
        communication: parseInt(reviewComm),
        overallExperience: parseInt(reviewExp),
        comment: reviewComment || undefined,
      })
      Alert.alert('Success', 'Review submitted')
      loadJob()
    } catch (e: any) { Alert.alert('Error', e.message) }
    finally { setActionLoading('') }
  }

  const [reviewCoop, setReviewCoop] = useState('5')

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  if (!job) return null

  const actionBtn = (label: string, key: string, onPress: () => void, color?: string) => (
    <TouchableOpacity
      style={[styles.actionBtn, color ? { backgroundColor: color } : null]}
      onPress={onPress}
      disabled={actionLoading !== ''}
    >
      {actionLoading === key ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>{label}</Text>}
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{job.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[job.status] || '#999' }]}>
          <Text style={styles.statusText}>{job.status}</Text>
        </View>

        <Text style={styles.sectionTitle}>Job Details</Text>
        <Text style={styles.desc}>{job.description}</Text>
        <Text style={styles.budget}>Budget: {job.budgetType} — LKR {job.budgetAmount}</Text>
        {job.locationName && <Text style={styles.location}>Location: {job.locationName}</Text>}

        {job.addressStreet && (
          <>
            <Text style={styles.sectionTitle}>Customer Address</Text>
            <Text style={styles.desc}>
              {job.addressStreet}{job.addressBuilding ? `, ${job.addressBuilding}` : ''}
              {job.addressApartment ? `, ${job.addressApartment}` : ''}
              {job.addressLandmark ? ` (${job.addressLandmark})` : ''}
            </Text>
          </>
        )}

        {escrow && (
          <>
            <Text style={styles.sectionTitle}>Escrow</Text>
            <Text style={styles.desc}>LKR {escrow.amount} — {escrow.status}</Text>
          </>
        )}

        {workspace && (
          <>
            <Text style={styles.sectionTitle}>Progress</Text>
            <Text style={styles.desc}>Status: {workspace.progressStatus}</Text>

            <View style={styles.actionsSection}>
              {workspace.progressStatus === 'ACCEPTED' && (
                actionBtn('Start Job', 'IN_PROGRESS', () => handleUpdateProgress('IN_PROGRESS'))
              )}
              {workspace.progressStatus === 'IN_PROGRESS' && (
                actionBtn('Request Completion', 'COMPLETION_REQUESTED', () => handleUpdateProgress('COMPLETION_REQUESTED'))
              )}
            </View>
          </>
        )}

        {/* Provider can mark complete if escrow is deposited */}
        {job.status === 'IN_PROGRESS' && escrow?.status === 'PROTECTED' && (
          <View style={styles.actionCard}>
            <Text style={styles.actionTitle}>Finish Job</Text>
            <Text style={styles.actionDesc}>Mark the job as complete and request customer approval for payment release</Text>
            {actionBtn('Mark Complete', 'complete', handleMarkComplete)}
          </View>
        )}

        {/* Review customer */}
        {job.status === 'COMPLETED' && reviews?.providerReviews?.length === 0 && (
          <View style={styles.actionCard}>
            <Text style={styles.actionTitle}>Review Customer</Text>
            <Text style={styles.label}>Cooperation (1-5)</Text>
            <TextInput style={styles.input} value={reviewCoop} onChangeText={setReviewCoop} keyboardType="numeric" placeholderTextColor="#999" />
            <Text style={styles.label}>Communication (1-5)</Text>
            <TextInput style={styles.input} value={reviewComm} onChangeText={setReviewComm} keyboardType="numeric" placeholderTextColor="#999" />
            <Text style={styles.label}>Overall Experience (1-5)</Text>
            <TextInput style={styles.input} value={reviewExp} onChangeText={setReviewExp} keyboardType="numeric" placeholderTextColor="#999" />
            <Text style={styles.label}>Comment (optional)</Text>
            <TextInput style={[styles.input, styles.textArea]} value={reviewComment} onChangeText={setReviewComment} multiline placeholderTextColor="#999" />
            {actionBtn('Submit Review', 'review', handleSubmitReview)}
          </View>
        )}

        {job.status === 'COMPLETED' && reviews?.providerReviews?.length > 0 && (
          <Text style={styles.reviewed}>You've already reviewed this customer.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const statusColors: Record<string, string> = {
  OPEN: '#F59E0B',
  IN_PROGRESS: '#3B82F6',
  QUOTE_ACCEPTED: '#8B5CF6',
  ESCROW_DEPOSITED: '#06B6D4',
  COMPLETED: '#10B981',
  COMPLETION_PENDING: '#F59E0B',
  CANCELLED: '#EF4444',
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 16 },
  statusText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginTop: 20, marginBottom: 8 },
  desc: { fontSize: 14, color: '#666', lineHeight: 22 },
  budget: { fontSize: 15, fontWeight: '600', color: colors.primary, marginTop: 8 },
  location: { fontSize: 14, color: '#666', marginTop: 4 },
  actionsSection: { marginTop: 12, gap: 10 },
  actionCard: { backgroundColor: '#f0f7ff', borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#dbeafe' },
  actionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  actionDesc: { fontSize: 13, color: '#666', marginBottom: 12 },
  actionBtn: { backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, fontSize: 14, color: '#333', backgroundColor: '#fff' },
  textArea: { height: 80, textAlignVertical: 'top' },
  reviewed: { fontSize: 14, color: '#10B981', textAlign: 'center', marginTop: 20, fontWeight: '600' },
})
