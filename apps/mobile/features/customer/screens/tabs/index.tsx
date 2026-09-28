import { useEffect, useMemo, useRef, useCallback, useState, useSyncExternalStore } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, useWindowDimensions } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import LottieView from 'lottie-react-native'
import { Bell, MapPin, Star, CaretRight, Plus, PaperPlaneTilt, BuildingOffice, HouseLine } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import Animated, { FadeInUp } from 'react-native-reanimated'

import { useAuth } from '@/features/auth/context/auth'
import { v2Jobs, v2Match } from '@/api/v2-jobs'
import { v2Quotes } from '@/api/v2-quotes'
import { taskers } from '@/api/taskers'
import { notifications } from '@/api/notifications'
import { translateJobStatus } from '@/lib/i18n'
import { on, removedJobs, subscribe, getVersion } from '@/lib/events'
import { colors, spacing, radius, typography, shadows } from '@/lib/design'
import { CATEGORY_FALLBACK, categoryVisualBySlug, categoryIcon, CategoryVisual } from '@/lib/categoryVisuals'
import { tierById } from '@/lib/tiers'

import AISearchBar from '@/components/shared/AISearchBar'
import AvatarCircle from '@/components/ui/AvatarCircle'
import PressableScale from '@/components/ui/PressableScale'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'

const TRACKABLE = ['QUOTE_ACCEPTED', 'PENDING_PAYMENT', 'ESCROW_DEPOSITED', 'IN_PROGRESS']

const MOCK_PROVIDERS = [
  { id: 'm1', name: 'Saman Kumara', avatar: '', rating: 4.8, completedJobs: 127, hourlyRate: 1500, isVerified: true, categories: ['Cleaning', 'Plumbing'] },
  { id: 'm2', name: 'Priya Devi', avatar: '', rating: 4.9, completedJobs: 89, fixedRate: 8500, isVerified: true, categories: ['Electrical', 'AC'] },
  { id: 'm3', name: 'QuickFix Solutions', avatar: '', rating: 4.6, completedJobs: 203, hourlyRate: 1200, isVerified: true, categories: ['Painting', 'Cleaning'] },
  { id: 'm4', name: 'Nimal Fernando', avatar: '', rating: 4.7, completedJobs: 156, hourlyRate: 1800, isVerified: true, categories: ['Plumbing', 'Electrical'] },
  { id: 'm5', name: 'Ruwan Wick', avatar: '', rating: 4.9, completedJobs: 312, hourlyRate: 2000, isVerified: true, categories: ['Electrical', 'AC', 'Plumbing'] },
] as any[]

function CatVisual({ visual, size = 42 }: { visual: CategoryVisual; size?: number }) {
  const [failed, setFailed] = useState(false)
  const [, setTick] = useState(0)
  useEffect(() => {
    setFailed(false)
    const timeout = setTimeout(() => setFailed(true), 6000)
    return () => clearTimeout(timeout)
  }, [visual.id])

  const Icon = visual.icon
  return (
    <View style={styles.catAnimBox}>
      <Icon size={size} color="rgba(255,255,255,0.94)" weight="fill" />
      {visual.lottie && !failed ? (
        <LottieView
          source={{ uri: visual.lottie }}
          style={StyleSheet.absoluteFill}
          autoPlay
          loop
          onLoad={() => setTick(t => t + 1)}
        />
      ) : null}
    </View>
  )
}

function TaskerCard({ p, onPress }: { p: any; onPress: () => void }) {
  const { t } = useTranslation()
  const image = p.avatar || p.profileImage
  const category = (p.categories || p.skills || [])[0] || t('customer.professional')
  const price = p.hourlyRate ? t('ui.fromLkr', { amount: p.hourlyRate.toLocaleString() }) : p.fixedRate ? `LKR ${p.fixedRate.toLocaleString()}` : null

  return (
    <Animated.View entering={FadeInUp.delay(120).springify().damping(20).stiffness(300)} style={styles.taskerWrap}>
      <PressableScale onPress={onPress} scaleTo={0.98} style={styles.taskerPress}>
        <View style={styles.taskerCard}>
          <View style={styles.taskerTop}>
            <AvatarCircle uri={image} name={p.name} size={86} showOnline={!!p.isOnline} showVerified={!!p.isVerified} verified={!!p.isVerified} />
          </View>
          <Text style={styles.taskerName} numberOfLines={1}>{p.name || 'Tasker'}</Text>
          <Text style={styles.taskerCat} numberOfLines={1}>{category}</Text>
          <View style={styles.taskerRatingRow}>
            <Star size={12} color={colors.accent} weight="fill" />
            <Text style={styles.taskerRating}>{p.rating ? p.rating.toFixed(1) : '—'}</Text>
            {p.completedJobs > 0 && (
              <Text style={styles.taskerJobs}>({p.completedJobs} jobs)</Text>
            )}
          </View>
          {price ? <Text style={styles.taskerPrice}>{price}</Text> : null}
        </View>
      </PressableScale>
    </Animated.View>
  )
}

function RecentJobRow({ job, onRebook, onOpen }: { job: any; onRebook: () => void; onOpen: () => void }) {
  const { t } = useTranslation()
  const Icon = categoryIcon(job.categoryId)
  return (
    <PressableScale onPress={onOpen} scaleTo={0.98} style={styles.recentPress}>
      <LinearGradient
        colors={[colors.surface, colors.surfaceHigh]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.recentCard}
      >
        <View style={styles.recentIconBox}>
          <Icon size={22} color={colors.accent} weight="fill" />
        </View>
        <View style={styles.recentBody}>
          <Text style={styles.recentTitle} numberOfLines={1}>{job.title || 'Untitled job'}</Text>
          <Text style={styles.recentDate}>{new Date(job.createdAt).toLocaleDateString()}</Text>
          <View style={{ alignSelf: 'flex-start', marginTop: 6 }}>
            <StatusBadge status={job.status} />
          </View>
        </View>
        {job.status === 'COMPLETED' ? (
          <PressableScale onPress={onRebook} scaleTo={0.96} style={styles.rebookWrap}>
            <View style={styles.rebookBtn}>
              <Text style={styles.rebookText}>{t('ui.rebook')}</Text>
            </View>
          </PressableScale>
        ) : null}
      </LinearGradient>
    </PressableScale>
  )
}

export default function CustomerHome() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width: winWidth } = useWindowDimensions()
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
    () => [...ownJobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3),
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
    } catch {
      // keep showing CATEGORY_FALLBACK on network failure
    }
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
        setRelatedProviders(merged.length >= 4 ? merged.slice(0, 10) : [...merged, ...MOCK_PROVIDERS].slice(0, 10))
      } else {
        const allTaskers = await taskers.list().catch(() => null)
        setRelatedProviders((allTaskers || []).length >= 4 ? (allTaskers as any[]).slice(0, 10) : MOCK_PROVIDERS)
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
  const tier = tierById(user?.tierLevel)
  const TierIcon = tier.icon

  const openCategoryDetail = (id: string, _name: string) => {
    router.push({ pathname: '/(customer)/find/[categoryId]', params: { categoryId: id } } as any)
  }

  const catTileW = Math.floor((winWidth - spacing.md * 2 - spacing.sm) / 4.4)
  const catRows = (() => {
    const items = homeCategories.length > 0 ? homeCategories : CATEGORY_FALLBACK
    const mid = Math.ceil(items.length / 2)
    return [items.slice(0, mid), items.slice(mid)]
  })()

  const provider = activeJob?.acceptedQuote?.provider
  const navToActive = () => {
    if (!activeJob) return
    if (TRACKABLE.includes(activeJob.status)) router.push(`/(customer)/tracking/${activeJob.id}`)
    else router.push(`/(customer)/jobs/v2/${activeJob.id}`)
  }

  const ctaBottom = insets.bottom + 64

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadJobs(true)} tintColor={colors.accent} />}
      >
        {/* ═══ Top bar ═══ */}
        <View style={styles.headerRow}>
          <AvatarCircle uri={(user as any)?.profileImage || (user as any)?.avatar} name={user?.name} size={46} />
          <PressableScale onPress={() => router.push('/(customer)/settings/addresses' as any)} scaleTo={0.95} style={styles.locPillPress}>
            <View style={styles.locPill}>
              <MapPin size={14} color={colors.accent} weight="fill" />
              <Text style={styles.locPillText} numberOfLines={1}>{region}</Text>
            </View>
          </PressableScale>
          <View style={styles.headerActions}>
            <PressableScale onPress={() => router.push('/(customer)/(tabs)/notifications' as any)} scaleTo={0.94} style={styles.iconBtnPress}>
              <View style={styles.iconBtn}>
                <Bell size={20} color={colors.textPrimary} weight="regular" />
                {unreadCount > 0 ? <View style={styles.bellDot} /> : null}
              </View>
            </PressableScale>
          </View>
        </View>

        <View style={styles.greetingBlock}>
          <Text style={styles.greetingSub}>{getGreeting()},</Text>
          <Text style={styles.greetingName}>{firstName}</Text>
          <PressableScale onPress={() => router.push('/settings/membership' as any)} scaleTo={0.95} style={{ alignSelf: 'flex-start' }}>
            <View style={styles.tierPill}>
              <TierIcon size={12} color={tier.color} weight="fill" />
              <Text style={[styles.tierPillText, { color: tier.color }]}>{t(`tiers.${tier.id.toLowerCase()}`)}</Text>
            </View>
          </PressableScale>
        </View>

        {/* ═══ Hero search ═══ */}
        <AISearchBar
          placeholder={t('home.searchPlaceholder')}
          onCategorySelect={(catId) => {
            router.push({ pathname: '/(customer)/find/[categoryId]', params: { categoryId: catId } } as any)
          }}
          onJobSelect={(jobId) => {
            router.push({ pathname: '/(customer)/find/taskers/[jobId]', params: { jobId } } as any)
          }}
          onTaskerSelect={(taskerId) => router.push(`/(customer)/find/tasker-profile/${taskerId}` as any)}
          onPostJob={(query) => router.push({ pathname: '/(customer)/jobs/v2/create', params: { title: query } } as any)}
        />

        {/* ═══ Active job ═══ */}
        {activeJob ? (
          <Animated.View entering={FadeInUp.springify().damping(20).stiffness(300)} style={styles.activeWrap}>
            <PressableScale onPress={navToActive} scaleTo={0.98} style={styles.activePress}>
              <LinearGradient colors={[colors.accent, colors.accentDim]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.activeCard}>
                <View style={styles.activeGlow} />
                <View style={styles.activeHeader}>
                  <Text style={styles.activeLabel}>{t('ui.activeJob')}</Text>
                  {(quoteCounts[activeJob.id] || 0) > 0 && (
                    <View style={styles.activeCountPill}>
                      <Text style={styles.activeCountText}>{quoteCounts[activeJob.id]} {t('quotes.title').toLowerCase()}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.activeTitle} numberOfLines={1}>{activeJob.title || 'Your job'}</Text>
                {provider && (
                  <View style={styles.activeTaskerRow}>
                    <AvatarCircle uri={provider.avatar || provider.profileImage} name={provider.name} size={24} />
                    <Text style={styles.activeTaskerName} numberOfLines={1}>{provider.name}</Text>
                    <View style={[styles.activePill, { marginLeft: 8 }]}>
                      <Text style={styles.activePillText}>{t(translateJobStatus(activeJob.status))}</Text>
                    </View>
                  </View>
                )}
                <View style={styles.trackBtnRow}>
                  <View style={styles.trackBtn}>
                    <PaperPlaneTilt size={16} color={colors.background} weight="fill" />
                    <Text style={styles.trackBtnText}>{t('ui.track')}</Text>
                  </View>
                </View>
              </LinearGradient>
            </PressableScale>
          </Animated.View>
        ) : null}

        {/* ═══ Service categories ═══ */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('home.whatDoYouNeed')}</Text>
        </View>
        {loading && relatedProviders.length === 0 ? (
          <View style={styles.catGrid}>
            {[0, 1].map(row => (
              <View key={row} style={styles.catRow}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <View key={i} style={{ width: catTileW, alignItems: 'center' }}>
                    <Skeleton width={catTileW - 26} height={catTileW - 26} radius={999} />
                    <Skeleton width={catTileW - 16} height={11} radius={5} style={{ marginTop: spacing.xs }} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.catGrid}>
            {catRows.map((row, ri) => (
              <ScrollView
                key={ri}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.catRow}
                snapToInterval={catTileW + spacing.xs}
                decelerationRate="fast"
              >
                {row.map((item: any, i) => {
                  const idx = ri * row.length + i
                  const id = item.slug || item.id || ''
                  const navId = item.id || item.slug || ''
                  const vis = categoryVisualBySlug(id)
                  const visual: CategoryVisual = { id, icon: vis.icon, gradient: vis.gradient }
                  const label = item.name || item.slug || id
                  return (
                    <Animated.View key={id || idx} entering={FadeInUp.delay(idx * 30).springify().damping(20).stiffness(300)} style={{ width: catTileW, alignItems: 'center' }}>
                      <PressableScale onPress={() => openCategoryDetail(navId, label)} scaleTo={0.9} style={styles.catPress}>
                        <LinearGradient colors={visual.gradient} style={[styles.catCircle, { width: catTileW - 24, height: catTileW - 24 }]}>
                          <CatVisual visual={visual} size={26} />
                        </LinearGradient>
                      </PressableScale>
                      <Text style={styles.catLabel} numberOfLines={2}>{label}</Text>
                    </Animated.View>
                  )
                })}
              </ScrollView>
            ))}
          </View>
        )}

        {/* ═══ Real estate ═══ */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('home.realEstate')}</Text>
        </View>
        <View style={styles.realEstateRow}>
          <PressableScale onPress={() => router.push('/real-estate' as any)} scaleTo={0.97} style={styles.rePress}>
            <LinearGradient colors={[colors.surfaceHigh, colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.reCard}>
              <View style={styles.reIconBox}>
                <BuildingOffice size={22} color={colors.accent} weight="fill" />
              </View>
              <Text style={styles.reTitle}>{t('home.browseProperties')}</Text>
              <Text style={styles.reSub} numberOfLines={2}>{t('home.browsePropertiesSub')}</Text>
              <View style={styles.reArrow}>
                <CaretRight size={14} color={colors.background} weight="bold" />
              </View>
            </LinearGradient>
          </PressableScale>
          <PressableScale onPress={() => router.push('/real-estate/my-listings' as any)} scaleTo={0.97} style={styles.rePress}>
            <LinearGradient colors={[colors.surfaceHigh, colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.reCard}>
              <View style={styles.reIconBox}>
                <HouseLine size={22} color={colors.accent} weight="fill" />
              </View>
              <Text style={styles.reTitle}>{t('home.myListings')}</Text>
              <Text style={styles.reSub} numberOfLines={2}>{t('home.myListingsSub')}</Text>
              <View style={styles.reArrow}>
                <CaretRight size={14} color={colors.background} weight="bold" />
              </View>
            </LinearGradient>
          </PressableScale>
        </View>

        {/* ═══ Nearby taskers ═══ */}
        {relatedProviders.length > 0 && (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{t('home.topTaskersNearYou')}</Text>
              <PressableScale onPress={() => router.push('/(customer)/find' as any)} scaleTo={0.96}>
                <View style={styles.seeAllRow}>
                  <Text style={styles.seeAllText}>{t('tasker.seeAll')}</Text>
                  <CaretRight size={12} color={colors.accent} weight="bold" />
                </View>
              </PressableScale>
              <View style={styles.regionPill}>
                <MapPin size={12} color={colors.accent} weight="fill" />
                <Text style={styles.regionText}>{region}</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.taskersRow}>
              {relatedProviders.slice(0, 5).map((p: any) => (
                <TaskerCard
                  key={p.id}
                  p={p}
                  onPress={() => router.push(`/(customer)/find/tasker-profile/${p.id}` as any)}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* ═══ Recent activity ═══ */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('ui.recentJobs')}</Text>
          {recentJobs.length > 0 && (
            <PressableScale onPress={() => router.push('/(customer)/jobs/v2' as any)} scaleTo={0.96}>
              <View style={styles.seeAllRow}>
                <Text style={styles.seeAllText}>{t('tasker.seeAll')}</Text>
                <CaretRight size={12} color={colors.accent} weight="bold" />
              </View>
            </PressableScale>
          )}
        </View>
        {loading && recentJobs.length === 0 ? (
          <View style={styles.recentList}>
            {[0, 1].map(i => <Skeleton key={i} width="100%" height={86} radius={16} />)}
          </View>
        ) : recentJobs.length === 0 ? (
          <EmptyState
            title={t('ui.postFirstJob')}
            subtitle={t('ui.postFirstJobSub')}
            ctaText={t('home.postJob')}
            onCta={() => router.push('/(customer)/jobs/v2/create' as any)}
            FallbackIcon={categoryIcon('general')}
          />
        ) : (
          <View style={styles.recentList}>
            {recentJobs.map(job => (
              <RecentJobRow
                key={job.id}
                job={job}
                onOpen={() => router.push(`/(customer)/jobs/v2/${job.id}` as any)}
                onRebook={() => router.push('/(customer)/jobs/v2/create' as any)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* ═══ Floating CTA ═══ */}
      <View style={[styles.ctaWrap, { bottom: ctaBottom }]}>
        <PressableScale onPress={() => router.push('/(customer)/jobs/v2/create' as any)} scaleTo={0.96} style={styles.ctaPress}>
          <LinearGradient colors={[colors.accent, colors.accentDim]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
            <Plus size={22} color={colors.background} weight="bold" />
            <Text style={styles.ctaText}>{t('home.postJob')}</Text>
          </LinearGradient>
        </PressableScale>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 140, paddingHorizontal: spacing.md },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.sm, gap: spacing.sm },
  locPillPress: { flex: 1, borderRadius: radius.full },
  locPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 10, paddingHorizontal: spacing.md, borderRadius: radius.full,
  },
  locPillText: { ...typography.caption, color: colors.textPrimary, fontFamily: 'Outfit_600SemiBold', flexShrink: 1 },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  iconBtnPress: { borderRadius: radius.full },
  iconBtn: {
    width: 44, height: 44, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  bellDot: {
    position: 'absolute', top: 8, right: 9,
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: colors.accent, borderWidth: 1.5, borderColor: colors.background,
  },

  greetingBlock: { marginTop: spacing.lg, marginBottom: spacing.lg },
  greetingSub: { ...typography.bodyMuted, fontSize: 14, fontFamily: 'Outfit_500Medium' },
  greetingName: { ...typography.h1, fontSize: 30, letterSpacing: -0.5, marginTop: 2 },
  tierPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: spacing.sm, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
  },
  tierPillText: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: colors.accent },

  activeWrap: { marginTop: spacing.md },
  activePress: { borderRadius: radius.lg, ...shadows.card },
  activeCard: {
    borderRadius: radius.lg, padding: spacing.lg, overflow: 'hidden',
  },
  activeGlow: {
    position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  activeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  activeLabel: { ...typography.label, color: colors.background, opacity: 0.85, fontFamily: 'Outfit_600SemiBold' },
  activeCountPill: { backgroundColor: 'rgba(11,12,18,0.25)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  activeCountText: { ...typography.caption, color: colors.textPrimary, fontFamily: 'Outfit_600SemiBold' },
  activeTitle: { ...typography.h3, fontSize: 22, color: colors.background },
  activeTaskerRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  activeTaskerName: { ...typography.body, color: colors.background, fontFamily: 'Outfit_600SemiBold', marginLeft: spacing.sm, flex: 1 },
  activePill: { backgroundColor: 'rgba(11,12,18,0.25)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  activePillText: { ...typography.caption, color: colors.background, fontFamily: 'Outfit_600SemiBold' },
  trackBtnRow: { marginTop: spacing.lg },
  trackBtn: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.background, paddingVertical: 10, paddingHorizontal: 18, borderRadius: radius.full,
  },
  trackBtnText: { ...typography.body, color: colors.textPrimary, fontFamily: 'Outfit_700Bold', fontSize: 14 },

  sectionHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: spacing.xl, marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.h3, fontSize: 18 },
  regionPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.accentSoft },
  regionText: { ...typography.caption, color: colors.accent, fontFamily: 'Outfit_600SemiBold' },

  catGrid: { gap: spacing.md },
  catRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, paddingHorizontal: spacing.sm },
  catPress: { borderRadius: radius.full },
  catCircle: {
    borderRadius: radius.full, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  catAnimBox: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  catLabel: { fontSize: 11.5, lineHeight: 14, textAlign: 'center', marginTop: spacing.xs, color: colors.textPrimary, fontFamily: 'Outfit_600SemiBold' },

  realEstateRow: { flexDirection: 'row', gap: spacing.md },
  rePress: { flex: 1, borderRadius: radius.md, ...shadows.card },
  reCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, paddingBottom: spacing.lg, position: 'relative', minHeight: 150,
  },
  reIconBox: {
    width: 42, height: 42, borderRadius: radius.sm * 1.5,
    backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  reTitle: { ...typography.body, fontFamily: 'Outfit_700Bold', fontSize: 15, marginTop: spacing.sm },
  reSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },
  reArrow: {
    position: 'absolute', bottom: spacing.md, right: spacing.md,
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },

  taskersRow: { gap: spacing.md, paddingRight: spacing.md },
  taskerWrap: { width: 200 },
  taskerPress: { borderRadius: radius.md, ...shadows.card },
  taskerCard: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, paddingBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.border, height: 220,
  },
  taskerTop: { alignItems: 'center', marginBottom: spacing.md },
  taskerName: { ...typography.body, textAlign: 'center', fontFamily: 'Outfit_700Bold', fontSize: 15 },
  taskerCat: { ...typography.caption, textAlign: 'center', marginTop: 2, color: colors.textSecondary },
  taskerRatingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: spacing.sm },
  taskerRating: { ...typography.caption, color: colors.accent, fontFamily: 'Outfit_600SemiBold' },
  taskerJobs: { ...typography.caption, color: colors.textSecondary },
  taskerPrice: { ...typography.body, textAlign: 'center', marginTop: spacing.sm, color: colors.accent, fontFamily: 'Outfit_600SemiBold', fontSize: 13 },

  recentList: { gap: spacing.sm },
  recentPress: { borderRadius: radius.md },
  recentCard: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  recentIconBox: {
    width: 44, height: 44, borderRadius: radius.sm * 1.5,
    backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center',
  },
  recentBody: { flex: 1, marginLeft: spacing.md },
  recentTitle: { ...typography.body, fontFamily: 'Outfit_600SemiBold', fontSize: 15 },
  recentDate: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  rebookWrap: { paddingLeft: spacing.sm },
  rebookBtn: { backgroundColor: colors.accentSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full },
  rebookText: { ...typography.caption, color: colors.accent, fontFamily: 'Outfit_700Bold' },

  seeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { ...typography.caption, color: colors.accent, fontFamily: 'Outfit_600SemiBold' },

  ctaWrap: { position: 'absolute', left: spacing.md, right: spacing.md },
  ctaPress: { borderRadius: radius.full, ...shadows.card },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: 16, borderRadius: radius.full,
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 10,
  },
  ctaText: { ...typography.body, color: colors.background, fontFamily: 'Outfit_700Bold', fontSize: 17 },
})