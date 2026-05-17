import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../lib/colors'
import { company } from '../../lib/api'

export default function CompanyDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState([
    { icon: '📄', label: 'Active contracts', value: '-' },
    { icon: '💰', label: 'Revenue (month)', value: '-' },
    { icon: '👥', label: 'Team members', value: '-' },
    { icon: '⭐', label: 'Avg. rating', value: '-' },
  ])
  const [revenueMonth, setRevenueMonth] = useState('LKR 0')
  const [chartData, setChartData] = useState<number[]>([])
  const [recentActivity, setRecentActivity] = useState<{ text: string; time: string }[]>([])

  const fetchData = useCallback(async () => {
    try {
      const [earningsRes, contractsRes] = await Promise.all([
        company.earnings.get(),
        company.contracts.list(),
      ])

      const activeContracts = contractsRes.filter(
        (c: any) => c.status === 'In progress' || c.status === 'active'
      ).length

      const monthRevenue = earningsRes.monthlyRevenue || earningsRes.totalRevenue || 0
      const teamMembers = earningsRes.teamCount || stats[2].value
      const rating = earningsRes.rating || stats[3].value

      setStats([
        { icon: '📄', label: 'Active contracts', value: String(activeContracts) },
        { icon: '💰', label: 'Revenue (month)', value: `LKR ${(monthRevenue / 1000).toFixed(1)}K` },
        { icon: '👥', label: 'Team members', value: String(teamMembers) },
        { icon: '⭐', label: 'Avg. rating', value: String(rating) },
      ])

      setRevenueMonth(`LKR ${Number(monthRevenue).toLocaleString()}`)
      setChartData(earningsRes.monthlyData || earningsRes.chartData || [40, 65, 45, 80, 55, 90, 70])

      if (earningsRes.recentActivity) {
        setRecentActivity(earningsRes.recentActivity)
      } else {
        const activity = contractsRes.slice(-4).map((c: any) => ({
          text: `${c.title || 'Contract'} - ${c.status} (${c.clientName || 'Client'})`,
          time: c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : 'Recently',
        }))
        setRecentActivity(activity.length > 0 ? activity : [
          { text: 'Dashboard ready — no recent activity', time: '' },
        ])
      }
    } catch {
      setRecentActivity([{ text: 'Could not load data. Pull to retry.', time: '' }])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>Hello, Nimal 👋</Text>
          <Text style={styles.companyName}>Premium Builders (Pvt) Ltd</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>PB</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.statsGrid}>
          {stats.map((s, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statIcon}>{s.icon}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.chartPlaceholder}>
          <Text style={styles.chartEmoji}>📈</Text>
          <Text style={styles.chartTitle}>Revenue overview</Text>
          <Text style={styles.chartSub}>{revenueMonth} this month</Text>
          <View style={styles.chartBars}>
            {(chartData.length > 0 ? chartData : [40, 65, 45, 80, 55, 90, 70]).map((h: number, i: number) => (
              <View key={i} style={styles.chartBarWrap}>
                <View style={[styles.chartBar, { height: Math.min(h, 100) }]} />
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recent activity</Text>
        {recentActivity.map((a, i) => (
          <View key={i} style={styles.activityCard}>
            <View style={styles.activityDot} />
            <View style={styles.activityContent}>
              <Text style={styles.activityText}>{a.text}</Text>
              {a.time ? <Text style={styles.activityTime}>{a.time}</Text> : null}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.dark },
  companyName: { fontSize: 13, color: colors.gray, marginTop: 4 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.companyAccent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: colors.white },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    gap: 10,
    marginBottom: 16,
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
  statIcon: { fontSize: 28, marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.dark },
  statLabel: { fontSize: 12, color: colors.gray, marginTop: 4 },
  chartPlaceholder: {
    backgroundColor: colors.white,
    marginHorizontal: 24,
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  chartEmoji: { fontSize: 32, marginBottom: 8 },
  chartTitle: { fontSize: 16, fontWeight: '700', color: colors.dark },
  chartSub: { fontSize: 13, color: colors.gray, marginBottom: 16 },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 100,
  },
  chartBarWrap: { flex: 1, alignItems: 'center', height: 100, justifyContent: 'flex-end' },
  chartBar: {
    width: '100%',
    backgroundColor: colors.companyAccent,
    borderRadius: 6,
    opacity: 0.7,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  activityCard: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 10,
    gap: 12,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.companyAccent,
    marginTop: 5,
  },
  activityContent: { flex: 1 },
  activityText: { fontSize: 13, color: colors.dark, lineHeight: 18 },
  activityTime: { fontSize: 11, color: colors.gray, marginTop: 4 },
})
