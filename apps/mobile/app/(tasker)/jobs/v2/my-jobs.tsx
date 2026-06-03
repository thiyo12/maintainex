import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../../../lib/colors'
import { v2Jobs, v2Quotes, V2Job } from '../../../../lib/api-v2'

const statusColors: Record<string, string> = {
  OPEN: colors.amber,
  IN_PROGRESS: '#3B82F6',
  COMPLETED: colors.success,
  CANCELLED: colors.error,
}

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Jobs</Text>
          <Text style={styles.headerSub}>{jobs.length} active quote{jobs.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tasker)/jobs/v2/browse')} style={styles.browseBtn}>
          <Text style={styles.browseBtnText}>Browse</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} />
      ) : jobs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>No jobs yet</Text>
          <Text style={styles.emptySub}>Browse open jobs and submit quotes to get started</Text>
          <TouchableOpacity onPress={() => router.push('/(tasker)/jobs/v2/browse')} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>Browse Open Jobs</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadJobs} tintColor={colors.amber} />}
        >
          {jobs.map((job) => (
            <TouchableOpacity
              key={job.id}
              style={styles.jobCard}
              onPress={() => router.push(`/(tasker)/jobs/v2/manage/${job.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.cardTop}>
                <View style={[styles.statusBadge, { backgroundColor: statusColors[job.status] || colors.muted }]}>
                  <Text style={styles.statusText}>{job.status.replace(/_/g, ' ')}</Text>
                </View>
              </View>
              <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
              <Text style={styles.jobDesc} numberOfLines={2}>{job.description}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.jobBudget}>LKR {job.budgetAmount}</Text>
                {job.myQuote ? (
                  <View style={styles.myQuotePill}>
                    <Text style={styles.myQuoteText}>My quote: LKR {job.myQuote.price}</Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.ink },
  headerSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  browseBtn: { backgroundColor: colors.amber, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  browseBtnText: { fontSize: 14, fontWeight: '700', color: colors.ink },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyBtn: { backgroundColor: colors.amber, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 },
  emptyBtnText: { fontSize: 16, fontWeight: '700', color: colors.ink },

  list: { flex: 1, padding: 16, paddingTop: 4 },
  jobCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  jobTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  jobDesc: { fontSize: 13, color: colors.ink, opacity: 0.6, lineHeight: 20, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobBudget: { fontSize: 15, fontWeight: '700', color: colors.amberDark },
  myQuotePill: { backgroundColor: '#D1FAE5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  myQuoteText: { fontSize: 12, fontWeight: '600', color: colors.success },
})
