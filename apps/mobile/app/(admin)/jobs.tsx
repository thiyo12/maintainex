import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { jobs as jobsApi } from '../../lib/api'
import { JobPosting } from '../../lib/types'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  background: '#F9FAFB',
  white: '#FFFFFF',
  green: '#10B981',
  red: '#EF4444',
  blue: '#3B82F6',
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: colors.green,
  ASSIGNED: colors.blue,
  IN_PROGRESS: colors.primary,
  COMPLETED: colors.gray,
  CANCELLED: colors.red,
}

export default function AdminJobsScreen() {
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  const fetch = useCallback(async () => {
    try {
      const params = filter === 'all' ? '' : `status=${filter}`
      const data = await jobsApi.list(params)
      setJobs(data)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { fetch() }, [fetch])

  const filters = ['all', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED']

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Jobs</Text>
      </View>

      <View style={styles.filterRow}>
        {filters.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] || colors.gray }]}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.customer}>By: {item.customer?.name || 'Unknown'}</Text>
            <Text style={styles.budget}>LKR {item.budget?.toLocaleString()} | {item.location}</Text>
            <Text style={styles.bids}>{item.bids?.length || 0} bids</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}><Text style={styles.emptyText}>No jobs found</Text></View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: 20, paddingTop: 60, paddingBottom: 0 },
  title: { fontSize: 28, fontWeight: '800', color: colors.dark },
  filterRow: { flexDirection: 'row', gap: 8, padding: 20, paddingBottom: 12, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lightGray,
  },
  filterActive: { borderColor: colors.primary, backgroundColor: '#FFFBEB' },
  filterText: { fontSize: 12, fontWeight: '600', color: colors.gray },
  filterTextActive: { color: colors.primary },
  list: { padding: 20, paddingTop: 0 },
  card: {
    backgroundColor: colors.white, borderRadius: 16, padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.dark, flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700', color: colors.white },
  customer: { fontSize: 13, color: colors.gray, marginBottom: 4 },
  budget: { fontSize: 14, fontWeight: '600', color: colors.dark, marginBottom: 4 },
  bids: { fontSize: 12, color: colors.gray },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: colors.gray },
})
