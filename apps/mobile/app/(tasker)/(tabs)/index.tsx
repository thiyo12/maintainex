import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Bell, Star, CheckCircle, MapPin, ArrowRight, Timer, Wallet, Lightning, Coffee } from 'phosphor-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuth } from '../../../lib/auth'
import { taskers, earnings, notifications } from '../../../lib/api'
import { v2Jobs } from '../../../lib/api-v2'
import { on } from '../../../lib/events'
import { colors, spacing, radius, typography, shadows } from '../../../lib/design'
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

  const [isOnline, setIsOnline] = useState(true)
  const [openJobs, setOpenJobs] = useState<any[]>([])
  const [myJobs, setMyJobs] = useState<any[]>([])
  const [earningsData, setEarningsData] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={colors.accent} />}
      >
        {/* ═══ Top bar ═══ */}
        <View style={styles.headerRow}>
          <View style={styles.greetingBlock}>
            <Text style={styles.greetingSub}>{getGreeting()},</Text>
            <Text style={styles.greetingName}>{firstName} 👋</Text>
          </View>
          <PressableScale onPress={() => router.push('/notifications')} scaleTo={0.94} style={styles.iconBtnPress}>
            <View style={styles.iconBtn}>
              <Bell size={20} color={colors.textPrimary} weight="regular" />
              {unreadCount > 0 ? <View style={styles.bellDot} /> : null}
            </View>
          </PressableScale>
        </View>

        {/* ═══ Availability ═══ */}
        <PressableScale onPress={toggleOnline} scaleTo={0.99} style={styles.availPress}>
          <LinearGradient
            colors={isOnline ? [colors.accent, colors.accentDim] : [colors.surface, colors.surfaceHigh]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.availCard, !isOnline && styles.availCardOffline]}
          >
            <View style={styles.availLeft}>
              <View style={[styles.availDot, { backgroundColor: isOnline ? colors.background : colors.textSecondary }]} />
              <View>
                <Text style={[styles.availTitle, { color: isOnline ? colors.background : colors.textPrimary }]}>
                  {isOnline ? t('ui.youreOnline') : t('ui.youreOffline')}
                </Text>
                <Text style={[styles.availSub, { color: isOnline ? 'rgba(11,12,18,0.7)' : colors.textSecondary }]}>
                  {isOnline ? t('ui.tapToPause') : t('ui.tapToStart')}
                </Text>
              </View>
            </View>
            <View style={[styles.availBadge, isOnline ? styles.availBadgeOn : styles.availBadgeOff]}>
              {!isOnline && <View style={styles.availPing} />}
              <Text style={[styles.availBadgeText, { color: isOnline ? colors.background : colors.textPrimary }]}>
                {isOnline ? t('tasker.online') : t('tasker.paused')}
              </Text>
            </View>
          </LinearGradient>
        </PressableScale>

        {/* ═══ Earnings card ═══ */}
        <AnimatedEntry delay={80}>
          <View style={styles.earnCard}>
            <View style={styles.earnHead}>
              <Text style={styles.earnLabel}>{t('ui.availableBalance')}</Text>
              <Wallet size={18} color={colors.accent} weight="fill" />
            </View>
            <Text style={styles.earnBalance}>LKR {balance.toLocaleString()}</Text>
            <View style={styles.chipRow}>
              <View style={styles.chip}>
                <Lightning size={14} color={colors.accent} weight="fill" />
                <Text style={styles.chipValue}>{today !== null ? `+${today.toLocaleString()}` : '—'}</Text>
                <Text style={styles.chipLabel}>{t('ui.today')}</Text>
              </View>
              <View style={styles.chip}>
                <CheckCircle size={14} color={colors.accent} weight="fill" />
                <Text style={styles.chipValue}>{doneJobs}</Text>
                <Text style={styles.chipLabel}>{t('tasker.jobsDone')}</Text>
              </View>
              <View style={styles.chip}>
                <Star size={14} color={colors.accent} weight="fill" />
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
              <LinearGradient colors={[colors.accent, colors.accentDim]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.activeCard}>
                <View style={styles.activeGlow} />
                <View style={styles.activeHead}>
                  <Text style={styles.activeLabel}>{t('ui.activeJob')}</Text>
                  <View style={styles.activeCountPill}>
                    <Timer size={12} color={colors.background} weight="fill" />
                    <Text style={styles.activeCountText}>{activeBudget > 0 ? `LKR ${activeBudget.toLocaleString()}` : ''}</Text>
                  </View>
                </View>
                <Text style={styles.activeTitle} numberOfLines={1}>{activeJob.title || 'Your job'}</Text>
                <View style={styles.activeMeta}>
                  <MapPin size={13} color={colors.background} weight="fill" />
                  <Text style={styles.activeMetaText} numberOfLines={1}>{activeJob.locationName || 'Location shared in chat'}</Text>
                </View>
                <View style={styles.activeCtaRow}>
                  <View style={styles.activeCta}>
                    <ArrowRight size={16} color={colors.background} weight="bold" />
                    <Text style={styles.activeCtaText}>{t('ui.openJob')}</Text>
                  </View>
                </View>
              </LinearGradient>
            </PressableScale>
          </AnimatedEntry>
        ) : (
          <View style={styles.idleCard}>
            <Coffee size={18} color={colors.accent} weight="fill" />
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
                      <Icon size={22} color={colors.accent} weight="fill" />
                    </View>
                    <View style={styles.jobBody}>
                      <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                      <View style={styles.jobMetaRow}>
                        <MapPin size={12} color={colors.textSecondary} weight="fill" />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 32, paddingHorizontal: spacing.md },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.sm },
  greetingBlock: {},
  greetingSub: { ...typography.bodyMuted, fontSize: 14, fontFamily: 'Outfit_500Medium' },
  greetingName: { ...typography.h1, fontSize: 28, letterSpacing: -0.5, marginTop: 2 },
  iconBtnPress: { borderRadius: radius.full },
  iconBtn: {
    width: 44, height: 44, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  bellDot: {
    position: 'absolute', top: 8, right: 9, width: 9, height: 9, borderRadius: 5,
    backgroundColor: colors.accent, borderWidth: 1.5, borderColor: colors.background,
  },

  availPress: { marginTop: spacing.lg, borderRadius: radius.lg, ...shadows.card },
  availCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.lg, padding: spacing.md },
  availCardOffline: { borderWidth: 1, borderColor: colors.border },
  availLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  availDot: { width: 12, height: 12, borderRadius: 6 },
  availTitle: { ...typography.body, fontFamily: 'Outfit_700Bold', fontSize: 15 },
  availSub: { ...typography.caption, marginTop: 2 },
  availBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
  availBadgeOn: { backgroundColor: colors.background },
  availBadgeOff: { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  availPing: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  availBadgeText: { ...typography.caption, fontFamily: 'Outfit_700Bold' },

  earnCard: { marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.card },
  earnHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  earnLabel: { ...typography.label, color: colors.textSecondary },
  earnBalance: { ...typography.h1, fontSize: 30, color: colors.accent, letterSpacing: -0.5, marginTop: 4 },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  chip: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 8 },
  chipValue: { ...typography.caption, color: colors.textPrimary, fontFamily: 'Outfit_700Bold' },
  chipLabel: { ...typography.caption, color: colors.textSecondary },

  activeWrap: { marginTop: spacing.lg },
  activePress: { marginTop: spacing.lg, borderRadius: radius.lg, ...shadows.card },
  activeCard: { borderRadius: radius.lg, padding: spacing.lg, overflow: 'hidden' },
  activeGlow: { position: 'absolute', right: -40, top: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.12)' },
  activeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  activeLabel: { ...typography.label, color: colors.background, opacity: 0.85, fontFamily: 'Outfit_600SemiBold' },
  activeCountPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(11,12,18,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  activeCountText: { ...typography.caption, color: colors.textPrimary, fontFamily: 'Outfit_600SemiBold' },
  activeTitle: { ...typography.h3, fontSize: 21, color: colors.background },
  activeMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm },
  activeMetaText: { ...typography.caption, color: colors.background, opacity: 0.9, flex: 1 },
  activeCtaRow: { marginTop: spacing.lg },
  activeCta: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.background, paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.full,
  },
  activeCtaText: { ...typography.body, color: colors.textPrimary, fontFamily: 'Outfit_700Bold', fontSize: 14 },

  idleCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  idleText: { ...typography.body, color: colors.textSecondary, flex: 1, fontSize: 14, fontFamily: 'Outfit_500Medium' },
  idleCta: { ...typography.caption, color: colors.accent, fontFamily: 'Outfit_700Bold' },

  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, fontSize: 18 },
  seeAll: { ...typography.caption, color: colors.accent, fontFamily: 'Outfit_600SemiBold' },

  feedGap: { gap: spacing.sm },
  jobCard: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  jobIconBox: { width: 44, height: 44, borderRadius: radius.sm * 1.5, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  jobBody: { flex: 1, marginLeft: spacing.md },
  jobTitle: { ...typography.body, fontFamily: 'Outfit_600SemiBold', fontSize: 15 },
  jobMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  jobMetaText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  jobBudget: { ...typography.caption, color: colors.accent, fontFamily: 'Outfit_700Bold', marginTop: 4 },
  quotePress: { paddingLeft: spacing.sm },
  quoteBtn: { backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.full },
  quoteText: { ...typography.caption, color: colors.background, fontFamily: 'Outfit_700Bold' },

  feedEmpty: { alignItems: 'center', paddingVertical: spacing.xl, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  feedEmptyText: { ...typography.bodyMuted },
})