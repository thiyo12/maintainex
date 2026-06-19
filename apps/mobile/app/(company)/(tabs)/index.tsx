import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../lib/ThemeContext'
import { company } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { matchCategory } from '../../../lib/aiMatch'
import StatsCard from '../../../components/ui/StatsCard'
import JobCard from '../../../components/ui/JobCard'
import AISearchBar from '../../../components/shared/AISearchBar'
import PropertyCard from '../../../components/shared/PropertyCard'

export default function CompanyDashboard() {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState([
    { label: 'Active', value: '-' },
    { label: 'Revenue', value: '-' },
    { label: 'Team', value: '-' },
  ])
  const [revenueMonth, setRevenueMonth] = useState('LKR 0')
  const [openJobs, setOpenJobs] = useState<any[]>([])
  const [recentActivity, setRecentActivity] = useState<{ text: string; time: string }[]>([])
  const [aiQuery, setAiQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

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
      const teamMembers = earningsRes.teamCount || '-'
      const rating = earningsRes.rating || '—'

      setStats([
        { label: 'Active', value: String(activeContracts) },
        { label: 'Revenue', value: `LKR ${(monthRevenue / 1000).toFixed(1)}K` },
        { label: 'Team', value: String(teamMembers) },
      ])
      setRevenueMonth(`LKR ${Number(monthRevenue).toLocaleString()}`)
      setOpenJobs((contractsRes || []).slice(0, 5))

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

  const handleAiChange = useCallback((text: string) => {
    setAiQuery(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      matchCategory(text)
    }, 400)
  }, [])

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
          <ActivityIndicator size="large" color={colors.amber} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchData} tintColor={colors.amber} />}
      >
        {/* Header card */}
        <View style={[styles.headerCard, { backgroundColor: colors.white }]}>
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.avatar, { backgroundColor: colors.indigo }]}>
                <Text style={styles.avatarText}>{(user?.name || 'C')[0]}</Text>
              </View>
              <View>
                <Text style={[styles.greeting, { color: colors.muted }]}>{getGreeting()}</Text>
                <Text style={[styles.userName, { color: colors.ink }]}>{user?.name || 'Company'}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[styles.headerIcon, { backgroundColor: colors.amberBg }]}>
                <Ionicons name="notifications-outline" size={18} color={colors.amberDark} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.headerIcon, { backgroundColor: colors.amberBg }]} onPress={() => router.push('/(company)/settings/edit-profile')}>
                <Ionicons name="settings-outline" size={18} color={colors.amberDark} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* AI Search Bar */}
        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
          <AISearchBar
            value={aiQuery}
            onChangeText={handleAiChange}
            placeholder="Search jobs, contracts..."
          />
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {stats.map((s, i) => (
            <StatsCard
              key={i}
              label={s.label}
              value={s.value}
              iconName={['📄', '💰', '👥'][i]}
              color={[colors.amber, colors.success, colors.blue][i]}
            />
          ))}
        </View>

        {/* Revenue */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.ink }]}>Revenue Overview</Text>
          <View style={[styles.revenueCard, { backgroundColor: colors.white }]}>
            <Text style={[styles.revenueAmount, { color: colors.amberDark }]}>{revenueMonth}</Text>
            <Text style={[styles.revenueLabel, { color: colors.muted }]}>this month</Text>
          </View>
        </View>

        {/* Active Contracts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>Active Contracts</Text>
            <TouchableOpacity onPress={() => router.push('/(company)/(tabs)/contracts-list')}>
              <Text style={[styles.seeAll, { color: colors.amberDark }]}>See all</Text>
            </TouchableOpacity>
          </View>
          {openJobs.slice(0, 4).map((job) => (
            <JobCard
              key={job.id}
              title={job.title || 'Contract'}
              category={job.categoryName || 'General'}
              budget={job.budgetAmount}
              location={job.locationName}
              status={job.status}
              onPress={() => router.push(`/(company)/jobs/v2/browse`)}
            />
          ))}
        </View>

        {/* Real Estate */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>Real Estate</Text>
            <TouchableOpacity onPress={() => router.push('/real-estate')}>
              <Text style={[styles.seeAll, { color: colors.amberDark }]}>See all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
            <PropertyCard
              title="Modern Apartment"
              priceLkr={8500000}
              type="sale"
              bedrooms={3}
              bathrooms={2}
              areaSqft={1500}
              location="Colombo 3"
              onPress={() => router.push('/real-estate')}
            />
            <PropertyCard
              title="Luxury Villa"
              priceLkr={25000000}
              type="sale"
              bedrooms={5}
              bathrooms={4}
              areaSqft={3500}
              location="Colombo 7"
              onPress={() => router.push('/real-estate')}
            />
            <PropertyCard
              title="Apartment for Rent"
              priceLkr={85000}
              type="rent"
              bedrooms={2}
              bathrooms={1}
              areaSqft={900}
              location="Colombo 4"
              onPress={() => router.push('/real-estate')}
            />
          </ScrollView>
        </View>

        {/* Quick post grid */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.ink, marginBottom: 12 }]}>What would you like to post?</Text>
          <View style={styles.grid}>
            <TouchableOpacity style={[styles.gridCard, { backgroundColor: colors.white }]} onPress={() => router.push('/post-job')}>
              <View style={[styles.gridIcon, { backgroundColor: colors.amberBg }]}>
                <Ionicons name="briefcase-outline" size={22} color={colors.amberDark} />
              </View>
              <Text style={[styles.gridLabel, { color: colors.ink }]}>Post a Job</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.gridCard, { backgroundColor: colors.white }]} onPress={() => router.push('/(company)/team/invite')}>
              <View style={[styles.gridIcon, { backgroundColor: colors.blueBg }]}>
                <Ionicons name="people-outline" size={22} color={colors.blue} />
              </View>
              <Text style={[styles.gridLabel, { color: colors.ink }]}>Invite Team</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.gridCard, { backgroundColor: colors.white }]} onPress={() => router.push('/(company)/(tabs)/milestones-list')}>
              <View style={[styles.gridIcon, { backgroundColor: colors.successBg }]}>
                <Ionicons name="flag-outline" size={22} color={colors.success} />
              </View>
              <Text style={[styles.gridLabel, { color: colors.ink }]}>Milestones</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.gridCard, { backgroundColor: colors.white }]} onPress={() => router.push('/(company)/settings/subscription')}>
              <View style={[styles.gridIcon, { backgroundColor: colors.purpleBg }]}>
                <Ionicons name="card-outline" size={22} color={colors.purple} />
              </View>
              <Text style={[styles.gridLabel, { color: colors.ink }]}>Subscription</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerCard: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontFamily: 'Outfit_900Black', color: '#FFFFFF' },
  greeting: { fontSize: 11, fontFamily: 'Outfit_500Medium' },
  userName: { fontSize: 16, fontFamily: 'Outfit_800ExtraBold', marginTop: 1 },
  headerIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 16 },
  section: { marginHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Outfit_800ExtraBold', letterSpacing: -0.2 },
  seeAll: { fontSize: 12, fontFamily: 'Outfit_700Bold' },
  revenueCard: {
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
    alignItems: 'center',
  },
  revenueAmount: { fontSize: 24, fontFamily: 'Outfit_900Black', letterSpacing: -0.5 },
  revenueLabel: { fontSize: 11, fontFamily: 'Outfit_500Medium', marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCard: {
    width: '48%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  gridIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  gridLabel: { fontSize: 12, fontFamily: 'Outfit_700Bold', textAlign: 'center' },
})
