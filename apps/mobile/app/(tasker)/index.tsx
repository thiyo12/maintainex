import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Switch,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { jobs as jobsApi, taskers as taskersApi } from '../../lib/api'
import { JobPosting } from '../../lib/types'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  background: '#F9FAFB',
  white: '#FFFFFF',
  green: '#10B981',
}

export default function TaskerHome() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isOnline, setIsOnline] = useState(false)

  const fetchJobs = useCallback(async () => {
    try {
      const data = await jobsApi.list('status=OPEN')
      setJobs(data)
    } catch {
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchJobs() }, [])

  const onRefresh = () => { setRefreshing(true); fetchJobs() }

  const toggleOnline = async (value: boolean) => {
    setIsOnline(value)
    try {
      await taskersApi.setOnline(value)
    } catch {}
  }

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
        <View>
          <Text style={styles.greeting}>Hi, {user?.name?.split(' ')[0] || 'Tasker'}</Text>
          <Text style={styles.subtitle}>Jobs near you</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.onlineCard}>
        <View>
          <Text style={styles.onlineTitle}>Available for work</Text>
          <Text style={styles.onlineSub}>{isOnline ? 'Getting job requests' : 'Tap to go online'}</Text>
        </View>
        <Switch
          value={isOnline}
          onValueChange={toggleOnline}
          trackColor={{ false: colors.lightGray, true: colors.primary }}
          thumbColor={isOnline ? colors.dark : '#f4f3f4'}
        />
      </View>

      <Text style={styles.sectionTitle}>Open Jobs ({jobs.length})</Text>

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
              <Text style={styles.jobBids}>{item.bids?.length || 0} bids</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No jobs available</Text>
            <Text style={styles.emptyText}>Check back later for new jobs</Text>
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
  greeting: { fontSize: 28, fontWeight: '800', color: colors.dark },
  subtitle: { fontSize: 15, color: colors.gray, marginTop: 4 },
  logoutText: { color: colors.gray, fontSize: 14, fontWeight: '500' },
  onlineCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.white, marginHorizontal: 20, borderRadius: 16,
    padding: 16, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  onlineTitle: { fontSize: 16, fontWeight: '700', color: colors.dark },
  onlineSub: { fontSize: 13, color: colors.gray, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.dark, paddingHorizontal: 20, marginBottom: 12 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  jobCard: {
    backgroundColor: colors.white, borderRadius: 16, padding: 16,
    marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  jobTitle: { fontSize: 16, fontWeight: '700', color: colors.dark, flex: 1, marginRight: 8 },
  jobBudget: { fontSize: 16, fontWeight: '800', color: colors.primary },
  jobDesc: { fontSize: 13, color: colors.gray, marginBottom: 10, lineHeight: 18 },
  jobFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  jobLocation: { fontSize: 13, color: colors.gray },
  jobBids: { fontSize: 13, color: colors.gray, fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.dark, marginBottom: 8 },
  emptyText: { fontSize: 14, color: colors.gray },
})
