import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Animated, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { jobs } from '../../../lib/api'
import type { JobPosting } from '../../../lib/types'
import PressScale from '../../../components/find/PressScale'

type Tab = 'active' | 'completed' | 'cancelled'

export default function TaskerMyJobs() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('active')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeJobs, setActiveJobs] = useState<JobPosting[]>([])
  const [completedJobs, setCompletedJobs] = useState<JobPosting[]>([])
  const [cancelledJobs, setCancelledJobs] = useState<JobPosting[]>([])

  const loadJobs = useCallback(async () => {
    try {
      const [active, completed, cancelled] = await Promise.all([
        jobs.list('status=OPEN,ASSIGNED,IN_PROGRESS'),
        jobs.list('status=COMPLETED'),
        jobs.list('status=CANCELLED'),
      ])
      setActiveJobs(active)
      setCompletedJobs(completed)
      setCancelledJobs(cancelled)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  const allJobs = { active: activeJobs, completed: completedJobs, cancelled: cancelledJobs }
  const jobsList = allJobs[tab]

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>My jobs</Text>
      </View>

      <View style={styles.tabs}>
        {(['active', 'completed', 'cancelled'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.amber} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadJobs} tintColor={colors.amber} />}
        >
          {jobsList.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="briefcase-outline" size={48} color={colors.border} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>No {tab} jobs</Text>
            </View>
          ) : (
            jobsList.map((job) => (
              <PressScale key={job.id}>
                <View style={styles.jobCard}>
                <View style={styles.jobTop}>
                  <Text style={styles.jobTitle}>{job.title}</Text>
                  <Text style={styles.jobAmount}>LKR {job.budget.toLocaleString()}</Text>
                </View>
                <Text style={styles.jobCustomer}>{job.customer?.name} • {job.location}</Text>
                <View style={styles.jobBottom}>
                  <View style={[styles.statusBadge, { backgroundColor: tab === 'active' ? '#CCFBF1' : tab === 'completed' ? '#D1FAE5' : '#FEE2E2' }]}>
                    <Text style={[styles.statusText, { color: tab === 'active' ? colors.amber : tab === 'completed' ? colors.success : '#EF4444' }]}>
                      {tab === 'active' ? 'Active' : tab === 'completed' ? 'Completed' : 'Cancelled'}
                    </Text>
                  </View>
                  <Text style={styles.jobTime}>{new Date(job.createdAt).toLocaleDateString()}</Text>
                </View>
                {tab === 'active' ? (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.trackBtn}
                      onPress={() => router.push('/(customer)/tracking/' + job.id as any)}
                    >
                      <Text style={styles.trackBtnText}>Track</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.msgBtn}>
                      <Text style={styles.msgBtnText}>Message</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </PressScale>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  topBar: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  heading: { fontSize: 28, fontFamily: fonts.heading, color: colors.ink },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: colors.border,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.white },
  tabText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.muted },
  tabTextActive: { color: colors.amber, fontFamily: fonts.bodyMedium },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.muted },
  jobCard: {
    backgroundColor: colors.white,
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 18,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  jobTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  jobTitle: { fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.ink, flex: 1 },
  jobAmount: { fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.amber },
  jobCustomer: { fontSize: 13, color: colors.muted, marginBottom: 8 },
  jobBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontFamily: fonts.bodyMedium },
  jobTime: { fontSize: 12, color: colors.muted },
  actionRow: { flexDirection: 'row', gap: 10 },
  trackBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.amber,
    alignItems: 'center',
  },
  trackBtnText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: '#111827' },
  msgBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  msgBtnText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.ink },
})
