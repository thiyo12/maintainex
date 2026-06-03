import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, TextInput } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../../../lib/colors'
import { v2Jobs, v2JobActions, V2Job, V2Quote } from '../../../../lib/api-v2'

export default function V2JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<V2Job | null>(null)
  const [quotes, setQuotes] = useState<V2Quote[]>([])
  const [escrow, setEscrow] = useState<any>(null)
  const [workspace, setWorkspace] = useState<any>(null)
  const [reviews, setReviews] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')

  const [showAddressForm, setShowAddressForm] = useState(false)
  const [addressStreet, setAddressStreet] = useState('')
  const [addressBuilding, setAddressBuilding] = useState('')
  const [addressApartment, setAddressApartment] = useState('')
  const [addressLandmark, setAddressLandmark] = useState('')

  const loadJob = async () => {
    try {
      const res = await v2Jobs.get(id)
      setJob(res.job)
      setQuotes(res.job.quotes || [])
      setEscrow(res.job.escrow || null)
      setWorkspace(res.job.workspace || null)
      setReviews(res.job.reviews || null)
    } catch (e) {
      Alert.alert('Error', 'Failed to load job')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadJob() }, [id])

  const handleSelectQuote = async (quoteId: string) => {
    setActionLoading(quoteId)
    try {
      await v2JobActions.selectQuote(id, quoteId)
      Alert.alert('Success', 'Quote accepted! Now deposit escrow to start.')
      loadJob()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleDepositEscrow = async () => {
    if (!job) return
    setActionLoading('escrow')
    try {
      await v2JobActions.depositEscrow(id, job.budgetAmount)
      Alert.alert('Success', 'Escrow deposited! Now share your address.')
      loadJob()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleShareAddress = async () => {
    setActionLoading('address')
    try {
      await v2JobActions.shareAddress(id, {
        street: addressStreet,
        building: addressBuilding,
        apartment: addressApartment,
        landmark: addressLandmark,
      })
      Alert.alert('Success', 'Address shared with provider')
      loadJob()
      setShowAddressForm(false)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleApproveCompletion = async () => {
    setActionLoading('approve')
    try {
      const res = await v2JobActions.complete(id, 'APPROVE_COMPLETION')
      Alert.alert('Success', res.message || 'Job completed!')
      loadJob()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleReleaseEscrow = async () => {
    setActionLoading('release')
    try {
      await v2JobActions.releaseEscrow(id)
      Alert.alert('Success', 'Escrow released to provider')
      loadJob()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setActionLoading('')
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  if (!job) return null

  const renderActionButton = (label: string, key: string, onPress: () => void, color?: string) => (
    <TouchableOpacity
      style={[styles.actionBtn, color ? { backgroundColor: color } : null]}
      onPress={onPress}
      disabled={actionLoading !== ''}
    >
      {actionLoading === key ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.actionBtnText}>{label}</Text>
      )}
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{job.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[job.status] || '#999' }]}>
          <Text style={styles.statusText}>{job.status}</Text>
        </View>

        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.desc}>{job.description}</Text>

        <Text style={styles.sectionTitle}>Budget</Text>
        <Text style={styles.budget}>{job.budgetType} — LKR {job.budgetAmount}</Text>

        {job.locationName && (
          <>
            <Text style={styles.sectionTitle}>Location</Text>
            <Text style={styles.budget}>{job.locationName}</Text>
          </>
        )}

        {/* Customer actions based on job status */}
        <View style={styles.actionsSection}>
          {job.status === 'OPEN' && quotes.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Quotes Received ({quotes.length})</Text>
              {quotes.map((q) => (
                <View key={q.id} style={styles.quoteCard}>
                  <View style={styles.quoteHeader}>
                    <Text style={styles.quoteProvider}>{q.provider?.name || 'Provider'}</Text>
                    <Text style={styles.quotePrice}>LKR {q.price}</Text>
                  </View>
                  <Text style={styles.quoteMeta}>
                    {q.providerType} • {q.estimatedCompletionTime}
                  </Text>
                  {q.message ? <Text style={styles.quoteMsg}>{q.message}</Text> : null}
                  {q.status === 'PENDING' && (
                    renderActionButton('Accept Quote', q.id, () => handleSelectQuote(q.id))
                  )}
                </View>
              ))}
            </>
          )}

          {job.status === 'IN_PROGRESS' && !escrow && (
            <View style={styles.actionCard}>
              <Text style={styles.actionTitle}>Deposit Escrow</Text>
              <Text style={styles.actionDesc}>Deposit LKR {job.budgetAmount} to secure the job</Text>
              {renderActionButton(`Deposit LKR ${job.budgetAmount}`, 'escrow', handleDepositEscrow)}
            </View>
          )}

          {escrow && escrow.status === 'PROTECTED' && !job.addressSharedAt && (
            <View style={styles.actionCard}>
              <Text style={styles.actionTitle}>Share Your Address</Text>
              <Text style={styles.actionDesc}>Let the provider know where to go</Text>
              {!showAddressForm ? (
                <TouchableOpacity style={styles.actionBtn} onPress={() => setShowAddressForm(true)}>
                  <Text style={styles.actionBtnText}>Share Address</Text>
                </TouchableOpacity>
              ) : (
                <View>
                  <TextInput style={styles.input} value={addressStreet} onChangeText={setAddressStreet} placeholder="Street address" placeholderTextColor="#999" />
                  <TextInput style={styles.input} value={addressBuilding} onChangeText={setAddressBuilding} placeholder="Building (optional)" placeholderTextColor="#999" />
                  <TextInput style={styles.input} value={addressApartment} onChangeText={setAddressApartment} placeholder="Apartment/Unit (optional)" placeholderTextColor="#999" />
                  <TextInput style={styles.input} value={addressLandmark} onChangeText={setAddressLandmark} placeholder="Landmark (optional)" placeholderTextColor="#999" />
                  {renderActionButton('Save Address', 'address', handleShareAddress)}
                </View>
              )}
            </View>
          )}

          {workspace && workspace.progressStatus === 'COMPLETION_REQUESTED' && (
            <View style={styles.actionCard}>
              <Text style={styles.actionTitle}>Approve Completion</Text>
              <Text style={styles.actionDesc}>The provider has marked the job as complete. Review and approve to release payment.</Text>
              {renderActionButton('Approve & Release Payment', 'approve', handleApproveCompletion, '#10B981')}
            </View>
          )}

          {escrow && escrow.status === 'PROTECTED' && (
            <View style={styles.actionCard}>
              <Text style={styles.actionTitle}>Escrow Status</Text>
              <Text style={styles.actionDesc}>LKR {escrow.amount} protected in escrow</Text>
              {renderActionButton('Release Escrow Manually', 'release', handleReleaseEscrow, '#EF4444')}
            </View>
          )}
        </View>

        {/* Reviews */}
        {reviews && (
          <>
            {reviews.customerReviews?.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Provider Reviews</Text>
                {reviews.customerReviews.map((r: any) => (
                  <View key={r.id} style={styles.reviewCard}>
                    <Text style={styles.reviewRating}>Quality: {r.quality}/5 • Communication: {r.communication}/5 • Timeliness: {r.timeliness}/5</Text>
                    {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
                  </View>
                ))}
              </>
            )}
          </>
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
  CANCELLED: '#EF4444',
  DISPUTED: '#EF4444',
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 20 },
  statusText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginTop: 20, marginBottom: 8 },
  desc: { fontSize: 14, color: '#666', lineHeight: 22 },
  budget: { fontSize: 16, fontWeight: '600', color: colors.primary },
  actionsSection: { marginTop: 10 },
  quoteCard: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 16, marginBottom: 10 },
  quoteHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  quoteProvider: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  quotePrice: { fontSize: 16, fontWeight: '800', color: colors.primary },
  quoteMeta: { fontSize: 12, color: '#999', marginBottom: 6 },
  quoteMsg: { fontSize: 13, color: '#666', marginBottom: 8 },
  actionCard: { backgroundColor: '#f0f7ff', borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#dbeafe' },
  actionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  actionDesc: { fontSize: 13, color: '#666', marginBottom: 12 },
  actionBtn: { backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  input: { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, fontSize: 14, color: '#333', marginBottom: 8, backgroundColor: '#fff' },
  reviewCard: { backgroundColor: '#f9f9f9', borderRadius: 10, padding: 12, marginBottom: 8 },
  reviewRating: { fontSize: 13, color: '#666' },
  reviewComment: { fontSize: 13, color: '#333', marginTop: 4 },
})
