import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const colors = {
  teal: '#0D9488',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  white: '#FFFFFF',
  green: '#10B981',
  primary: '#F59E0B',
}

type Tab = 'active' | 'completed' | 'cancelled'

const allJobs = {
  active: [
    { id: '1', title: 'Fix leaking pipe', customer: 'Ranil W.', location: 'Colombo 03', amount: 8500, status: 'En route', time: '2:00 PM' },
    { id: '2', title: 'Electrical repair', customer: 'Supun K.', location: 'Colombo 05', amount: 12000, status: 'In progress', time: '3:30 PM' },
  ],
  completed: [
    { id: '3', title: 'Paint bedroom', customer: 'Nimal S.', location: 'Colombo 07', amount: 15000, status: 'Completed', time: 'Yesterday' },
    { id: '4', title: 'AC service', customer: 'Priya M.', location: 'Colombo 04', amount: 6500, status: 'Completed', time: '2 days ago' },
  ],
  cancelled: [
    { id: '5', title: 'Garden cleanup', customer: 'Amal P.', location: 'Colombo 06', amount: 8000, status: 'Cancelled', time: '1 week ago' },
  ],
}

export default function TaskerMyJobs() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('active')

  const jobs = allJobs[tab]

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

      <ScrollView showsVerticalScrollIndicator={false}>
        {jobs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>No {tab} jobs</Text>
          </View>
        ) : (
          jobs.map((job) => (
            <TouchableOpacity key={job.id} style={styles.jobCard} activeOpacity={0.8}>
              <View style={styles.jobTop}>
                <Text style={styles.jobTitle}>{job.title}</Text>
                <Text style={styles.jobAmount}>LKR {job.amount.toLocaleString()}</Text>
              </View>
              <Text style={styles.jobCustomer}>{job.customer} • {job.location}</Text>
              <View style={styles.jobBottom}>
                <View style={[styles.statusBadge, { backgroundColor: tab === 'active' ? '#CCFBF1' : tab === 'completed' ? '#D1FAE5' : '#FEE2E2' }]}>
                  <Text style={[styles.statusText, { color: tab === 'active' ? colors.teal : tab === 'completed' ? colors.green : '#EF4444' }]}>
                    {job.status}
                  </Text>
                </View>
                <Text style={styles.jobTime}>{job.time}</Text>
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
