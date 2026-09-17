import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Bell, Star, CheckCircle, MapPin, ArrowRight, Timer, Wallet, Lightning, Coffee, AlertTriangle } from 'phosphor-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuth } from '../../../lib/auth'
import { taskers, earnings, notifications } from '../../../lib/api'
import { v2Jobs, v2Identity } from '../../../lib/api-v2'
import { on } from '../../../lib/events'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { categoryIcon } from '../../../lib/categoryVisuals'

import AvatarCircle from '../../../components/ui/AvatarCircle'
import PressableScale from '../../../components/ui/PressableScale'
import Skeleton from '../../../components/ui/Skeleton'
import AnimatedEntry from '../../../components/ui/AnimatedEntry'

let Notifications: any = null
try { Notifications = require('expo-notifications') } catch {}

const ACTIVE_STATUSES = ['QUOTE_ACCEPTED', 'PENDING_PAYMENT', 'ESCROW_DEPOSITED', 'IN_PROGRESS']

export default function TaskerDashboard() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user } = useAuth()
  const colors = useColors()

  const [isOnline, setIsOnline] = useState(true)
  const [openJobs, setOpenJobs] = useState<any[]>([])
  const [myJobs, setMyJobs] = useState<any[]>([])
  const [earningsData, setEarningsData] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [readinessComplete, setReadinessComplete] = useState(true)

  const lastPollRef = useRef<string>(new Date().toISOString())
  const pollIntervalRef = useRef<ReturnType<typeof setInterval>>()
  const alertedJobsRef = useRef<Set<string>>(new Set())
  const chatVisible = useRef(false)

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const [openRes, myRes, earningsRes, profileRes] = await Promise.allSettled([
        v2Jobs.list('role=provider'),
        v2Jobs.list('myQuotes=true'),
        earnings.get(),
        taskers.getMyProfile(),
      ])
      if (openRes.status === 'fulfilled') setOpenJobs((openRes.value.jobs || []).slice(0, 6))
      if (myRes.status === 'fulfilled') setMyJobs(myRes.value.jobs || [])
      if (earningsRes.status === 'fulfilled') setEarningsData(earningsRes.value)
      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value)
        if (typeof profileRes.value.isOnline === 'boolean') setIsOnline(profileRes.value.isOnline)
        const p = profileRes.value as any
        const hasProfession = !!p.taskerProfile?.professionId
        const hasSkills = Array.isArray(p.taskerProfile?.skills) && p.taskerProfile.skills.length > 0
        const hasArea = !!p.areaId
        setReadinessComplete(hasProfession && hasSkills && hasArea)
      }
      const idRes = await Promise.allSettled([v2Identity.getStatus()])
      if (idRes[0].status === 'fulfilled') {
        const idStatus = (idRes[0] as any).value?.identityStatus
        if (idStatus !== 'VERIFIED' && idStatus !== 'APPROVED') setReadinessComplete(false)
      }
      notifications.unreadCount().then((r: any) => setUnreadCount(r.count || 0)).catch(() => {})
    } catch {
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { const unsub = on('jobsChanged', () => setRefreshKey(k => k + 1)); return () => unsub() }, [])
  useEffect(() => { if (refreshKey > 0) loadData() }, [refreshKey, loadData])
  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const sub = Notifications?.addNotificationResponseReceivedListener
      ? Notifications.addNotificationResponseReceivedListener((res: any) => {
          const data = res.notification.request.content.data
          if (data?.jobId && data?.screen) router.push(data.screen.replace('[id]', data.jobId))
        })
      : null
    return () => sub?.remove()
  }, [])

  const toggleOnline = useCallback(async () => {
    const next = !isOnline
    try { setIsOnline(next); await taskers.setOnline(next) } catch { setIsOnline(!next) }
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
            await Notifications?.scheduleNotificationAsync?.({
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
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current) }
  }, [isOnline, t])

  const activeJob = myJobs.find((j: any) => ACTIVE_STATUSES.includes(j.status))
  const availableJobs = openJobs.filter((j: any) => !myJobs.some((m: any) => m.id === j.id))

  const earningsToday = useCallback(() => {
    const today = new Date().toDateString()
    const payouts = earningsData?.recentPayouts || []
    const clearedToday = payouts.filter((p: any) => {
      const d = new Date(p.clearedAt || p.createdAt)
      return d.toDateString() === today && p.status === 'CLEARED'
    })
    const sum = clearedToday.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0)
    return sum || null
  }, [earningsData])

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return t('home.greeting.morning')
    if (h < 17) return t('home.greeting.afternoon')
    return t('home.greeting.evening')
  }
  const firstName = (user?.name || t('customer.tasker')).split(' ')[0]
  const balance = Number(earningsData?.availableBalance ?? 0)
  const today = earningsToday()
  const rating = profile?.rating ?? 0
  const doneJobs = profile?.completedJobs ?? earningsData?.completedJobs ?? 0

  const activeId = activeJob?.id
  const activeBudget = activeJob ? Number(activeJob.budgetAmount || 0) : 0

  const styles = makeStyles(colors)

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor="#F5A623" />}
      >
        {/* ═══ Top bar ═══ */}
        <View style={styles.headerRow}>
          <View style={styles.greetingBlock}>
            <Text style={styles.greetingSub}>{getGreeting()},</Text>
            <Text style={styles.greetingName}>{firstName} 👋</Text>
          </View>
          <PressableScale onPress={() => router.push('/notifications')} scaleTo={0.94} style={styles.iconBtnPress}>
            <View style={styles.iconBtn}>
              <Bell size={20} color="#FFFFFF" weight="regular" />
              {unreadCount > 0 ? <View style={styles.bellDot} /> : null}
            </View>
          </PressableScale>
        </View>

        {/* ═══ Availability ═══ */}
        <PressableScale onPress={toggleOnline} scaleTo={0.99} style={styles.availPress}>
          <LinearGradient
            colors={isOnline ? ['#F5A623', '#D4900A'] : ['#FFFFFF', '#2E2E2E']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.availCard, !isOnline && styles.availCardOffline]}
          >
            <View style={styles.availLeft}>
              <View style={[styles.availDot, { backgroundColor: isOnline ? '#0D0D0D' : '#6F6B6B' }]} />
              <View>
                <Text style={[styles.availTitle, { color: isOnline ? '#0D0D0D' : '#FFFFFF' }]}>
                  {isOnline ? t('ui.youreOnline') : t('ui.youreOffline')}
                </Text>
                <Text style={[styles.availSub, { color: isOnline ? 'rgba(11,12,18,0.7)' : '#6F6B6B' }]}>
                  {isOnline ? t('ui.tapToPause') : t('ui.tapToStart')}
                </Text>
              </View>
            </View>
            <View style={[styles.availBadge, isOnline ? styles.availBadgeOn : styles.availBadgeOff]}>
              {!isOnline && <View style={styles.availPing} />}
              <Text style={[styles.availBadgeText, { color: isOnline ? '#0D0D0D' : '#FFFFFF' }]}>
                {isOnline ? t('tasker.online') : t('tasker.paused')}
              </Text>
            </View>
          </LinearGradient>
        </PressableScale>

        {/* ═══ Readiness banner ═══ */}
        {!loading && !readinessComplete && (
          <AnimatedEntry delay={60}>
            <PressableScale onPress={() => router.push('/(tasker)/readiness' as any)} scaleTo={0.98}>
              <View style={styles.readinessBanner}>
                <AlertTriangle size={20} color="#D97706" weight="fill" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.readinessTitle}>{t('readiness.notReady')}</Text>
                  <Text style={styles.readinessSub}>{t('readiness.completeSetup')}</Text>
                </View>
                <ArrowRight size={16} color="#D97706" weight="bold" />
              </View>
            </PressableScale>
          </AnimatedEntry>
        )}

        {/* ═══ Earnings card ═══ */}
        <AnimatedEntry delay={80}>
          <View style={styles.earnCard}>
            <View style={styles.earnHead}>
              <Text style={styles.earnLabel}>{t('ui.availableBalance')}</Text>
              <Wallet size={18} color="#F5A623" weight="fill" />
            </View>
            <Text style={styles.earnBalance}>LKR {balance.toLocaleString()}</Text>
            <View style={styles.chipRow}>
              <View style={styles.chip}>
                <Lightning size={14} color="#F5A623" weight="fill" />
                <Text style={styles.chipValue}>{today !== null ? `+${today.toLocaleString()}` : '—'}</Text>
                <Text style={styles.chipLabel}>{t('ui.today')}</Text>
              </View>
              <View style={styles.chip}>
                <CheckCircle size={14} color="#F5A623" weight="fill" />
                <Text style={styles.chipValue}>{doneJobs}</Text>
                <Text style={styles.chipLabel}>{t('tasker.jobsDone')}</Text>
              </View>
              <View style={styles.chip}>
                <Star size={14} color="#F5A623" weight="fill" />
                <Text style={styles.chipValue}>{rating ? rating.toFixed(1) : '—'}</Text>
                <Text style={styles.chipLabel}>{t('tasker.rating')}</Text>
              </View>
            </View>
          </View>
        </AnimatedEntry>

        {/* ═══ Active job ═══ */}
        {loading && myJobs.length === 0 ? (
          <View style={styles.activeWrap}>
            <Skeleton width="100%" height={120} radius={20} />
          </View>
        ) : activeJob ? (
          <AnimatedEntry delay={120}>
            <PressableScale onPress={() => router.push(`/(tasker)/jobs/v2/manage/${activeId}` as any)} scaleTo={0.98} style={styles.activePress}>
              <LinearGradient colors={['#F5A623', '#D4900A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.activeCard}>
                <View style={styles.activeGlow} />
                <View style={styles.activeHead}>
                  <Text style={styles.activeLabel}>{t('ui.activeJob')}</Text>
                  <View style={styles.activeCountPill}>
                    <Timer size={12} color="#0D0D0D" weight="fill" />
                    <Text style={styles.activeCountText}>{activeBudget > 0 ? `LKR ${activeBudget.toLocaleString()}` : ''}</Text>
                  </View>
                </View>
                <Text style={styles.activeTitle} numberOfLines={1}>{activeJob.title || 'Your job'}</Text>
                <View style={styles.activeMeta}>
                  <MapPin size={13} color="#0D0D0D" weight="fill" />
                  <Text style={styles.activeMetaText} numberOfLines={1}>{activeJob.locationName || 'Location shared in chat'}</Text>
                </View>
                <View style={styles.activeCtaRow}>
                  <View style={styles.activeCta}>
                    <ArrowRight size={16} color="#0D0D0D" weight="bold" />
                    <Text style={styles.activeCtaText}>{t('ui.openJob')}</Text>
                  </View>
                </View>
              </LinearGradient>
            </PressableScale>
          </AnimatedEntry>
        ) : (
          <View style={styles.idleCard}>
            <Coffee size={18} color="#F5A623" weight="fill" />
            <Text style={styles.idleText}>{t('ui.noActiveJobs')}</Text>
            <PressableScale onPress={() => router.push('/(tasker)/jobs/v2/browse' as any)} scaleTo={0.96}>
              <Text style={styles.idleCta}>{t('ui.browseWork')} →</Text>
            </PressableScale>
          </View>
        )}

        {/* ═══ Available jobs ═══ */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('ui.newJobsNearYou')}</Text>
          <PressableScale onPress={() => router.push('/(tasker)/jobs/v2/browse' as any)} scaleTo={0.96}>
            <Text style={styles.seeAll}>{t('tasker.seeAll')} →</Text>
          </PressableScale>
        </View>
        {loading && availableJobs.length === 0 ? (
          <View style={styles.feedGap}>
            <Skeleton width="100%" height={92} radius={16} />
            <Skeleton width="100%" height={92} radius={16} />
          </View>
        ) : availableJobs.length === 0 ? (
          <View style={styles.feedEmpty}>
            <Text style={styles.feedEmptyText}>{t('tasker.noJobsFound')}</Text>
          </View>
        ) : (
          <View style={styles.feedGap}>
            {availableJobs.slice(0, 4).map((job, i) => {
              const Icon = categoryIcon(job.categoryId)
              return (
                <AnimatedEntry key={job.id} delay={i * 70}>
                  <View style={styles.jobCard}>
                    <View style={styles.jobIconBox}>
                      <Icon size={22} color="#F5A623" weight="fill" />
                    </View>
                    <View style={styles.jobBody}>
                      <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                      <View style={styles.jobMetaRow}>
                        <MapPin size={12} color="#6F6B6B" weight="fill" />
                        <Text style={styles.jobMetaText} numberOfLines={1}>{job.locationName || t('ui.nearYou')}</Text>
                      </View>
                      <Text style={styles.jobBudget}>LKR {(job.budgetAmount || 0).toLocaleString()}</Text>
                    </View>
                    <PressableScale onPress={() => router.push(`/(tasker)/jobs/v2/quote/${job.id}` as any)} scaleTo={0.96} style={styles.quotePress}>
                      <View style={styles.quoteBtn}>
                        <Text style={styles.quoteText}>{t('ui.quoteNow')}</Text>
                      </View>
                    </PressableScale>
                  </View>
                </AnimatedEntry>
              )
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  scroll: { paddingBottom: 32, paddingHorizontal: 16 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  greetingBlock: {},
  greetingSub: { fontSize: 14, fontFamily: fonts.bodyMedium, color: '#6F6B6B' },
  greetingName: { fontSize: 28, fontFamily: fonts.heading, color: '#FFFFFF', letterSpacing: -0.5, marginTop: 2 },
  iconBtnPress: { borderRadius: 999 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 999,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#2E2E2E',
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  bellDot: {
    position: 'absolute', top: 8, right: 9, width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#F5A623', borderWidth: 1.5, borderColor: '#0D0D0D',
  },

  availPress: { marginTop: 24, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  availCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, padding: 16 },
  availCardOffline: { borderWidth: 1, borderColor: '#2E2E2E' },
  availLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  availDot: { width: 12, height: 12, borderRadius: 6 },
  availTitle: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  availSub: { fontFamily: fonts.body, marginTop: 2, fontSize: 12, color: '#6F6B6B' },
  availBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  availBadgeOn: { backgroundColor: '#0D0D0D' },
  availBadgeOff: { backgroundColor: '#2E2E2E', borderWidth: 1, borderColor: '#2E2E2E' },
  availPing: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F5A623' },
  availBadgeText: { fontFamily: fonts.body, fontSize: 12 },

  earnCard: { marginTop: 24, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#2E2E2E', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  earnHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  earnLabel: { fontFamily: fonts.body, color: '#6F6B6B', fontSize: 12 },
  earnBalance: { fontSize: 30, fontFamily: fonts.heading, color: '#F5A623', letterSpacing: -0.5, marginTop: 4 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 24 },
  chip: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, backgroundColor: '#2E2E2E', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8 },
  chipValue: { fontFamily: fonts.body, color: '#FFFFFF', fontSize: 12 },
  chipLabel: { fontFamily: fonts.body, color: '#6F6B6B', fontSize: 12 },

  activeWrap: { marginTop: 24 },
  activePress: { marginTop: 24, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  activeCard: { borderRadius: 16, padding: 24, overflow: 'hidden' },
  activeGlow: { position: 'absolute', right: -40, top: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.12)' },
  activeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  activeLabel: { fontFamily: fonts.bodySemiBold, color: '#0D0D0D', opacity: 0.85, fontSize: 12 },
  activeCountPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(11,12,18,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  activeCountText: { fontFamily: fonts.bodySemiBold, color: '#FFFFFF', fontSize: 12 },
  activeTitle: { fontSize: 21, fontFamily: fonts.heading, color: '#0D0D0D' },
  activeMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  activeMetaText: { fontFamily: fonts.body, color: '#0D0D0D', opacity: 0.9, flex: 1, fontSize: 12 },
  activeCtaRow: { marginTop: 24 },
  activeCta: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#0D0D0D', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999,
  },
  activeCtaText: { fontFamily: fonts.bodyMedium, color: '#FFFFFF', fontSize: 14 },

  idleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2E2E2E',
  },
  idleText: { fontFamily: fonts.body, color: '#6F6B6B', flex: 1, fontSize: 14 },
  idleCta: { fontFamily: fonts.body, color: '#F5A623', fontSize: 12 },

  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontFamily: fonts.heading, color: '#FFFFFF' },
  seeAll: { fontFamily: fonts.body, color: '#F5A623', fontSize: 12 },

  feedGap: { gap: 8 },
  jobCard: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#2E2E2E',
  },
  jobIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF1D2', alignItems: 'center', justifyContent: 'center' },
  jobBody: { flex: 1, marginLeft: 16 },
  jobTitle: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: '#FFFFFF' },
  jobMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  jobMetaText: { fontFamily: fonts.body, color: '#6F6B6B', flex: 1, fontSize: 12 },
  jobBudget: { fontFamily: fonts.body, color: '#F5A623', fontSize: 12, marginTop: 4 },
  quotePress: { paddingLeft: 8 },
  quoteBtn: { backgroundColor: '#F5A623', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  quoteText: { fontFamily: fonts.body, color: '#0D0D0D', fontSize: 12 },

  feedEmpty: { alignItems: 'center', paddingVertical: 32, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#2E2E2E', borderStyle: 'dashed' },
  feedEmptyText: { fontFamily: fonts.body, color: '#6F6B6B', fontSize: 14 },

  readinessBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 24,
    backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#FDE68A',
  },
  readinessTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  readinessSub: { fontSize: 12, color: '#B45309', marginTop: 2 },
})
