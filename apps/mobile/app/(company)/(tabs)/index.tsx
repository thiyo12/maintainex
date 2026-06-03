import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../lib/colors'
import { fonts } from '../../../lib/fonts'
import { company } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'

export default function CompanyDashboard() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState([
    { icon: 'document-text-outline', label: 'Active contracts', value: '-' },
    { icon: 'cash-outline', label: 'Revenue (month)', value: '-' },
    { icon: 'people-outline', label: 'Team members', value: '-' },
    { icon: 'star', label: 'Avg. rating', value: '-' },
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
        { icon: 'document-text-outline', label: 'Active contracts', value: String(activeContracts) },
        { icon: 'cash-outline', label: 'Revenue (month)', value: `LKR ${(monthRevenue / 1000).toFixed(1)}K` },
        { icon: 'people-outline', label: 'Team members', value: String(teamMembers) },
        { icon: 'star', label: 'Avg. rating', value: String(rating) },
      ])
      setRevenueMonth(`LKR ${Number(monthRevenue).toLocaleString()}`)
      setChartData(earningsRes.monthlyData || earningsRes.chartData || [40, 65, 45, 80, 55, 90, 70])

      if (earningsRes.recentActivity) {
        setRecentActivity(earningsRes.recentActivity)
      } else {
        const activity = contractsRes.slice(-4).map((c: any) => ({
          text: `${c.title || 'Contract'} - ${c.status}`,
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
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.companyAccent} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchData} tintColor={colors.companyAccent} />}
      >
        {/* Ink Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(user?.name || 'C')[0]}</Text>
              </View>
              <View>
                <Text style={styles.greeting}>{getGreeting()}</Text>
                <Text style={styles.companyName}>{user?.name || 'Company'}</Text>
                <Text style={styles.role}>Company Account</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/(company)/settings/edit-profile')}>
              <Ionicons name="settings-outline" size={20} color={colors.companyAccent} />
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {stats.map((s, i) => (
              <View key={i} style={styles.statCard}>
                <Ionicons name={s.icon as any} size={18} color={colors.companyAccent} />
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={18} color={colors.ink} style={{ marginRight: 6 }} />
              <Text style={styles.actionBtnText}>New Contract</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} activeOpacity={0.7}>
              <Ionicons name="people-outline" size={18} color={colors.companyAccent} style={{ marginRight: 6 }} />
              <Text style={[styles.actionBtnText, { color: colors.companyAccent }]}>Invite Team</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Revenue Chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>Revenue Overview</Text>
              <Text style={styles.chartSub}>{revenueMonth} this month</Text>
            </View>
            <Ionicons name="trending-up-outline" size={24} color={colors.companyAccent} />
          </View>
          <View style={styles.chartBars}>
            {(chartData.length > 0 ? chartData : [40, 65, 45, 80, 55, 90, 70]).map((h: number, i: number) => (
              <View key={i} style={styles.chartBarWrap}>
                <View style={[styles.chartBar, { height: Math.min(h * 0.7 + 20, 100) }]} />
              </View>
            ))}
          </View>
        </View>

        {/* Quick Nav */}
        <View style={styles.navSection}>
          <TouchableOpacity style={styles.navCard} onPress={() => router.push('/(company)/(tabs)/contracts-list')} activeOpacity={0.7}>
            <View style={[styles.navIcon, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="document-text-outline" size={22} color={colors.companyAccent} />
            </View>
            <View style={styles.navInfo}>
              <Text style={styles.navTitle}>All Contracts</Text>
              <Text style={styles.navSub}>View and manage your contracts</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.navCard} onPress={() => router.push('/(company)/(tabs)/milestones-list')} activeOpacity={0.7}>
            <View style={[styles.navIcon, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="flag-outline" size={22} color={colors.companyAccent} />
            </View>
            <View style={styles.navInfo}>
              <Text style={styles.navTitle}>Milestones</Text>
              <Text style={styles.navSub}>Track project progress and payments</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.navCard} onPress={() => router.push('/(company)/(tabs)/team')} activeOpacity={0.7}>
            <View style={[styles.navIcon, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="people-outline" size={22} color={colors.companyAccent} />
            </View>
            <View style={styles.navInfo}>
              <Text style={styles.navTitle}>Team</Text>
              <Text style={styles.navSub}>Manage your team members</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentActivity.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Ionicons name="time-outline" size={32} color={colors.muted} />
              <Text style={styles.emptyText}>No recent activity</Text>
            </View>
          ) : (
            recentActivity.map((a, i) => (
              <View key={i} style={styles.activityCard}>
                <View style={styles.activityDot} />
                <View style={styles.activityContent}>
                  <Text style={styles.activityText}>{a.text}</Text>
                  {a.time ? <Text style={styles.activityTime}>{a.time}</Text> : null}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },

  header: { backgroundColor: colors.ink, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.companyAccent, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.white },
  greeting: { fontSize: 12, fontFamily: fonts.body, color: colors.muted },
  companyName: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.white },
  role: { fontSize: 11, fontFamily: fonts.body, color: colors.muted, marginTop: 1 },
  settingsBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },

  statsRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, gap: 8 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 10, alignItems: 'center' },
  statValue: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.white, marginTop: 6 },
  statLabel: { fontSize: 9, fontFamily: fonts.body, color: colors.muted, marginTop: 2, textAlign: 'center' },

  actionRow: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 16, gap: 10 },
  actionBtn: { flexDirection: 'row', flex: 1, backgroundColor: colors.companyAccent, paddingVertical: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  actionBtnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.companyAccent },
  actionBtnText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.white },

  chartCard: { backgroundColor: colors.white, marginHorizontal: 20, marginTop: 20, padding: 18, borderRadius: 16, shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  chartTitle: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.ink },
  chartSub: { fontSize: 12, fontFamily: fonts.body, color: colors.muted, marginTop: 2 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 90 },
  chartBarWrap: { flex: 1, alignItems: 'center', height: 90, justifyContent: 'flex-end' },
  chartBar: { width: '100%', backgroundColor: colors.companyAccent, borderRadius: 6, opacity: 0.6, minHeight: 8 },

  navSection: { paddingHorizontal: 20, marginTop: 24, gap: 10 },
  navCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 14, padding: 14, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  navIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  navInfo: { flex: 1, marginLeft: 12 },
  navTitle: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.ink },
  navSub: { fontSize: 11, fontFamily: fonts.bodyLight, color: colors.muted, marginTop: 1 },

  activitySection: { padding: 20, paddingBottom: 100 },
  sectionTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.ink, marginBottom: 14 },

  activityCard: { flexDirection: 'row', marginBottom: 12, gap: 12 },
  activityDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.companyAccent, marginTop: 5 },
  activityContent: { flex: 1 },
  activityText: { fontSize: 13, fontFamily: fonts.body, color: colors.ink, lineHeight: 18 },
  activityTime: { fontSize: 11, fontFamily: fonts.bodyLight, color: colors.muted, marginTop: 2 },

  emptyActivity: { alignItems: 'center', paddingVertical: 20 },
  emptyText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.muted, marginTop: 8 },
})
