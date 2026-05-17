import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors } from '../../lib/colors'
import { jobs } from '../../lib/api'
import type { JobPosting } from '../../lib/types'

type Tab = 'active' | 'completed' | 'cancelled'

export default function TaskerMyJobs() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('active')
  const [loading, setLoading] = useState(true)
  const [activeJobs, setActiveJobs] = useState<JobPosting[]>([])
  const [completedJobs, setCompletedJobs] = useState<JobPosting[]>([])
  const [cancelledJobs, setCancelledJobs] = useState<JobPosting[]>([])

  useEffect(() => {
    loadJobs()
  }, [])

  async function loadJobs() {
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
    }
  }

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
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {jobsList.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>No {tab} jobs</Text>
            </View>
          ) : (
            jobsList.map((job) => (
              <TouchableOpacity key={job.id} style={styles.jobCard} activeOpacity={0.8}>
                <View style={styles.jobTop}>
                  <Text style={styles.jobTitle}>{job.title}</Text>
                  <Text style={styles.jobAmount}>LKR {job.budget.toLocaleString()}</Text>
                </View>
                <Text style={styles.jobCustomer}>{job.customer?.name} • {job.location}</Text>
                <View style={styles.jobBottom}>
                  <View style={[styles.statusBadge, { backgroundColor: tab === 'active' ? '#CCFBF1' : tab === 'completed' ? '#D1FAE5' : '#FEE2E2' }]}>
                    <Text style={[styles.statusText, { color: tab === 'active' ? colors.teal : tab === 'completed' ? colors.green : '#EF4444' }]}>
                      {tab === 'active' ? 'Active' : tab === 'completed' ? 'Completed' : 'Cancelled'}
                    </Text>
                  </View>
                  <Text style={styles.jobTime}>{new Date(job.createdAt).toLocaleDateString()}</Text>
                </View>
                {tab === 'active' ? (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.trackBtn}
                      onPress={() => router.push('/(customer)/tracking/' + job.id)}
                    >
                      <Text style={styles.trackBtnText}>Track</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.msgBtn}>
                      <Text style={styles.msgBtnText}>Message</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  topBar: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: colors.lightGray,
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
  tabText: { fontSize: 14, fontWeight: '600', color: colors.gray },
  tabTextActive: { color: colors.teal, fontWeight: '700' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.gray },
  jobCard: {
    backgroundColor: colors.white,
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  jobTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  jobTitle: { fontSize: 15, fontWeight: '700', color: colors.dark, flex: 1 },
  jobAmount: { fontSize: 15, fontWeight: '700', color: colors.teal },
  jobCustomer: { fontSize: 13, color: colors.gray, marginBottom: 8 },
  jobBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '600' },
  jobTime: { fontSize: 12, color: colors.gray },
  actionRow: { flexDirection: 'row', gap: 10 },
  trackBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.teal,
    alignItems: 'center',
  },
  trackBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
  msgBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    alignItems: 'center',
  },
  msgBtnText: { fontSize: 14, fontWeight: '600', color: colors.dark },
})
