import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Bell, Gear, Briefcase, Users, Flag, CreditCard, MagnifyingGlass, FileText } from 'phosphor-react-native'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { company } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import StatsCard from '../../../components/ui/StatsCard'
import JobCard from '../../../components/ui/JobCard'
import AISearchBar from '../../../components/shared/AISearchBar'
import PropertyCard from '../../../components/shared/PropertyCard'

export default function CompanyDashboard() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState([
    { label: t('company.activeContracts'), value: '-' },
    { label: t('company.earnings'), value: '-' },
    { label: t('company.team'), value: '-' },
  ])
  const [revenueMonth, setRevenueMonth] = useState('LKR 0')
  const [openJobs, setOpenJobs] = useState<any[]>([])
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
      const teamMembers = earningsRes.teamCount || '-'
      const rating = earningsRes.rating || '—'

      setStats([
        { label: t('company.statActive'), value: String(activeContracts) },
        { label: t('company.statRevenue'), value: `LKR ${(monthRevenue / 1000).toFixed(1)}K` },
        { label: t('company.statTeam'), value: String(teamMembers) },
      ])
      setRevenueMonth(`LKR ${Number(monthRevenue).toLocaleString()}`)
      setOpenJobs((contractsRes || []).slice(0, 5))

      if (earningsRes.recentActivity) {
        setRecentActivity(earningsRes.recentActivity)
      } else {
        const activity = contractsRes.slice(-4).map((c: any) => ({
          text: `${c.title || t('jobs.contract')} - ${c.status}`,
          time: c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : t('common.recently'),
        }))
        setRecentActivity(activity.length > 0 ? activity : [
          { text: t('company.dashboard'), time: '' },
        ])
      }
    } catch {
      setRecentActivity([{ text: t('errors.generic'), time: '' }])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return t('home.greeting.morning')
    if (h < 17) return t('home.greeting.afternoon')
    return t('home.greeting.evening')
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={'#F5A623'} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchData} tintColor={'#F5A623'} />}
      >
        {/* Header card */}
        <View style={[styles.headerCard, { backgroundColor: '#FFFFFF' }]}>
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.avatar, { backgroundColor: '#818CF8' }]}>
                <Text style={styles.avatarText}>{(user?.name || 'C')[0]}</Text>
              </View>
              <View>
                <Text style={[styles.greeting, { color: '#6F6B6B' }]}>{getGreeting()}</Text>
                <Text style={[styles.userName, { color: '#FFFFFF' }]}>{user?.name || t('profile.company')}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[styles.headerIcon, { backgroundColor: '#2E1A00' }]}>
                <Bell size={18} color={'#D48900'} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.headerIcon, { backgroundColor: '#2E1A00' }]} onPress={() => router.push('/(company)/settings/edit-profile')}>
                <Gear size={18} color={'#D48900'} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* AI Search Bar */}
        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
          <AISearchBar
            placeholder={t('tasker.searchJobs')}
            onCategorySelect={(catId) => {
              router.push({ pathname: '/(customer)/find/[categoryId]', params: { categoryId: catId } })
            }}
            onJobSelect={(jobId) => {
              router.push({ pathname: '/(customer)/find/taskers/[jobId]', params: { jobId } })
            }}
            onPostJob={(query) => {
              router.push({ pathname: '/(customer)/jobs/v2/create', params: { title: query } })
            }}
          />
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {stats.map((s, i) => (
            <StatsCard
              key={i}
              label={s.label}
              value={s.value}
              iconName={['FileText', 'Money', 'Users'][i]}
              color={['#F5A623', '#06C167', '#3B82F6'][i]}
            />
          ))}
        </View>

        {/* Revenue */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#FFFFFF' }]}>{t('company.earnings')}</Text>
          <View style={[styles.revenueCard, { backgroundColor: '#FFFFFF' }]}>
            <Text style={[styles.revenueAmount, { color: '#D48900' }]}>{revenueMonth}</Text>
            <Text style={[styles.revenueLabel, { color: '#6F6B6B' }]}>{t('tasker.earnings')}</Text>
          </View>
        </View>

        {/* Active Contracts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: '#FFFFFF' }]}>{t('company.activeContracts')}</Text>
            <TouchableOpacity onPress={() => router.push('/(company)/(tabs)/contracts-list')}>
              <Text style={[styles.seeAll, { color: '#D48900' }]}>{t('common.seeAll')}</Text>
            </TouchableOpacity>
          </View>
          {openJobs.slice(0, 4).map((job) => (
            <JobCard
              key={job.id}
              title={job.title || t('jobs.contract')}
              category={job.categoryName || t('categories.general')}
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
            <Text style={[styles.sectionTitle, { color: '#FFFFFF' }]}>{t('realEstate.title')}</Text>
            <TouchableOpacity onPress={() => router.push('/real-estate')}>
              <Text style={[styles.seeAll, { color: '#D48900' }]}>{t('common.seeAll')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
            <PropertyCard
              title={t('realEstate.sampleTitle1')}
              priceLkr={8500000}
              type="sale"
              bedrooms={3}
              bathrooms={2}
              areaSqft={1500}
              location="Colombo 3"
              onPress={() => router.push('/real-estate')}
            />
            <PropertyCard
              title={t('realEstate.sampleTitle2')}
              priceLkr={25000000}
              type="sale"
              bedrooms={5}
              bathrooms={4}
              areaSqft={3500}
              location="Colombo 7"
              onPress={() => router.push('/real-estate')}
            />
            <PropertyCard
              title={t('realEstate.sampleTitle3')}
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
          <Text style={[styles.sectionTitle, { color: '#FFFFFF', marginBottom: 12 }]}>{t('home.postOptions.title')}</Text>
          <View style={styles.grid}>
            <TouchableOpacity style={[styles.gridCard, { backgroundColor: '#FFFFFF' }]} onPress={() => router.push('/(customer)/jobs/v2/create')}>
              <View style={[styles.gridIcon, { backgroundColor: '#2E1A00' }]}>
                <Briefcase size={22} color={'#D48900'} />
              </View>
              <Text style={[styles.gridLabel, { color: '#FFFFFF' }]}>{t('home.postJob')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.gridCard, { backgroundColor: '#FFFFFF' }]} onPress={() => router.push('/(company)/team/invite')}>
              <View style={[styles.gridIcon, { backgroundColor: '#0A1A2E' }]}>
                <Users size={22} color={'#3B82F6'} />
              </View>
              <Text style={[styles.gridLabel, { color: '#FFFFFF' }]}>{t('company.inviteMember')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.gridCard, { backgroundColor: '#FFFFFF' }]} onPress={() => router.push('/(company)/(tabs)/milestones-list')}>
              <View style={[styles.gridIcon, { backgroundColor: '#0A2E1A' }]}>
                <Flag size={22} color={'#06C167'} />
              </View>
              <Text style={[styles.gridLabel, { color: '#FFFFFF' }]}>{t('company.milestones')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.gridCard, { backgroundColor: '#FFFFFF' }]} onPress={() => router.push('/(company)/settings/subscription')}>
              <View style={[styles.gridIcon, { backgroundColor: '#1A0A2E' }]}>
                <CreditCard size={22} color={'#A78BFA'} />
              </View>
              <Text style={[styles.gridLabel, { color: '#FFFFFF' }]}>{t('company.subscription')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.gridCard, { backgroundColor: '#FFFFFF' }]} onPress={() => router.push('/(company)/jobs/v2/browse')}>
              <View style={[styles.gridIcon, { backgroundColor: '#0A0A2E' }]}>
                <MagnifyingGlass size={22} color={'#818CF8'} />
              </View>
              <Text style={[styles.gridLabel, { color: '#FFFFFF' }]}>{t('company.browseJobs')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.gridCard, { backgroundColor: '#FFFFFF' }]} onPress={() => router.push('/(company)/jobs/v2/my-quotes')}>
              <View style={[styles.gridIcon, { backgroundColor: '#0A1A2E' }]}>
                <FileText size={22} color={'#3B82F6'} />
              </View>
              <Text style={[styles.gridLabel, { color: '#FFFFFF' }]}>{t('company.myQuotes')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
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
  greeting: { fontSize: 11, fontFamily: fonts.body },
  userName: { fontSize: 16, fontFamily: fonts.headingBold, marginTop: 1 },
  headerIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 16 },
  section: { marginHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: fonts.headingBold, letterSpacing: -0.2 },
  seeAll: { fontSize: 12, fontFamily: fonts.bodyMedium },
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
  revenueLabel: { fontSize: 11, fontFamily: fonts.body, marginTop: 2 },
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
  gridLabel: { fontSize: 12, fontFamily: fonts.bodyMedium, textAlign: 'center' },
})
