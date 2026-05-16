import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert,
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

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<JobPosting | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      jobsApi.get(id)
        .then(setJob)
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [id])

  const handleAcceptBid = async (taskerId: string) => {
    try {
      await jobsApi.assign(id!, taskerId)
      const updated = await jobsApi.get(id!)
      setJob(updated)
      Alert.alert('Assigned!', 'Tasker has been assigned to this job.')
    } catch (err: any) {
      Alert.alert('Error', err.message)
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

      <Text style={styles.budget}>LKR {job.budget?.toLocaleString()}</Text>
      <Text style={styles.location}>📍 {job.location}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{job.description}</Text>
      </View>

      {job.status === 'OPEN' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bids ({job.bids?.length || 0})</Text>
          {job.bids?.length === 0 ? (
            <Text style={styles.emptyBids}>No bids yet. Check back soon.</Text>
          ) : (
            job.bids?.map((bid: Bid) => (
              <View key={bid.id} style={styles.bidCard}>
                <View style={styles.bidHeader}>
                  <Text style={styles.bidderName}>{bid.tasker?.user?.name || 'Tasker'}</Text>
                  <Text style={styles.bidAmount}>LKR {bid.amount?.toLocaleString()}</Text>
                </View>
                <Text style={styles.bidMessage}>{bid.message}</Text>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => handleAcceptBid(bid.taskerId)}
                >
                  <Text style={styles.acceptButtonText}>Accept Bid</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}

      {(job.status === 'ASSIGNED' || job.status === 'IN_PROGRESS') && job.assignedTasker && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assigned Tasker</Text>
          <View style={styles.taskerCard}>
            <Text style={styles.taskerName}>{job.assignedTasker.user?.name}</Text>
            <Text style={styles.taskerInfo}>⭐ {job.assignedTasker.rating} • {job.assignedTasker.completedJobs} jobs</Text>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={() => router.push(`/(customer)/jobs/${id}`)}>
        <Text style={styles.buttonText}>Refresh</Text>
      </TouchableOpacity>
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
  budget: { fontSize: 22, fontWeight: '800', color: colors.primary, marginBottom: 4 },
  location: { fontSize: 14, color: colors.gray, marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.dark, marginBottom: 12 },
  description: { fontSize: 15, color: colors.gray, lineHeight: 22 },
  emptyBids: { color: colors.gray, fontSize: 14, fontStyle: 'italic' },
  bidCard: {
    backgroundColor: colors.white, borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: colors.lightGray,
  },
  bidHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  bidderName: { fontSize: 15, fontWeight: '700', color: colors.dark },
  bidAmount: { fontSize: 15, fontWeight: '800', color: colors.primary },
  bidMessage: { fontSize: 13, color: colors.gray, marginBottom: 12 },
  acceptButton: {
    backgroundColor: colors.primary, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
  },
  acceptButtonText: { fontSize: 14, fontWeight: '700', color: colors.dark },
  taskerCard: {
    backgroundColor: colors.white, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: colors.lightGray,
  },
  taskerName: { fontSize: 16, fontWeight: '700', color: colors.dark, marginBottom: 4 },
  taskerInfo: { fontSize: 13, color: colors.gray },
  button: {
    backgroundColor: colors.lightGray, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '600', color: colors.dark },
})
