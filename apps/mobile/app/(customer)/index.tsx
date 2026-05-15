import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList } from 'react-native'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { LinearGradient } from 'expo-linear-gradient'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

export default function CustomerDashboard() {
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
      {/* Header */}
      <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]}!</Text>
            <Text style={styles.subGreeting}>Here's your activity</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <StatBox label="Active" value={String(stats.activeBookings || 0)} />
          <StatBox label="Tasks" value={String(stats.activeTasks || 0)} />
          <StatBox label="Done" value={String(stats.completedTasks || 0)} />
        </View>
      </LinearGradient>

      {/* Quick Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(customer)/post-task')}>
          <Text style={styles.actionIcon}>+</Text>
          <Text style={styles.actionText}>Post Task</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(customer)/tasks')}>
          <Text style={styles.actionIcon}>📋</Text>
          <Text style={styles.actionText}>My Tasks</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(customer)/bookings')}>
          <Text style={styles.actionIcon}>📅</Text>
          <Text style={styles.actionText}>Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(customer)/taskers')}>
          <Text style={styles.actionIcon}>👷</Text>
          <Text style={styles.actionText}>Taskers</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Tasks */}
      <Text style={styles.sectionTitle}>Recent Tasks</Text>
      {data?.recentTasks?.length > 0 ? (
        <FlatList
          data={data.recentTasks.slice(0, 5)}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.taskCard}
              onPress={() => router.push(`/(customer)/tasks/${item.id}`)}
            >
              <Text style={styles.taskTitle}>{item.title}</Text>
              <View style={styles.taskMeta}>
                <Text style={styles.taskMetaText}>
                  {item.budget ? `LKR ${item.budget.toLocaleString()}` : 'Negotiable'}
                </Text>
                <Text style={[styles.taskStatus, getStatusStyle(item.status)]}>
                  {item.status.replace(/_/g, ' ')}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No tasks yet</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push('/(customer)/post-task')}
          >
            <Text style={styles.emptyBtnText}>Post Your First Task</Text>
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
  const styles: Record<string, { color: string }> = {
    PENDING_REVIEW: { color: '#D97706' },
    OPEN: { color: '#059669' },
    IN_PROGRESS: { color: '#2563EB' },
    COMPLETED: { color: '#059669' },
    CANCELLED: { color: '#DC2626' },
  }
  return styles[status] || { color: '#6B7280' }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
  header: { padding: 20, paddingTop: 50, paddingBottom: 24 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  subGreeting: { fontSize: 14, color: '#C4B5FD', marginTop: 4 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  logoutText: { color: '#FFFFFF', fontSize: 12, fontWeight: '500' },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' },
  statLabel: { fontSize: 12, color: '#C4B5FD', marginTop: 2 },
  actions: { flexDirection: 'row', padding: 16, gap: 12 },
  actionBtn: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  actionIcon: { fontSize: 24, marginBottom: 4 },
  actionText: { fontSize: 12, fontWeight: '500', color: '#374151' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', paddingHorizontal: 20, marginBottom: 12 },
  taskCard: { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  taskTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  taskMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  taskMetaText: { fontSize: 14, color: '#4F46E5', fontWeight: '500' },
  taskStatus: { fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#9CA3AF', marginBottom: 16 },
  emptyBtn: { backgroundColor: '#4F46E5', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
})
