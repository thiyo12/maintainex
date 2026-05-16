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

export default function CustomerJobsScreen() {
  const router = useRouter()
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchJobs = useCallback(async () => {
    try {
      const data = await jobsApi.list()
      setJobs(data)
    } catch {
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchJobs() }, [])

  const onRefresh = () => { setRefreshing(true); fetchJobs() }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Jobs</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/(customer)/jobs/new')}>
          <Text style={styles.addButtonText}>+ Post Job</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={jobs}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/(customer)/jobs/${item.id}`)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] || colors.gray }]}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardBudget}>LKR {item.budget?.toLocaleString()}</Text>
              <Text style={styles.cardBids}>{item.bids?.length || 0} bids</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No jobs yet</Text>
            <Text style={styles.emptyText}>Post a job to find taskers near you</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/(customer)/jobs/new')}>
              <Text style={styles.emptyButtonText}>Post a Job</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 60,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.dark },
  addButton: {
    backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 10,
  },
  addButtonText: { fontSize: 14, fontWeight: '700', color: colors.dark },
  list: { padding: 20, paddingTop: 0 },
  card: {
    backgroundColor: colors.white, borderRadius: 16, padding: 16,
    marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.dark, flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700', color: colors.white },
  cardDesc: { fontSize: 13, color: colors.gray, marginBottom: 12, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBudget: { fontSize: 16, fontWeight: '800', color: colors.primary },
  cardBids: { fontSize: 13, color: colors.gray },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.dark, marginBottom: 8 },
  emptyText: { fontSize: 14, color: colors.gray, marginBottom: 24 },
  emptyButton: {
    backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 12,
  },
  emptyButtonText: { fontSize: 16, fontWeight: '700', color: colors.dark },
})
