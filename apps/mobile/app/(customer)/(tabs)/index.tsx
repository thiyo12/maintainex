import { useEffect, useMemo, useRef, useCallback, useState, useSyncExternalStore } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Bell, MapPin, Star, CaretRight } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import Animated, { FadeInUp } from 'react-native-reanimated'

import { useAuth } from '../../../lib/auth'
import { v2Jobs, v2Quotes, v2Match } from '../../../lib/api-v2'
import { taskers, notifications } from '../../../lib/api'
import { translateJobStatus } from '../../../lib/i18n'
import { on, removedJobs, subscribe, getVersion } from '../../../lib/events'
import { CATEGORY_FALLBACK, categoryVisualBySlug } from '../../../lib/categoryVisuals'
import { tierById } from '../../../lib/tiers'
import { v3 } from '../../../theme/v3/tokens'

import V3CustomerBottomNav from '../../../components/v3/V3CustomerBottomNav'
import V3SearchBar from '../../../components/v3/V3SearchBar'
import V3ActiveJobCard from '../../../components/v3/V3ActiveJobCard'
import V3ServiceCard from '../../../components/v3/V3ServiceCard'
import V3ProviderCard from '../../../components/v3/V3ProviderCard'
import V3SectionHeader from '../../../components/v3/V3SectionHeader'
import V3TierBadge from '../../../components/v3/V3TierBadge'
import AvatarCircle from '../../../components/ui/AvatarCircle'
import Skeleton from '../../../components/ui/Skeleton'

const TRACKABLE = ['QUOTE_ACCEPTED', 'PENDING_PAYMENT', 'ESCROW_DEPOSITED', 'IN_PROGRESS']

export default function CustomerHome() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useTranslation()
  const { newJobId } = useLocalSearchParams<{ newJobId?: string }>()

  const [myJobs, setMyJobs] = useState<any[]>([])
  const [quoteCounts, setQuoteCounts] = useState<Record<string, number>>({})
  const [relatedProviders, setRelatedProviders] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [homeCategories, setHomeCategories] = useState<any[]>([])

  const userId = user?.id

  const ownJobs = useMemo(
    () => myJobs.filter(j => !removedJobs.has(j.id) && (j.customerId === userId || (newJobId && j.id === newJobId))),
    [myJobs, userId, newJobId]
  )

  const activeJob = useMemo(
    () => ownJobs.find(j => TRACKABLE.includes(j.status) || (j.acceptedQuote && !['COMPLETED', 'CANCELLED'].includes(j.status))),
    [ownJobs]
  )

  const recentJobs = useMemo(
    () => [...ownJobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
    [ownJobs]
  )

  const region = useMemo(
    () => user?.province || user?.region || activeJob?.locationName?.split(',')[0] || 'Jaffna',
    [user, activeJob]
  )

  const loadHomeCategories = useCallback(async () => {
    setHomeCategories(CATEGORY_FALLBACK)
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'}/api/mobile/job-categories`)
      if (!res.ok) return
      const data = await res.json()
      const list = Array.isArray(data) ? data : data.categories || data.data || []
      if (list.length > 0) setHomeCategories(list)
    } catch {}
  }, [])

  const loadJobs = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      loadHomeCategories()
      const res = await v2Jobs.list()
      const jobs = res.jobs || []
      setMyJobs(jobs)
      const own = jobs.filter((j: any) => j.customerId === userId || (newJobId && j.id === newJobId))
      if (own.length > 0) {
        const qResults = await Promise.allSettled(own.map((j: any) => v2Quotes.list(j.id)))
        const counts: Record<string, number> = {}
        own.forEach((j: any, i: number) => {
          const r = qResults[i]
          if (r.status === 'fulfilled') counts[j.id] = (r.value.quotes || []).filter((q: any) => q.status === 'PENDING').length
          else counts[j.id] = 0
        })
        setQuoteCounts(counts)
      } else setQuoteCounts({})

      const targetJobId = newJobId || (own.length > 0 ? own[0].id : null)
      if (targetJobId) {
        const [matchRes, allTaskersRes] = await Promise.allSettled([v2Match.getProviders(targetJobId), taskers.list()])
        const matched = matchRes.status === 'fulfilled' ? (matchRes.value.providers || []) : []
        const others = allTaskersRes.status === 'fulfilled' ? (allTaskersRes.value || []) : []
        const seen = new Set<string>()
        const merged: any[] = []
        const add = (p: any) => { if (p?.id && !seen.has(p.id)) { seen.add(p.id); merged.push(p) } }
        matched.forEach(add)
        others.forEach(add)
        setRelatedProviders(merged.slice(0, 10))
      } else {
        const allTaskers = await taskers.list().catch(() => null)
        setRelatedProviders(((allTaskers || []) as any[]).slice(0, 10))
      }
      notifications.unreadCount().then((r: any) => setUnreadCount(r.count || 0)).catch(() => {})
    } catch (e) {
      console.error('Load jobs error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [userId, newJobId, loadHomeCategories])

  useEffect(() => {
    const unsub = on('jobsChanged', () => setRefreshKey(k => k + 1))
    return () => unsub()
  }, [])

  useSyncExternalStore(subscribe, getVersion)
  useEffect(() => { if (refreshKey > 0) loadJobs() }, [refreshKey, loadJobs])
  useEffect(() => { loadJobs() }, [loadJobs])

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return t('home.greeting.morning')
    if (h < 17) return t('home.greeting.afternoon')
    return t('home.greeting.evening')
  }

  const firstName = (user?.name || t('home.user')).split(' ')[0]

  const openCategoryDetail = (id: string) => {
    router.push({ pathname: '/(customer)/find/[categoryId]', params: { categoryId: id } } as any)
  }

  const navToActive = () => {
    if (!activeJob) return
    if (TRACKABLE.includes(activeJob.status)) router.push(`/(customer)/tracking/${activeJob.id}`)
    else router.push(`/(customer)/jobs/v2/${activeJob.id}`)
  }

  const provider = activeJob?.acceptedQuote?.provider

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadJobs(true)} tintColor={v3.colors.ink} />}
      >
        {/* ═══ App Bar ═══ */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.locPill} onPress={() => router.push('/(customer)/settings/addresses' as any)} activeOpacity={0.7}>
            <MapPin size={14} color={v3.colors.textSecondary} weight="fill" />
            <Text style={styles.locText} numberOfLines={1}>{region}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/(customer)/(tabs)/notifications' as any)} activeOpacity={0.7}>
            <Bell size={20} color={v3.colors.ink} weight="regular" />
            {unreadCount > 0 ? <View style={styles.badge} /> : null}
          </TouchableOpacity>
        </View>

        {/* ═══ Greeting ═══ */}
        <View style={styles.greetingBlock}>
          <Text style={styles.greetingSub}>{getGreeting()},</Text>
          <Text style={styles.greetingName}>{firstName}</Text>
          <V3TierBadge tierLevel={user?.tierLevel} />
        </View>

        {/* ═══ Hero Search ═══ */}
        <View style={styles.searchWrap}>
          <V3SearchBar
            placeholder="What can we solve today?"
            onPress={() => router.push('/(customer)/find' as any)}
          />
        </View>

        {/* ═══ Active Job ═══ */}
        {activeJob ? (
          <Animated.View entering={FadeInUp.springify().damping(20).stiffness(300)} style={styles.activeWrap}>
            <V3ActiveJobCard
              title={activeJob.title || 'Your job'}
              status={t(translateJobStatus(activeJob.status))}
              providerName={provider?.name}
              quoteCount={quoteCounts[activeJob.id]}
              onPress={navToActive}
            />
          </Animated.View>
        ) : null}

        {/* ═══ Service Categories ═══ */}
        <V3SectionHeader
          title={t('home.whatDoYouNeed')}
          tag="EXPLORE SERVICES"
          tagColor={v3.colors.textSecondary}
        />
        {loading && homeCategories.length === 0 ? (
          <View style={styles.catSkeletonRow}>
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} width={82} height={100} radius={20} />
            ))}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll} snapToInterval={90} decelerationRate="fast">
            {(homeCategories.length > 0 ? homeCategories : CATEGORY_FALLBACK).map((item: any, i: number) => {
              const id = item.slug || item.id || ''
              const navId = item.id || item.slug || ''
              const vis = categoryVisualBySlug(id)
              const label = item.name || item.slug || id
              const Icon = vis.icon
              return (
                <Animated.View key={id || i} entering={FadeInUp.delay(i * 40).springify().damping(20).stiffness(300)}>
                  <V3ServiceCard
                    icon={<Icon size={20} color={v3.colors.ink} weight="fill" />}
                    name={label}
                    onPress={() => openCategoryDetail(navId)}
                  />
                </Animated.View>
              )
            })}
          </ScrollView>
        )}

        {/* ═══ Recommended Providers ═══ */}
        {relatedProviders.length > 0 && (
          <>
            <V3SectionHeader
              title={t('home.topTaskersNearYou')}
              subtitle={`${t('tasker.seeAll')} near ${region}`}
              actionText={t('tasker.seeAll')}
              onAction={() => router.push('/(customer)/find' as any)}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.providersScroll}>
              {relatedProviders.slice(0, 6).map((p: any) => (
                <V3ProviderCard
                  key={p.id}
                  name={p.name || 'Tasker'}
                  rating={p.rating || 0}
                  completedJobs={p.completedJobs || 0}
                  isVerified={!!p.isVerified}
                  skills={p.skills || p.categories}
                  onPress={() => router.push(`/(customer)/find/tasker-profile/${p.id}` as any)}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* ═══ Recent Jobs ═══ */}
        {recentJobs.length > 0 && (
          <>
            <V3SectionHeader
              title={t('ui.recentJobs')}
              actionText={t('tasker.seeAll')}
              onAction={() => router.push('/(customer)/jobs/v2' as any)}
            />
            {recentJobs.map((job) => (
              <TouchableOpacity
                key={job.id}
                style={styles.recentRow}
                onPress={() => router.push(`/(customer)/jobs/v2/${job.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.recentDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentTitle} numberOfLines={1}>{job.title || 'Untitled job'}</Text>
                  <Text style={styles.recentDate}>{new Date(job.createdAt).toLocaleDateString()}</Text>
                </View>
                <CaretRight size={14} color={v3.colors.textMuted} weight="bold" />
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ═══ Bottom Nav ═══ */}
      <V3CustomerBottomNav
        activeTab="home"
        onTabPress={(tab) => {
          if (tab === 'home') return
          if (tab === 'explore') router.push('/(customer)/find' as any)
          else router.push(`/(customer)/(tabs)/${tab}` as any)
        }}
        onPostJob={() => router.push('/(customer)/jobs/v2/create' as any)}
        unreadCount={unreadCount}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  scroll: { paddingBottom: 20 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 4,
  },
  locPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: v3.colors.surfaceGray,
    borderWidth: 1,
    borderColor: v3.colors.line,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: v3.radius.full,
    flexShrink: 1,
  },
  locText: {
    fontSize: 10.5,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.textSecondary,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: v3.colors.surfaceWhite,
    borderWidth: 1,
    borderColor: v3.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: v3.colors.amber,
    borderWidth: 1.5,
    borderColor: v3.colors.paper,
  },

  greetingBlock: {
    paddingHorizontal: 18,
    marginTop: 18,
    marginBottom: 10,
  },
  greetingSub: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
    color: v3.colors.textSecondary,
  },
  greetingName: {
    fontSize: 30,
    fontFamily: 'Outfit_900Black',
    color: v3.colors.textPrimary,
    letterSpacing: -0.5,
    marginTop: 2,
  },

  searchWrap: {
    paddingHorizontal: 18,
    marginBottom: 4,
  },

  activeWrap: {
    paddingHorizontal: 18,
    marginTop: 14,
  },

  catScroll: {
    paddingHorizontal: 18,
    gap: 10,
  },
  catSkeletonRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 10,
  },

  providersScroll: {
    paddingHorizontal: 18,
    gap: 12,
  },

  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: v3.colors.lineSubtle,
    gap: 12,
  },
  recentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: v3.colors.ink,
  },
  recentTitle: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.textPrimary,
  },
  recentDate: {
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
    color: v3.colors.textMuted,
    marginTop: 2,
  },
})
