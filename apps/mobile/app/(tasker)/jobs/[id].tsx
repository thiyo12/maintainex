import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { jobs as jobsApi } from '../../../lib/api'
import { JobPosting, Bid } from '../../../lib/types'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  background: '#F9FAFB',
  white: '#FFFFFF',
  green: '#10B981',
}

export default function TaskerJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<JobPosting | null>(null)
  const [loading, setLoading] = useState(true)
  const [bidAmount, setBidAmount] = useState('')
  const [bidMessage, setBidMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [hasBid, setHasBid] = useState(false)

  useEffect(() => {
    if (id) {
      jobsApi.get(id)
        .then(job => {
          setJob(job)
          setBidAmount(job.budget?.toString() || '')
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [id])

  const handleBid = async () => {
    if (!bidAmount) {
      Alert.alert('Error', 'Enter your bid amount')
      return
    }
    setSubmitting(true)
    try {
      await jobsApi.bid(id!, { amount: parseInt(bidAmount), message: bidMessage })
      setHasBid(true)
      Alert.alert('Bid Placed!', 'Your bid has been submitted.')
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!job) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text>Job not found</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>{job.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: job.status === 'OPEN' ? colors.green : colors.gray }]}>
          <Text style={styles.statusText}>{job.status}</Text>
        </View>
      </View>

      <Text style={styles.budget}>Budget: LKR {job.budget?.toLocaleString()}</Text>
      <Text style={styles.location}>📍 {job.location}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{job.description}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Posted by</Text>
        <Text style={styles.customerName}>{job.customer?.name}</Text>
      </View>

      {job.status === 'OPEN' && !hasBid && (
        <View style={styles.bidSection}>
          <Text style={styles.sectionTitle}>Place a Bid</Text>

          <Text style={styles.label}>Your bid (LKR) *</Text>
          <TextInput
            style={styles.input}
            value={bidAmount}
            onChangeText={setBidAmount}
            placeholder="5000"
            keyboardType="number-pad"
          />

          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bidMessage}
            onChangeText={setBidMessage}
            placeholder="Tell the customer why you're the best choice..."
            multiline numberOfLines={3}
          />

          <TouchableOpacity
            style={[styles.bidButton, submitting && styles.buttonDisabled]}
            onPress={handleBid}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.dark} />
            ) : (
              <Text style={styles.bidButtonText}>Submit Bid</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {hasBid && (
        <View style={styles.bidPlaced}>
          <Text style={styles.bidPlacedText}>✓ Your bid has been placed!</Text>
        </View>
      )}

      {(job.status === 'ASSIGNED' || job.status === 'IN_PROGRESS') && (
        <View style={styles.actionSection}>
          {job.status === 'ASSIGNED' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={async () => {
                try {
                  await jobsApi.start(id!)
                  const updated = await jobsApi.get(id!)
                  setJob(updated)
                } catch {}
              }}
            >
              <Text style={styles.actionButtonText}>Start Job</Text>
            </TouchableOpacity>
          )}
          {job.status === 'IN_PROGRESS' && (
            <>
              <Text style={styles.trackingHint}>📍 Live tracking active</Text>
              <TouchableOpacity
                style={[styles.actionButton, styles.completeButton]}
                onPress={async () => {
                  try {
                    await jobsApi.complete(id!)
                    const updated = await jobsApi.get(id!)
                    setJob(updated)
                  } catch {}
                }}
              >
                <Text style={styles.actionButtonText}>Mark Complete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600', marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: colors.dark, flex: 1, marginRight: 12 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '700', color: colors.white },
  budget: { fontSize: 20, fontWeight: '800', color: colors.primary, marginBottom: 4 },
  location: { fontSize: 14, color: colors.gray, marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.dark, marginBottom: 12 },
  description: { fontSize: 15, color: colors.gray, lineHeight: 22 },
  customerName: { fontSize: 15, color: colors.dark, fontWeight: '600' },
  bidSection: { marginTop: 8 },
  label: { fontSize: 14, fontWeight: '600', color: colors.dark, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lightGray,
    borderRadius: 12, padding: 14, fontSize: 15, color: colors.dark,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  bidButton: {
    backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  bidButtonText: { fontSize: 18, fontWeight: '700', color: colors.dark },
  bidPlaced: {
    backgroundColor: '#D1FAE5', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16,
  },
  bidPlacedText: { fontSize: 16, fontWeight: '600', color: colors.green },
  actionSection: { marginTop: 16, gap: 12 },
  actionButton: {
    backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center',
  },
  completeButton: { backgroundColor: colors.green },
  actionButtonText: { fontSize: 16, fontWeight: '700', color: colors.white },
  trackingHint: { textAlign: 'center', fontSize: 14, color: colors.gray },
})
