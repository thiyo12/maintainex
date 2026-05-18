import { useEffect, useState, useRef } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/colors'
import { useAuth } from '../../lib/auth'
import { taskers, bookings, disputes, earnings } from '../../lib/api'

function PressScale({ onPress, children, style }: any) {
  const scale = useRef(new Animated.Value(1)).current
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={1}
      onPressIn={() => Animated.spring(scale, { toValue: 0.95, friction: 8, tension: 100, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }).start()}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </TouchableOpacity>
  )
}

interface AdminStats {
  totalTaskers: string
  activeBookings: string
  totalJobs: string
  revenue: string
  disputes: string
}

const placeholderStats: AdminStats = {
  totalTaskers: '—',
  activeBookings: '—',
  totalJobs: '—',
  revenue: '—',
  disputes: '—',
}

export default function AdminDashboard() {
  const { logout, user } = useAuth()
  const [stats, setStats] = useState<AdminStats>(placeholderStats)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const [taskerRes, bookingRes, disputeRes, earningsRes] = await Promise.allSettled([
        taskers.list(),
        bookings.list(),
        disputes.list(),
        earnings.get(),
      ])

      const taskersData = taskerRes.status === 'fulfilled' ? taskerRes.value : []
      const bookingsData = bookingRes.status === 'fulfilled' ? bookingRes.value : []
      const disputesData = disputeRes.status === 'fulfilled' ? disputeRes.value : []
      const earningsData = earningsRes.status === 'fulfilled' ? earningsRes.value : null

      setStats({
        totalTaskers: `${taskersData.length}`,
        activeBookings: `${bookingsData.filter((b: any) => b.status === 'IN_PROGRESS' || b.status === 'ASSIGNED').length}`,
        totalJobs: `${bookingsData.length}`,
        revenue: earningsData?.total ? `LKR ${Number(earningsData.total).toLocaleString()}` : '—',
        disputes: `${disputesData.length}`,
      })
    } catch {
      setStats(placeholderStats)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    { label: 'Taskers', value: stats.totalTaskers },
    { label: 'Active jobs', value: stats.activeBookings },
    { label: 'Total jobs', value: stats.totalJobs },
    { label: 'Revenue', value: stats.revenue },
    { label: 'Disputes', value: stats.disputes },
  ]

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <Text style={styles.heading}>Admin</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Admin</Text>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.statsGrid}>
          {statCards.map((s, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <PressScale>
            <View style={styles.actionBtn}>
              <Ionicons name="people-outline" size={20} color={colors.dark} style={{ marginRight: 10 }} />
              <Text style={styles.actionBtnText}>Manage users</Text>
            </View>
          </PressScale>
          <PressScale>
            <View style={styles.actionBtn}>
              <Ionicons name="briefcase-outline" size={20} color={colors.dark} style={{ marginRight: 10 }} />
              <Text style={styles.actionBtnText}>Manage jobs</Text>
            </View>
          </PressScale>
          <PressScale>
            <View style={styles.actionBtn}>
              <Ionicons name="settings-outline" size={20} color={colors.dark} style={{ marginRight: 10 }} />
              <Text style={styles.actionBtnText}>Platform settings</Text>
            </View>
          </PressScale>
          <PressScale>
            <View style={styles.actionBtn}>
              <Ionicons name="cash-outline" size={20} color={colors.dark} style={{ marginRight: 10 }} />
              <Text style={styles.actionBtnText}>View payouts</Text>
            </View>
          </PressScale>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark },
  logoutBtn: {
    backgroundColor: colors.red,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  logoutBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    width: '47%',
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.dark },
  statLabel: { fontSize: 12, color: colors.gray, marginTop: 4 },
  section: { paddingHorizontal: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.dark, marginBottom: 12 },
  actionBtn: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  actionBtnText: { fontSize: 15, fontWeight: '600', color: colors.dark },
})
