import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

export default function TaskerJobsScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<any[]>([])
  const [applying, setApplying] = useState<string | null>(null)

  useEffect(() => {
    fetchJobs()
  }, [])

  const fetchJobs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tasks?status=OPEN`)
      const result = await res.json()
      if (result.success) setJobs(result.data)
    } catch {}
    finally { setLoading(false) }
  }

  const applyToJob = async (taskId: string) => {
    setApplying(taskId)
    try {
      const res = await fetch(`${API_URL}/api/tasks/${taskId}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'I can help with this task. I have experience and available to start immediately.',
        }),
      })

      const data = await res.json()
      if (data.success) {
        Alert.alert('Success', 'Application submitted!')
        fetchJobs()
      } else {
        Alert.alert('Error', data.error || 'Failed to apply')
      }
    } catch {
      Alert.alert('Error', 'Failed to apply')
    } finally {
      setApplying(null)
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Available Jobs</Text>
      </View>

      {jobs.length > 0 ? (
        <ScrollView style={styles.scroll}>
          {jobs.map((job) => (
            <View key={job.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.title}>{job.title}</Text>
                {job.urgency && (
                  <Text style={[styles.urgency, getUrgencyStyle(job.urgency)]}>
                    {job.urgency}
                  </Text>
                )}
              </View>

              <Text style={styles.desc} numberOfLines={2}>{job.description}</Text>

              <View style={styles.meta}>
                {job.budget && (
                  <Text style={styles.budget}>LKR {job.budget.toLocaleString()}</Text>
                )}
                {job.district && (
                  <Text style={styles.location}>📍 {job.district}</Text>
                )}
                {job.category && (
                  <Text style={styles.category}>{job.category.icon} {job.category.name}</Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.applyBtn, applying === job.id && styles.applyBtnDisabled]}
                onPress={() => applyToJob(job.id)}
                disabled={applying === job.id}
              >
                <Text style={styles.applyBtnText}>
                  {applying === job.id ? 'Applying...' : 'Apply Now'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No jobs available right now</Text>
          <Text style={styles.emptySub}>Check back later for new opportunities</Text>
        </View>
      )}
    </View>
  )
}

function getUrgencyStyle(urgency: string) {
  const styles: Record<string, object> = {
    low: { color: '#6B7280', backgroundColor: '#F3F4F6' },
    medium: { color: '#2563EB', backgroundColor: '#DBEAFE' },
    high: { color: '#EA580C', backgroundColor: '#FFF7ED' },
    urgent: { color: '#DC2626', backgroundColor: '#FEF2F2' },
  }
  return styles[urgency] || { color: '#6B7280', backgroundColor: '#F3F4F6' }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, paddingTop: 50, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backText: { fontSize: 14, color: '#6B7280' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginTop: 8 },
  scroll: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  urgency: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  desc: { fontSize: 14, color: '#6B7280', marginTop: 8, lineHeight: 20 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  budget: { fontSize: 15, fontWeight: 'bold', color: '#059669' },
  location: { fontSize: 13, color: '#6B7280' },
  category: { fontSize: 13, color: '#6B7280' },
  applyBtn: { backgroundColor: '#059669', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  applyBtnDisabled: { opacity: 0.5 },
  applyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#9CA3AF' },
})
