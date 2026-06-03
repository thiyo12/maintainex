import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../../../lib/colors'
import { v2Jobs, V2Job } from '../../../../lib/api-v2'

const statusColors: Record<string, string> = {
  OPEN: '#F59E0B',
  IN_PROGRESS: '#3B82F6',
  COMPLETED: '#10B981',
  CANCELLED: '#EF4444',
}

export default function V2MyJobsScreen() {
  const router = useRouter()
  const [jobs, setJobs] = useState<V2Job[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadJobs = useCallback(async () => {
    try {
      const res = await v2Jobs.list()
      setJobs(res.jobs)
    } catch (e) {
      console.error('Load jobs error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  const onRefresh = () => { setRefreshing(true); loadJobs() }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Jobs</Text>
        <TouchableOpacity onPress={() => router.push('/(customer)/jobs/v2/create')} style={styles.createBtn}>
          <Text style={styles.createBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : jobs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No jobs yet</Text>
          <Text style={styles.emptySub}>Post your first job and get quotes from providers</Text>
          <TouchableOpacity onPress={() => router.push('/(customer)/jobs/v2/create')} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>Post a Job</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {jobs.map((job) => (
            <TouchableOpacity key={job.id} style={styles.jobCard} onPress={() => router.push(`/(customer)/jobs/v2/${job.id}`)}>
              <View style={styles.jobHeader}>
                <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColors[job.status] || '#999' }]}>
                  <Text style={styles.statusText}>{job.status.replace('_', ' ')}</Text>
                </View>
              </View>
              <Text style={styles.jobDesc} numberOfLines={2}>{job.description}</Text>
              <View style={styles.jobFooter}>
                <Text style={styles.jobBudget}>{job.budgetType} — LKR {job.budgetAmount}</Text>
                <Text style={styles.jobDate}>{new Date(job.createdAt).toLocaleDateString()}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1a1a1a' },
  createBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  createBtnText: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 24 },
  emptyBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  emptyBtnText: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  list: { flex: 1, padding: 16 },
  jobCard: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 16, marginBottom: 12 },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  jobTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  jobDesc: { fontSize: 13, color: '#666', marginBottom: 10 },
  jobFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  jobBudget: { fontSize: 13, fontWeight: '600', color: colors.primary },
  jobDate: { fontSize: 12, color: '#999' },
})
