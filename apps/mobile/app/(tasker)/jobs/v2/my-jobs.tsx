import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../../../lib/colors'
import { v2Jobs, v2Quotes, V2Job } from '../../../../lib/api-v2'

export default function V2ProviderMyJobsScreen() {
  const router = useRouter()
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadJobs = useCallback(async () => {
    try {
      const res = await v2Jobs.list('myQuotes=true')
      const allJobs = res.jobs
      const quoted = await Promise.all(
        allJobs.map(async (j) => {
          try {
            const qRes = await v2Quotes.list(j.id)
            const myQuote = qRes.quotes.find((q: any) => q.status !== 'REJECTED')
            return { ...j, myQuote: myQuote || null }
          } catch { return { ...j, myQuote: null } }
        })
      )
      setJobs(quoted)
    } catch (e) {
      console.error('Load my jobs error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  const statusColors: Record<string, string> = {
    OPEN: '#F59E0B',
    IN_PROGRESS: '#3B82F6',
    COMPLETED: '#10B981',
    CANCELLED: '#EF4444',
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Marketplace Jobs</Text>
        <Text style={styles.headerCount}>{jobs.length} active</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : jobs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No jobs yet</Text>
          <Text style={styles.emptySub}>Browse open jobs and submit quotes to get started</Text>
          <TouchableOpacity onPress={() => router.push('/(tasker)/jobs/v2/browse')} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>Browse Jobs</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadJobs} tintColor={colors.primary} />}
        >
          {jobs.map((job) => (
            <TouchableOpacity
              key={job.id}
              style={styles.jobCard}
              onPress={() => router.push(`/(tasker)/jobs/v2/manage/${job.id}`)}
            >
              <View style={styles.jobHeader}>
                <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColors[job.status] || '#999' }]}>
                  <Text style={styles.statusText}>{job.status.replace('_', ' ')}</Text>
                </View>
              </View>
              <Text style={styles.jobDesc} numberOfLines={2}>{job.description}</Text>
              <View style={styles.jobFooter}>
                <Text style={styles.jobBudget}>LKR {job.budgetAmount}</Text>
                {job.myQuote && (
                  <Text style={styles.myQuote}>My quote: LKR {job.myQuote.price}</Text>
                )}
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
  emptySub: { fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 24 },
  emptyBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  emptyBtnText: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  list: { flex: 1, padding: 16 },
  jobCard: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 16, marginBottom: 12 },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  jobTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  jobDesc: { fontSize: 13, color: '#666', marginBottom: 8 },
  jobFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  jobBudget: { fontSize: 14, fontWeight: '600', color: colors.primary },
  myQuote: { fontSize: 13, fontWeight: '600', color: '#059669' },
})
