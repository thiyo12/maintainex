import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { DotsThree, Wrench, ArrowRight, Warning, Star } from 'phosphor-react-native'
import { useAuth } from '../../../lib/auth'
import { taskers, earnings, notifications } from '../../../lib/api'
import { v2Jobs, v2Identity } from '../../../lib/api-v2'
import { emit, on } from '../../../lib/events'
import { fonts } from '../../../lib/fonts'
import { v3 } from '../../../theme/v3/tokens'

let Notifications: any = null
try { Notifications = require('expo-notifications') } catch {}

const ACTIVE_STATUSES = ['QUOTE_ACCEPTED', 'PENDING_PAYMENT', 'ESCROW_DEPOSITED', 'IN_PROGRESS']

const MARKERS = [
  { left: '21%', top: '23%' },
  { left: '69%', top: '18%' },
  { left: '76%', top: '62%' },
  { left: '32%', top: '72%' },
] as const

export default function TaskerDashboard() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user } = useAuth()

  const [isOnline, setIsOnline] = useState(true)
  const [openJobs, setOpenJobs] = useState<any[]>([])
  const [myJobs, setMyJobs] = useState<any[]>([])
  const [earningsData, setEarningsData] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [readinessComplete, setReadinessComplete] = useState(true)

  const lastPollRef = useRef<string>(new Date().toISOString())
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const alertedJobsRef = useRef<Set<string>>(new Set())

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

      if (openRes.status === 'fulfilled') setOpenJobs(openRes.value.jobs || [])
      if (myRes.status === 'fulfilled') setMyJobs(myRes.value.jobs || [])
      if (earningsRes.status === 'fulfilled') setEarningsData(earningsRes.value)

      if (profileRes.status === 'fulfilled') {
        const p: any = profileRes.value
        setProfile(p)
        if (typeof p?.isOnline === 'boolean') {
          setIsOnline(p.isOnline)
          emit('taskerOnlineChanged', p.isOnline)
        }

        const taskerProfile = p?.taskerProfile || p
        const hasProfession = !!taskerProfile?.professionId
        const hasSkills = Array.isArray(taskerProfile?.skills) && taskerProfile.skills.length > 0
        const hasArea = !!p?.areaId || (Array.isArray(taskerProfile?.serviceAreas) && taskerProfile.serviceAreas.length > 0)
        setReadinessComplete(hasProfession && hasSkills && hasArea)
      }

      const [identity] = await Promise.allSettled([v2Identity.getStatus()])
      if (identity.status === 'fulfilled') {
        const idStatus = (identity as any).value?.identityStatus
        if (idStatus !== 'VERIFIED' && idStatus !== 'APPROVED') setReadinessComplete(false)
      }

      notifications.unreadCount().catch(() => {})
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const toggleOnline = useCallback(async () => {
    const next = !isOnline
    setIsOnline(next)
    emit('taskerOnlineChanged', next)

    try {
      await taskers.setOnline(next)
    } catch {
      setIsOnline(!next)
      emit('taskerOnlineChanged', !next)
    }
  }, [isOnline])

  useEffect(() => {
    const offJobs = on('jobsChanged', () => setRefreshKey((k) => k + 1))
    const offGo = on('taskerGoPressed', () => toggleOnline())
    return () => {
      offJobs()
      offGo()
    }
  }, [toggleOnline])

  useEffect(() => {
    if (refreshKey > 0) loadData()
  }, [refreshKey, loadData])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const sub = Notifications?.addNotificationResponseReceivedListener
      ? Notifications.addNotificationResponseReceivedListener((res: any) => {
          const data = res.notification.request.content.data
          if (data?.jobId && data?.screen) router.push(data.screen.replace('[id]', data.jobId))
        })
      : null
    return () => sub?.remove()
  }, [router])

  useEffect(() => {
    if (!isOnline) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      return
    }

    lastPollRef.current = new Date().toISOString()
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await v2Jobs.pollNew(lastPollRef.current)
        if (!res.jobs?.length) return

        lastPollRef.current = new Date().toISOString()
        for (const job of res.jobs) {
          if (alertedJobsRef.current.has(job.id)) continue
          alertedJobsRef.current.add(job.id)
          await Notifications?.scheduleNotificationAsync?.({
            content: {
              title: t('tasker.newJobAlert'),
              body: (job.title || '') + ' — LKR ' + Number(job.budgetAmount || 0).toLocaleString(),
              data: { jobId: job.id, screen: '/(tasker)/jobs/v2/quote/[id]' },
              sound: true,
            },
            trigger: null,
          })
        }
      } catch {}
    }, 15000)

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [isOnline, t])

  const activeJob = myJobs.find((job: any) => ACTIVE_STATUSES.includes(job.status))
  const availableJobs = openJobs.filter((job: any) => !myJobs.some((mine: any) => mine.id === job.id))
  const bestJob = availableJobs[0]

  const todayEarned = useCallback(() => {
    const today = new Date().toDateString()
    const payouts = earningsData?.recentPayouts || []
    return payouts
      .filter((p: any) => new Date(p.clearedAt || p.createdAt).toDateString() === today && p.status === 'CLEARED')
      .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
  }, [earningsData])()

  const rating = Number(profile?.rating ?? profile?.taskerProfile?.rating ?? 0)
  const activeCount = myJobs.filter((job: any) => !['COMPLETED', 'CANCELLED'].includes(String(job.status))).length
  const taskerProfile = profile?.taskerProfile || profile
  const primaryArea = Array.isArray(taskerProfile?.serviceAreas) && taskerProfile.serviceAreas.length
    ? taskerProfile.serviceAreas[0]
    : profile?.area?.name || 'Near you'

  const firstName = String(user?.name || '').split(' ')[0]

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={v3.colors.ink} />}
      >
        <View style={styles.appBar}>
          <View>
            <Text style={styles.brand}>MΛINTΛINEX</Text>
            <Text style={[styles.roleLine, isOnline && styles.onlineText]}>
              {isOnline ? 'Online · ' + primaryArea : 'Tasker'}
            </Text>
          </View>

          {isOnline ? (
            <TouchableOpacity style={styles.onlinePill} activeOpacity={0.75} onPress={toggleOnline}>
              <Text style={styles.onlinePillText}>ONLINE</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.roundButton} activeOpacity={0.72} onPress={() => router.push('/(tasker)/(tabs)/profile')}>
              <DotsThree size={24} color={v3.colors.ink} weight="bold" />
            </TouchableOpacity>
          )}
        </View>

        {!isOnline ? (
          <>
            <View style={styles.offlineHeading}>
              <Text style={styles.hero}>{'Ready to earn' + (firstName ? ', ' + firstName : '') + '?'}</Text>
              <Text style={styles.subhead}>Go online to see jobs near you.</Text>
            </View>

            {!loading && !readinessComplete ? (
              <TouchableOpacity style={styles.readiness} activeOpacity={0.78} onPress={() => router.push('/(tasker)/readiness' as any)}>
                <Warning size={16} color="#9A6000" weight="fill" />
                <View style={styles.readinessCopy}>
                  <Text style={styles.readinessTitle}>Complete your setup</Text>
                  <Text style={styles.readinessSub}>Finish readiness checks before accepting work.</Text>
                </View>
                <ArrowRight size={15} color="#9A6000" weight="bold" />
              </TouchableOpacity>
            ) : null}

            <View style={[styles.map, styles.offlineMap]}>
              <MapGrid />
              <View style={styles.youDot} />
            </View>

            <View style={styles.offlineStatsCard}>
              <View style={styles.todayBlock}>
                <Text style={styles.mutedLabel}>Today</Text>
                <Text style={styles.todayValue}>LKR {todayEarned.toLocaleString()}</Text>
              </View>
              <View style={styles.smallStat}>
                <Text style={styles.mutedLabel}>Jobs</Text>
                <Text style={styles.smallStatValue}>{activeCount}</Text>
              </View>
              <View style={styles.smallStat}>
                <Text style={styles.mutedLabel}>Rating</Text>
                <Text style={styles.smallStatValue}>{rating > 0 ? rating.toFixed(1) : '—'} ★</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.goOnlineButton}
              activeOpacity={0.78}
              onPress={toggleOnline}
            >
              <Text style={styles.goOnlineText}>Go online</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {!loading && !readinessComplete ? (
              <TouchableOpacity style={[styles.readiness, { marginTop: 10 }]} activeOpacity={0.78} onPress={() => router.push('/(tasker)/readiness' as any)}>
                <Warning size={16} color="#9A6000" weight="fill" />
                <View style={styles.readinessCopy}>
                  <Text style={styles.readinessTitle}>Setup needs attention</Text>
                  <Text style={styles.readinessSub}>Review readiness before taking another job.</Text>
                </View>
                <ArrowRight size={15} color="#9A6000" weight="bold" />
              </TouchableOpacity>
            ) : null}

            <View style={[styles.map, styles.onlineMap]}>
              <MapGrid />
              {availableJobs.slice(0, 4).map((job: any, index: number) => {
                const pos = MARKERS[index] || MARKERS[0]
                return (
                  <TouchableOpacity
                    key={job.id}
                    style={[styles.jobMarker, pos]}
                    activeOpacity={0.78}
                    onPress={() => router.push(('/(tasker)/jobs/v2/quote/' + job.id) as any)}
                  >
                    <Wrench size={15} color={v3.colors.ink} weight="bold" />
                  </TouchableOpacity>
                )
              })}
              {availableJobs.length === 0 ? <View style={styles.youDot} /> : null}
            </View>

            <View style={styles.onlineStatsCard}>
              <View>
                <Text style={styles.onlineStatLabel}>TODAY</Text>
                <Text style={styles.onlineToday}>LKR {todayEarned.toLocaleString()}</Text>
              </View>
              <Text style={styles.onlineStatValue}>{activeCount} {activeCount === 1 ? 'job' : 'jobs'}</Text>
              <View style={styles.ratingInline}>
                <Star size={12} color={v3.colors.amber} weight="fill" />
                <Text style={styles.onlineStatValue}>{rating > 0 ? rating.toFixed(1) : '—'}</Text>
              </View>
            </View>

            {activeJob ? (
              <TouchableOpacity
                style={styles.nearbyCard}
                activeOpacity={0.78}
                onPress={() => router.push(('/(tasker)/jobs/v2/manage/' + activeJob.id) as any)}
              >
                <View style={styles.nearbyTop}>
                  <View>
                    <Text style={styles.nearbyCount}>Active job</Text>
                    <Text style={styles.nearbyHint}>Continue your current work</Text>
                  </View>
                  <ArrowRight size={18} color={v3.colors.ink} weight="bold" />
                </View>
                <View style={styles.bestMatchRow}>
                  <View style={styles.bestIcon}><Wrench size={17} color={v3.colors.ink} weight="bold" /></View>
                  <View style={styles.bestCopy}>
                    <Text style={styles.bestEyebrow}>IN PROGRESS</Text>
                    <Text style={styles.bestTitle} numberOfLines={1}>{activeJob.title || 'Current job'}</Text>
                  </View>
                  <View style={styles.viewJobsButton}>
                    <Text style={styles.viewJobsText}>Open job</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.nearbyCard}>
                <View style={styles.nearbyTop}>
                  <View>
                    <Text style={styles.nearbyCount}>{availableJobs.length} {availableJobs.length === 1 ? 'job' : 'jobs'} nearby</Text>
                    <Text style={styles.nearbyHint}>{availableJobs.length ? 'New work is available in your area.' : 'We’ll alert you when matching work appears.'}</Text>
                  </View>
                </View>

                {bestJob ? (
                  <View style={styles.bestMatchRow}>
                    <View style={styles.bestIcon}><Wrench size={17} color={v3.colors.ink} weight="bold" /></View>
                    <View style={styles.bestCopy}>
                      <Text style={styles.bestEyebrow}>BEST MATCH</Text>
                      <Text style={styles.bestTitle} numberOfLines={1}>{bestJob.title || 'New job'}</Text>
                      <Text style={styles.bestMeta} numberOfLines={1}>
                        {(bestJob.locationName || primaryArea) + (Number(bestJob.budgetAmount || 0) > 0 ? ' · LKR ' + Number(bestJob.budgetAmount).toLocaleString() : '')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.viewJobsButton}
                      activeOpacity={0.8}
                      onPress={() => router.push('/(tasker)/jobs/v2/browse' as any)}
                    >
                      <Text style={styles.viewJobsText}>View jobs</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function MapGrid() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[20, 85, 150, 215, 280, 345].map((top) => <View key={'h-' + top} style={[styles.gridH, { top }]} />)}
      {[58, 150, 245, 335].map((left) => <View key={'v-' + left} style={[styles.gridV, { left }]} />)}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  content: { paddingBottom: 24 },
  appBar: {
    minHeight: 72,
    paddingHorizontal: 18,
    paddingTop: 7,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    fontSize: 13,
    letterSpacing: 0.6,
    fontFamily: fonts.heading,
    color: v3.colors.ink,
  },
  roleLine: {
    marginTop: 9,
    fontSize: 10,
    fontFamily: fonts.headingBold,
    color: v3.colors.textMuted,
  },
  onlineText: { color: v3.colors.success },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlinePill: {
    minWidth: 72,
    height: 32,
    paddingHorizontal: 13,
    borderRadius: 16,
    backgroundColor: '#E8F8EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlinePillText: {
    color: v3.colors.success,
    fontSize: 11,
    fontFamily: fonts.headingBold,
  },
  offlineHeading: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16 },
  hero: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: fonts.heading,
    color: v3.colors.ink,
    letterSpacing: -0.4,
  },
  subhead: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fonts.bodySemiBold,
    color: '#5B5B5B',
  },
  map: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#E8E8E8',
  },
  offlineMap: { height: 330 },
  onlineMap: { height: 456, marginTop: 4 },
  gridH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#D2D2D2',
  },
  gridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#DADADA',
    transform: [{ rotate: '8deg' }],
  },
  youDot: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 18,
    height: 18,
    marginLeft: -9,
    marginTop: -9,
    borderRadius: 9,
    backgroundColor: v3.colors.ink,
  },
  jobMarker: {
    position: 'absolute',
    width: 42,
    height: 42,
    marginLeft: -21,
    marginTop: -21,
    borderRadius: 21,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readiness: {
    marginHorizontal: 18,
    marginBottom: 10,
    paddingHorizontal: 14,
    minHeight: 58,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: v3.colors.amberBg,
    borderWidth: 1,
    borderColor: '#F5D79B',
  },
  readinessCopy: { flex: 1 },
  readinessTitle: { fontSize: 11.5, fontFamily: fonts.headingBold, color: '#6A4300' },
  readinessSub: { marginTop: 2, fontSize: 9.5, fontFamily: fonts.bodyMedium, color: '#8C650E' },
  offlineStatsCard: {
    marginHorizontal: 18,
    marginTop: 15,
    height: 106,
    borderRadius: 18,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 17,
  },
  todayBlock: { flex: 1.25 },
  mutedLabel: {
    fontSize: 10,
    fontFamily: fonts.headingBold,
    color: v3.colors.textMuted,
  },
  todayValue: {
    marginTop: 8,
    fontSize: 26,
    lineHeight: 30,
    fontFamily: fonts.heading,
    color: v3.colors.ink,
  },
  smallStat: { flex: 0.8 },
  smallStatValue: {
    marginTop: 8,
    fontSize: 18,
    fontFamily: fonts.heading,
    color: v3.colors.ink,
  },
  goOnlineButton: {
    marginHorizontal: 18,
    marginTop: 24,
    height: 52,
    borderRadius: 15,
    backgroundColor: v3.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goOnlineText: {
    fontSize: 14,
    fontFamily: fonts.headingBold,
    color: v3.colors.paper,
  },
  onlineStatsCard: {
    marginHorizontal: 18,
    marginTop: 14,
    height: 48,
    borderRadius: 16,
    backgroundColor: v3.colors.ink,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  onlineStatLabel: {
    fontSize: 8.5,
    lineHeight: 11,
    color: v3.colors.amber,
    fontFamily: fonts.headingBold,
  },
  onlineToday: {
    marginTop: 1,
    fontSize: 13.5,
    color: v3.colors.paper,
    fontFamily: fonts.heading,
  },
  onlineStatValue: {
    fontSize: 11.5,
    color: v3.colors.paper,
    fontFamily: fonts.headingBold,
  },
  ratingInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nearbyCard: {
    marginHorizontal: 18,
    marginTop: 10,
    minHeight: 112,
    borderRadius: 18,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  nearbyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nearbyCount: {
    fontSize: 12.5,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  nearbyHint: {
    marginTop: 1,
    fontSize: 9.5,
    fontFamily: fonts.bodyMedium,
    color: v3.colors.textMuted,
  },
  bestMatchRow: {
    marginTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bestIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: v3.colors.surfaceGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bestCopy: { flex: 1, marginLeft: 9, marginRight: 8 },
  bestEyebrow: {
    fontSize: 8.5,
    fontFamily: fonts.headingBold,
    color: v3.colors.textMuted,
  },
  bestTitle: {
    marginTop: 1,
    fontSize: 11.5,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  bestMeta: {
    marginTop: 1,
    fontSize: 9.5,
    fontFamily: fonts.bodyMedium,
    color: v3.colors.textMuted,
  },
  viewJobsButton: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 11,
    backgroundColor: v3.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewJobsText: {
    fontSize: 10,
    fontFamily: fonts.headingBold,
    color: v3.colors.paper,
  },
})
