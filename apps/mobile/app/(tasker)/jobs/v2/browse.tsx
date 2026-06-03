import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
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
        <View>
          <Text style={styles.headerTitle}>Open Jobs</Text>
          <Text style={styles.headerSub}>{jobs.length} job{jobs.length !== 1 ? 's' : ''} available</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{jobs.length}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} />
      ) : jobs.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={48} color={colors.muted} style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>No open jobs</Text>
          <Text style={styles.emptySub}>Check back later for new job postings</Text>
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
              onPress={() => router.push(`/(tasker)/jobs/v2/quote/${job.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={styles.budgetBadge}>
                  <Text style={styles.budgetBadgeText}>LKR {job.budgetAmount}</Text>
                </View>
                <Text style={styles.budgetType}>{job.budgetType}</Text>
              </View>
              <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
              <Text style={styles.jobDesc} numberOfLines={2}>{job.description}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.jobDate}>Posted {new Date(job.createdAt).toLocaleDateString()}</Text>
                <View style={styles.quoteBtn}>
                  <Text style={styles.quoteBtnText}>Quote →</Text>
                </View>
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
  headerBadge: { backgroundColor: colors.amber, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  headerBadgeText: { fontSize: 14, fontWeight: '700', color: colors.ink },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22 },

  list: { flex: 1, padding: 16, paddingTop: 4 },
  jobCard: { backgroundColor: colors.white, borderRadius: 16, padding: 18, marginBottom: 12, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  budgetBadge: { backgroundColor: colors.amberBg, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  budgetBadgeText: { fontSize: 14, fontWeight: '700', color: colors.amberDark },
  budgetType: { fontSize: 12, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  jobTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  jobDesc: { fontSize: 13, color: colors.ink, opacity: 0.6, lineHeight: 20, marginBottom: 14 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobDate: { fontSize: 12, color: colors.muted },
  quoteBtn: { backgroundColor: colors.amber, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  quoteBtnText: { fontSize: 13, fontWeight: '700', color: colors.ink },
})
