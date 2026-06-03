import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../../../lib/colors'
import { v2Jobs, V2Job } from '../../../../lib/api-v2'

export default function V2BrowseJobsScreen() {
  const router = useRouter()
  const [jobs, setJobs] = useState<V2Job[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadJobs = useCallback(async () => {
    try {
      const res = await v2Jobs.list('role=provider')
      setJobs(res.jobs)
    } catch (e) {
      console.error('Browse jobs error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Open Jobs</Text>
        <Text style={styles.headerCount}>{jobs.length} available</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : jobs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No open jobs</Text>
          <Text style={styles.emptySub}>Check back later for new job postings</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadJobs} tintColor={colors.primary} />}
        >
          {jobs.map((job) => (
            <TouchableOpacity
              key={job.id}
              style={styles.jobCard}
              onPress={() => router.push(`/(tasker)/jobs/v2/quote/${job.id}`)}
            >
              <View style={styles.jobHeader}>
                <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                <Text style={styles.jobBudget}>LKR {job.budgetAmount}</Text>
              </View>
              <Text style={styles.jobDesc} numberOfLines={2}>{job.description}</Text>
              <View style={styles.jobMeta}>
                <Text style={styles.jobType}>{job.budgetType}</Text>
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
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  headerCount: { fontSize: 14, color: '#999' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#999', textAlign: 'center' },
  list: { flex: 1, padding: 16 },
  jobCard: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 16, marginBottom: 12 },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  jobTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', flex: 1, marginRight: 8 },
  jobBudget: { fontSize: 16, fontWeight: '800', color: colors.primary },
  jobDesc: { fontSize: 13, color: '#666', marginBottom: 8 },
  jobMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  jobType: { fontSize: 12, fontWeight: '600', color: '#3B82F6' },
  jobDate: { fontSize: 12, color: '#999' },
})
