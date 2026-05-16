import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { jobs as jobsApi } from '../../../lib/api'
import { JobPosting } from '../../../lib/types'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  background: '#F9FAFB',
  white: '#FFFFFF',
  green: '#10B981',
  blue: '#3B82F6',
}

export default function TaskerJobsScreen() {
  const router = useRouter()
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'open' | 'assigned' | 'completed'>('open')

  const fetchJobs = useCallback(async () => {
    try {
      const statusMap = { open: 'status=OPEN', assigned: 'status=ASSIGNED,IN_PROGRESS', completed: 'status=COMPLETED' }
      const data = await jobsApi.list(statusMap[filter])
      setJobs(data)
    } catch {
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const onRefresh = () => { setRefreshing(true); fetchJobs() }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Jobs</Text>
      </View>

      <View style={styles.filterRow}>
        {(['open', 'assigned', 'completed'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.jobCard}
            onPress={() => router.push(`/(tasker)/jobs/${item.id}`)}
          >
            <View style={styles.jobHeader}>
              <Text style={styles.jobTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.jobBudget}>LKR {item.budget?.toLocaleString()}</Text>
            </View>
            <Text style={styles.jobDesc} numberOfLines={2}>{item.description}</Text>
            <View style={styles.jobFooter}>
              <Text style={styles.jobLocation}>📍 {item.location}</Text>
              <View style={[styles.statusBadge, { backgroundColor: item.status === 'OPEN' ? colors.green : item.status === 'ASSIGNED' || item.status === 'IN_PROGRESS' ? colors.blue : colors.gray }]}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No jobs found</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: 20, paddingTop: 60, paddingBottom: 0 },
  title: { fontSize: 28, fontWeight: '800', color: colors.dark },
  filterRow: { flexDirection: 'row', gap: 8, padding: 20, paddingBottom: 12 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lightGray,
  },
  filterActive: { borderColor: colors.primary, backgroundColor: '#FFFBEB' },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.gray },
  filterTextActive: { color: colors.primary },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  jobCard: {
    backgroundColor: colors.white, borderRadius: 16, padding: 16,
    marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  jobTitle: { fontSize: 16, fontWeight: '700', color: colors.dark, flex: 1, marginRight: 8 },
  jobBudget: { fontSize: 16, fontWeight: '800', color: colors.primary },
  jobDesc: { fontSize: 13, color: colors.gray, marginBottom: 10, lineHeight: 18 },
  jobFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobLocation: { fontSize: 13, color: colors.gray },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700', color: colors.white },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.gray },
})
