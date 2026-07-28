import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { translateJobStatus } from '../../../lib/i18n'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Bell, Briefcase, MagnifyingGlass, ChatCircle, User, Flame, Star, CheckCircle, Lightning, ArrowRight, MapPin, Clock, Wallet, House, Buildings, CaretRight, Users, Trophy, Wrench, Sun } from 'phosphor-react-native'
import * as Notifications from 'expo-notifications'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { v2Jobs } from '../../../lib/api-v2'
import { taskers as api } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import StatsCard from '../../../components/ui/StatsCard'
import JobCard from '../../../components/ui/JobCard'
import JobLifecycleTracker from '../../../components/ui/JobLifecycleTracker'
import AISearchBar from '../../../components/shared/AISearchBar'
import PropertyCard from '../../../components/shared/PropertyCard'

export default function TaskerDashboard() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { user } = useAuth()
  const statusColors: Record<string, string> = {
    OPEN: colors.amber,
    IN_PROGRESS: '#3B82F6',
    QUOTE_ACCEPTED: '#8B5CF6',
    ESCROW_DEPOSITED: '#06B6D4',
    COMPLETED: colors.success,
    CANCELLED: colors.error,
  }
  const [isOnline, setIsOnline] = useState(true)
  const [openJobs, setOpenJobs] = useState<any[]>([])
  const [myJobs, setMyJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const lastPollRef = useRef<string>(new Date().toISOString())
  const pollIntervalRef = useRef<ReturnType<typeof setInterval>>()
  const alertedJobsRef = useRef<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    try {
      const [openRes, myRes] = await Promise.all([
        v2Jobs.list('role=provider'),
        v2Jobs.list('myQuotes=true'),
      ])
      setOpenJobs((openRes.jobs || []).slice(0, 5))
      setMyJobs(myRes.jobs || [])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const toggleOnline = useCallback(async () => {
    const next = !isOnline
    try {
      await api.setOnline(next)
      setIsOnline(next)
    } catch {}
  }, [isOnline])

  useEffect(() => {
    if (!isOnline) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      return
    }
    lastPollRef.current = new Date().toISOString()
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await v2Jobs.pollNew(lastPollRef.current)
        if (res.jobs && res.jobs.length > 0) {
          lastPollRef.current = new Date().toISOString()
          for (const job of res.jobs) {
            if (alertedJobsRef.current.has(job.id)) continue
            alertedJobsRef.current.add(job.id)
            await Notifications.scheduleNotificationAsync({
              content: {
                title: t('tasker.newJobAlert'),
                body: `${job.title || ''} — LKR ${(job.budgetAmount || 0).toLocaleString()}`,
                data: { jobId: job.id, screen: '/(tasker)/jobs/v2/quote/[id]' },
                sound: true,
              },
              trigger: null,
            })
          }
        }
      } catch {}
    }, 15000)
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [isOnline, t])

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(res => {
      const data = res.notification.request.content.data
      if (data?.jobId && data?.screen) {
        router.push(data.screen.replace('[id]', data.jobId))
      }
    })
    return () => sub.remove()
  }, [])

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return t('home.greeting.morning')
    if (h < 17) return t('home.greeting.afternoon')
    return t('home.greeting.evening')
  }

  const profile = { rating: 4.0, completedJobs: 12, activeCount: myJobs.filter((j: any) => j.status === 'IN_PROGRESS').length }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.avatar, { backgroundColor: colors.amber }]}>
                <Text style={styles.avatarText}>{(user?.name || 'T')[0]}</Text>
              </View>
              <View>
                <Text style={[styles.greeting, { color: colors.muted }]}>{getGreeting()}</Text>
                <Text style={[styles.userName, { color: colors.ink }]}>{user?.name || t('customer.tasker')}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.onlineToggle, { backgroundColor: isOnline ? '#059669' : colors.border }]}
              onPress={toggleOnline}
              activeOpacity={0.7}
            >
              <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#fff' : colors.muted }]} />
              <Text style={[styles.onlineText, { color: isOnline ? '#fff' : colors.muted }]}>
                {isOnline ? t('tasker.online') : t('tasker.offline')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* AI Search */}
        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
          <AISearchBar
            placeholder={t('tasker.searchJobs')}
            onCategorySelect={(catId, catName) => {
              router.push({ pathname: '/(customer)/search', params: { category: catId, name: catName } })
            }}
            onJobSelect={(jobId, jobName) => {
              router.push({ pathname: '/(customer)/search', params: { category: jobId, name: jobName } })
            }}
            onPostJob={(query) => {
              router.push({ pathname: '/(customer)/search/post-job-confirm', params: { q: query } })
            }}
          />
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Star size={20} color={colors.amber} weight="fill" />
            <Text style={[styles.statValue, { color: colors.ink }]}>{profile.rating.toFixed(1)}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>{t('tasker.rating')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <CheckCircle size={20} color={colors.success} weight="fill" />
            <Text style={[styles.statValue, { color: colors.ink }]}>{profile.completedJobs}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>{t('tasker.jobsDone')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Lightning size={20} color="#3B82F6" weight="fill" />
            <Text style={[styles.statValue, { color: colors.ink }]}>{profile.activeCount}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>{t('tasker.active')}</Text>
          </View>
        </View>

        {/* Active Jobs */}
        {myJobs.filter((j: any) => j.status !== 'COMPLETED' && j.status !== 'CANCELLED').length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('tasker.activeJobs')}</Text>
              <TouchableOpacity onPress={() => router.push('/(tasker)/jobs/v2/my-jobs')} style={styles.seeAllBtn}>
                <Text style={[styles.seeAll, { color: colors.amberDark }]}>{t('tasker.seeAll')}</Text>
                <CaretRight size={14} color={colors.amberDark} weight="bold" />
              </TouchableOpacity>
            </View>
            {myJobs.filter((j: any) => j.status !== 'COMPLETED' && j.status !== 'CANCELLED').slice(0, 2).map((job: any) => (
              <TouchableOpacity
                key={job.id}
                style={[styles.activeJobCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.push(`/(tasker)/jobs/v2/manage/${job.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.activeJobTop}>
                  <Text style={[styles.activeJobTitle, { color: colors.ink }]}>{job.title}</Text>
                  <View style={[styles.activeStatusPill, { backgroundColor: statusColors[job.status] || colors.muted }]}>
                    <Text style={styles.activeStatusText}>{t(translateJobStatus(job.status))}</Text>
                  </View>
                </View>
                <JobLifecycleTracker status={job.status} createdAt={job.createdAt} />
                <Text style={[styles.activeBudget, { color: colors.amberDark }]}>LKR {job.budgetAmount}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Hot Offers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('home.hotOffers')}</Text>
            <TouchableOpacity onPress={() => router.push('/real-estate')} style={styles.seeAllBtn}>
              <Text style={[styles.seeAll, { color: colors.amberDark }]}>{t('tasker.seeAll')}</Text>
              <CaretRight size={14} color={colors.amberDark} weight="bold" />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {openJobs.slice(0, 4).map((job) => (
              <TouchableOpacity
                key={job.id}
                style={[styles.hotCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.push(`/(tasker)/jobs/v2/quote/${job.id}`)}
              >
                <View style={[styles.hotCardTop, { backgroundColor: colors.amberBg }]}>
                  <Flame size={20} color={colors.amberDark} weight="fill" />
                </View>
                <Text style={[styles.hotCardTitle, { color: colors.ink }]} numberOfLines={1}>
                  {job.title || t('home.hotOffersList.hotDeal')}
                </Text>
                <Text style={[styles.hotCardPrice, { color: colors.amberDark }]}>
                  LKR {job.budgetAmount?.toLocaleString() || '—'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Jobs Near You */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('home.jobsNearYou')}</Text>
            <TouchableOpacity onPress={() => router.push('/(tasker)/jobs/v2/browse')} style={styles.seeAllBtn}>
              <Text style={[styles.seeAll, { color: colors.amberDark }]}>{t('tasker.seeAll')}</Text>
              <CaretRight size={14} color={colors.amberDark} weight="bold" />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 12 }} />
          ) : openJobs.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MagnifyingGlass size={32} color={colors.muted} weight="regular" />
              <Text style={[styles.emptyText, { color: colors.muted }]}>{t('tasker.noJobsFound')}</Text>
            </View>
          ) : (
            openJobs.slice(0, 4).map((job) => (
              <JobCard
                key={job.id}
                title={job.title || t('jobs.untitled')}
                category={job.categoryName || t('categories.general')}
                budget={job.budgetAmount}
                location={job.locationName}
                urgency={job.urgency}
                status={job.status}
                onPress={() => router.push(`/(tasker)/jobs/v2/quote/${job.id}`)}
                onApply={() => router.push(`/(tasker)/jobs/v2/quote/${job.id}`)}
              />
            ))
          )}
        </View>

        {/* Real Estate */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('realEstate.title')}</Text>
            <TouchableOpacity onPress={() => router.push('/real-estate')} style={styles.seeAllBtn}>
              <Text style={[styles.seeAll, { color: colors.amberDark }]}>{t('tasker.seeAll')}</Text>
              <CaretRight size={14} color={colors.amberDark} weight="bold" />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
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

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.ink, marginBottom: 12 }]}>{t('home.postOptions.title')}</Text>
          <View style={styles.grid}>
            <TouchableOpacity style={[styles.gridCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/post-job')}>
              <View style={[styles.gridIcon, { backgroundColor: colors.amberBg }]}>
                <Briefcase size={22} color={colors.amberDark} weight="fill" />
              </View>
              <Text style={[styles.gridLabel, { color: colors.ink }]}>{t('tasker.postJob')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.gridCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/(tabs)/find/index')}>
              <View style={[styles.gridIcon, { backgroundColor: '#DBEAFE' }]}>
                <MagnifyingGlass size={22} color="#3B82F6" weight="bold" />
              </View>
              <Text style={[styles.gridLabel, { color: colors.ink }]}>{t('tasker.findWork')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.gridCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/(customer)/jobs/new')}>
              <View style={[styles.gridIcon, { backgroundColor: '#D1FAE5' }]}>
                <ChatCircle size={22} color="#059669" weight="fill" />
              </View>
              <Text style={[styles.gridLabel, { color: colors.ink }]}>{t('tasker.quickBooking')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.gridCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/settings/my-profile')}>
              <View style={[styles.gridIcon, { backgroundColor: '#EDE9FE' }]}>
                <User size={22} color="#7C3AED" weight="fill" />
              </View>
              <Text style={[styles.gridLabel, { color: colors.ink }]}>{t('tasker.myProfile')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 32 },
  headerCard: { marginHorizontal: 16, marginTop: 8, borderRadius: 20, padding: 16, borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 16, elevation: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontFamily: fonts.headingBold, color: '#111827' },
  greeting: { fontSize: 11, fontFamily: fonts.body, letterSpacing: 0.3 },
  userName: { fontSize: 16, fontFamily: fonts.headingBold, marginTop: 1 },
  onlineToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: { fontSize: 12, fontFamily: fonts.bodySemiBold },
  statsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 16 },
  statCard: { flex: 1, borderRadius: 20, padding: 16, alignItems: 'center', gap: 4, borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  statValue: { fontSize: 22, fontFamily: fonts.headingBold, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontFamily: fonts.body, textTransform: 'uppercase', letterSpacing: 0.5 },
  section: { marginHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontFamily: fonts.heading, letterSpacing: -0.3 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAll: { fontSize: 13, fontFamily: fonts.bodyMedium },
  horizontalScroll: { gap: 10, paddingRight: 16 },
  hotCard: { minWidth: 170, borderRadius: 20, padding: 16, borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 16, elevation: 4 },
  hotCardTop: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  hotCardTitle: { fontSize: 14, fontFamily: fonts.bodyMedium, marginBottom: 6 },
  hotCardPrice: { fontSize: 16, fontFamily: fonts.headingBold, letterSpacing: -0.3 },
  emptyBox: { borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1.5, borderStyle: 'dashed', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 16, elevation: 4 },
  emptyText: { fontSize: 13, fontFamily: fonts.body, marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCard: { width: '48%', borderRadius: 20, padding: 18, alignItems: 'center', borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 16, elevation: 4 },
  gridIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  gridLabel: { fontSize: 13, fontFamily: fonts.bodyMedium, textAlign: 'center' },
  activeJobCard: { borderRadius: 20, padding: 18, marginBottom: 10, borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  activeJobTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  activeJobTitle: { fontSize: 15, fontFamily: fonts.bodyMedium, flex: 1 },
  activeStatusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
  activeStatusText: { fontSize: 10, fontFamily: fonts.bodySemiBold, color: '#fff' },
  activeBudget: { fontSize: 16, fontFamily: fonts.headingBold, textAlign: 'right', marginTop: 6 },
})
