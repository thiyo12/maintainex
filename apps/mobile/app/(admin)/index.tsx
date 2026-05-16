import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { useAuth } from '../../lib/auth'
import { bookings as bookingsApi, taskers as taskersApi, jobs as jobsApi } from '../../lib/api'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  background: '#F9FAFB',
  white: '#FFFFFF',
}

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const [stats, setStats] = useState({ bookings: 0, taskers: 0, jobs: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      bookingsApi.list().then(b => b.length).catch(() => 0),
      taskersApi.list().then(t => t.length).catch(() => 0),
      jobsApi.list().then(j => j.length).catch(() => 0),
    ]).then(([bookings, taskers, jobs]) => {
      setStats({ bookings, taskers, jobs })
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.greeting}>Welcome, {user?.name}</Text>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: '#FFFBEB' }]}>
          <Text style={styles.statValue}>{stats.bookings}</Text>
          <Text style={styles.statLabel}>Bookings</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}>
          <Text style={styles.statValue}>{stats.taskers}</Text>
          <Text style={styles.statLabel}>Taskers</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}>
          <Text style={styles.statValue}>{stats.jobs}</Text>
          <Text style={styles.statLabel}>Jobs</Text>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: colors.dark },
  logoutText: { color: colors.gray, fontSize: 14, fontWeight: '500' },
  greeting: { fontSize: 16, color: colors.gray, marginBottom: 32 },
  statsGrid: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1, borderRadius: 16, padding: 20, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statValue: { fontSize: 32, fontWeight: '800', color: colors.dark },
  statLabel: { fontSize: 13, color: colors.gray, marginTop: 4 },
})
