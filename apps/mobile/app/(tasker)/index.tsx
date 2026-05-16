import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList } from 'react-native'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { LinearGradient } from 'expo-linear-gradient'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

export default function TaskerDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    loadSession()
    fetchDashboard()
  }, [])

  const loadSession = async () => {
    try {
      const userData = await SecureStore.getItemAsync('user_data')
      if (userData) setUser(JSON.parse(userData))
    } catch {}
  }

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${API_URL}/api/dashboard`)
      const result = await res.json()
      if (result.success) setData(result.data)
    } catch {}
    finally { setLoading(false) }
  }

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('session_token')
    await SecureStore.deleteItemAsync('user_data')
    router.replace('/(auth)/login')
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    )
  }

  const stats = data?.stats || {}

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#059669', '#047857']} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Hi, {user?.name?.split(' ')[0]}!</Text>
            <Text style={styles.subGreeting}>Here's your workspace</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <StatBox label="Available" value={String(stats.availableJobs || 0)} />
          <StatBox label="Active" value={String(stats.activeAssignments || 0)} />
          <StatBox label="Done" value={String(stats.completedTasks || 0)} />
        </View>
      </LinearGradient>

      {/* Earnings Card */}
      <View style={styles.earningsCard}>
        <Text style={styles.earningsLabel}>Total Earnings</Text>
        <Text style={styles.earningsValue}>LKR {(stats.totalEarnings || 0).toLocaleString()}</Text>
        <View style={styles.earningsMeta}>
          <Text style={styles.earningsMetaText}>
            ⭐ {data?.profile?.overallRating?.toFixed(1) || 'New'} ({data?.profile?.totalReviews || 0} reviews)
          </Text>
          <Text style={styles.earningsMetaText}>
            ✅ {data?.profile?.isAvailable ? 'Available' : 'Unavailable'}
          </Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tasker)/jobs')}>
          <Text style={styles.actionIcon}>📋</Text>
          <Text style={styles.actionText}>Browse Jobs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tasker)/assignments')}>
          <Text style={styles.actionIcon}>🔨</Text>
          <Text style={styles.actionText}>My Work</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tasker)/profile')}>
          <Text style={styles.actionIcon}>👤</Text>
          <Text style={styles.actionText}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tasker)/earnings')}>
          <Text style={styles.actionIcon}>💰</Text>
          <Text style={styles.actionText}>Earnings</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Assignments */}
      <Text style={styles.sectionTitle}>Recent Assignments</Text>
      {data?.recentAssignments?.length > 0 ? (
        data.recentAssignments.map((assignment: any) => (
          <View key={assignment.id} style={styles.assignmentCard}>
            <Text style={styles.assignmentTitle}>{assignment.task?.title || 'Task'}</Text>
            <View style={styles.assignmentRow}>
              <Text style={styles.assignmentPrice}>
                LKR {(assignment.agreedPrice || 0).toLocaleString()}
              </Text>
              <Text style={[styles.assignmentStatus, getStatusStyle(assignment.status)]}>
                {assignment.status.replace(/_/g, ' ')}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No assignments yet</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push('/(tasker)/jobs')}
          >
            <Text style={styles.emptyBtnText}>Browse Available Jobs</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

function StatBox({ label, value }: { label: string, value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function getStatusStyle(status: string) {
  const colors: Record<string, object> = {
    PENDING: { color: '#D97706', backgroundColor: '#FEF3C7' },
    CONFIRMED: { color: '#2563EB', backgroundColor: '#DBEAFE' },
    IN_PROGRESS: { color: '#2563EB', backgroundColor: '#DBEAFE' },
    COMPLETED: { color: '#059669', backgroundColor: '#D1FAE5' },
    CANCELLED: { color: '#DC2626', backgroundColor: '#FEE2E2' },
  }
  return colors[status] || { color: '#6B7280', backgroundColor: '#F3F4F6' }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, paddingTop: 50, paddingBottom: 24 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  subGreeting: { fontSize: 14, color: '#A7F3D0', marginTop: 4 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  logoutText: { color: '#FFFFFF', fontSize: 12, fontWeight: '500' },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' },
  statLabel: { fontSize: 12, color: '#A7F3D0', marginTop: 2 },
  earningsCard: { margin: 16, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  earningsLabel: { fontSize: 14, color: '#6B7280' },
  earningsValue: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginTop: 4 },
  earningsMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  earningsMetaText: { fontSize: 13, color: '#6B7280' },
  actions: { flexDirection: 'row', paddingHorizontal: 16, gap: 12 },
  actionBtn: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  actionIcon: { fontSize: 24, marginBottom: 4 },
  actionText: { fontSize: 12, fontWeight: '500', color: '#374151' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', paddingHorizontal: 20, marginTop: 20, marginBottom: 12 },
  assignmentCard: { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  assignmentTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  assignmentRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  assignmentPrice: { fontSize: 14, color: '#059669', fontWeight: '500' },
  assignmentStatus: { fontSize: 12, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#9CA3AF', marginBottom: 16 },
  emptyBtn: { backgroundColor: '#059669', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
})
