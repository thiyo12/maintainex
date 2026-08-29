import { useEffect, useRef, useState, useCallback, useMemo, useSyncExternalStore } from 'react'
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Animated, ActivityIndicator, RefreshControl, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MagnifyingGlass, Sparkle, Lightning, Drop, Snowflake, Palette, Laptop, Bell, Fire, Users, MapPin, Briefcase, CaretRight, PaperPlaneRight, Bookmark, Buildings, Heart, PlusCircle, CheckCircle, ChatCircle, List, Tag, Globe, Star, Trophy, Clock, Wallet, Rocket, ShieldCheck } from 'phosphor-react-native'
import { useAuth } from '../../../lib/auth'
import { useColors } from '../../../lib/ThemeContext'
import { v2Jobs, v2Quotes, v2Match } from '../../../lib/api-v2'
import { taskers, conversations } from '../../../lib/api'
import { getCategoryImageUrl } from '../../../lib/categories'
import { useTranslation } from 'react-i18next'
import { translateJobStatus } from '../../../lib/i18n'
import { fonts } from '../../../lib/fonts'
import { spacing, fontSizes } from '../../../lib/tokens'
import { useStagger } from '../../../lib/animations'
import { on, removedJobs, subscribe, getVersion } from '../../../lib/events'
import BookingSheet from '../../../components/offers/BookingSheet'
import type { BookingFormData } from '../../../components/offers/BookingSheet'
import SeasonalOffersComponent from '../../../components/offers/SeasonalOffers'
import CategoryGrid from '../../../components/offers/CategoryGrid'
import AISearchBar from '../../../components/shared/AISearchBar'


function usePulse() {
  const anim = useRef(new Animated.Value(1)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start()
  }, [])
  return anim
}

function useFloat(delay = 0) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    ).start()
  }, [])
  return anim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] })
}

export default function CustomerHome() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useTranslation()

  const pulseScale = usePulse()

  const categories = useMemo(() => [
    { id: 'all', icon: Sparkle, label: t('home.categories.all') },
    { id: 'cleaning', icon: Sparkle, label: t('home.categories.cleaning') },
    { id: 'electrical', icon: Lightning, label: t('home.categories.electrical') },
    { id: 'plumbing', icon: Drop, label: t('home.categories.plumbing') },
    { id: 'ac', icon: Snowflake, label: t('home.categories.ac') },
    { id: 'painting', icon: Palette, label: t('home.categories.painting') },
    { id: 'digital', icon: Laptop, label: t('home.categories.digital') },
  ], [])

  const hotOffers = useMemo(() => [
    { id: 'h1', gradient: ['#0F172A', '#1E3A5F'], badge: 'Hot Deal', badgeColor: '#EF4444', icon: Sparkle, label: 'Deep Clean', title: 'Full House Cleaning', loc: 'Colombo 5', distance: '1.2 km', price: 'From LKR 4,500' },
    { id: 'h2', gradient: ['#1a1a0a', '#3D2B00'], badge: 'New', badgeColor: '#F59E0B', icon: Lightning, label: 'Same-Day Electric', title: 'Electrical Repairs', loc: 'Nugegoda', distance: '2.5 km', price: 'From LKR 2,500' },
    { id: 'h3', gradient: ['#0a1a0a', '#1a3a1a'], badge: 'Featured', badgeColor: '#6366F1', icon: Laptop, label: 'Web Design Pro', title: 'Website in 5 Days', loc: 'Remote', distance: 'Worldwide', price: 'From LKR 25,000' },
  ], [])

  const [myJobs, setMyJobs] = useState<any[]>([])
  const [quoteCounts, setQuoteCounts] = useState<Record<string, number>>({})
  const [relatedProviders, setRelatedProviders] = useState<any[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedCat, setSelectedCat] = useState('all')
  const [staggerKey, setStaggerKey] = useState(0)
  const [selectedOffer, setSelectedOffer] = useState<typeof hotOffers[0] | null>(null)
  const [bookingVisible, setBookingVisible] = useState(false)
  const [recentConversations, setRecentConversations] = useState<any[]>([])

  const { newJobId } = useLocalSearchParams<{ newJobId?: string }>()

  const userId = user?.id
  const myOwnJobs = myJobs.filter(j => !removedJobs.has(j.id) && (j.customerId === userId || (newJobId && j.id === newJobId)) && j.status !== 'COMPLETED' && j.status !== 'CANCELLED')
  const nearbyJobs = myJobs.filter(j => !removedJobs.has(j.id) && j.customerId !== userId && (!newJobId || j.id !== newJobId))

  const MOCK_PROVIDERS = [
    { id: 'm1', userId: 'u1', name: 'Saman Kumara', avatar: '', rating: 4.8, completedJobs: 127, hourlyRate: 1500, verified: true, badge: 'PRO', badgeColor: '#6366F1', categories: ['Cleaning', 'Plumbing'], entityType: 'INDIVIDUAL', experienceYears: 6, bio: 'Expert cleaner and plumber.' },
    { id: 'm2', userId: 'u2', name: 'Priya Devi', avatar: '', rating: 4.9, completedJobs: 89, fixedRate: 8500, verified: true, badge: 'Top Rated', badgeColor: '#F59E0B', categories: ['Electrical', 'AC'], entityType: 'INDIVIDUAL', experienceYears: 4, bio: 'Licensed electrician.' },
    { id: 'm3', userId: 'u3', name: 'QuickFix Solutions', avatar: '', rating: 4.6, completedJobs: 203, hourlyRate: 1200, verified: true, badge: 'Expert', badgeColor: '#10B981', categories: ['Painting', 'Cleaning'], entityType: 'COMPANY', experienceYears: 8, bio: 'Trusted painting company.' },
    { id: 'm4', userId: 'u4', name: 'Nimal Fernando', avatar: '', rating: 4.7, completedJobs: 156, hourlyRate: 1800, verified: true, badge: 'PRO', badgeColor: '#6366F1', categories: ['Plumbing', 'Electrical'], entityType: 'INDIVIDUAL', experienceYears: 10, bio: 'Master plumber.' },
    { id: 'm5', userId: 'u5', name: 'TechHome Services', avatar: '', rating: 4.5, completedJobs: 64, fixedRate: 12000, verified: true, badge: 'New', badgeColor: '#3B82F6', categories: ['Digital', 'Photography'], entityType: 'COMPANY', experienceYears: 3, bio: 'Full-service digital solutions.' },
    { id: 'm6', userId: 'u6', name: 'Ruwan Wick', avatar: '', rating: 4.9, completedJobs: 312, hourlyRate: 2000, verified: true, badge: 'PRO', badgeColor: '#6366F1', categories: ['Electrical', 'AC', 'Plumbing'], entityType: 'INDIVIDUAL', experienceYears: 12, bio: 'Top-rated multi-skilled professional.' },
    { id: 'm7', userId: 'u7', name: 'Sparkle Clean Co', avatar: '', rating: 4.4, completedJobs: 45, fixedRate: 5500, verified: false, badge: 'Featured', badgeColor: '#EF4444', categories: ['Cleaning'], entityType: 'COMPANY', experienceYears: 2, bio: 'Professional cleaning company.' },
    { id: 'm8', userId: 'u8', name: 'Thilina Raj', avatar: '', rating: 4.8, completedJobs: 178, hourlyRate: 1600, verified: true, badge: 'Top Rated', badgeColor: '#F59E0B', categories: ['Digital', 'Tutoring', 'Photography'], entityType: 'INDIVIDUAL', experienceYears: 7, bio: 'Digital creator and tutor.' },
  ]

  const totalCards = useMemo(() => hotOffers.length + (myJobs?.length || 0) + 3, [myJobs])
  const cardStagger = useStagger(totalCards, 100, 60, staggerKey)

  useEffect(() => {
    const unsub = on('jobsChanged', (jobId?: string) => {
      if (jobId) setMyJobs(prev => prev.filter(j => j.id !== jobId))
      setRefreshKey(k => k + 1)
    })
    return () => unsub()
  }, [])

  useSyncExternalStore(subscribe, getVersion)

  useEffect(() => { if (refreshKey > 0) loadJobs() }, [refreshKey, loadJobs])

  const loadJobs = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      const params = selectedCat !== 'all' ? `category=${selectedCat}` : ''
      const res = await v2Jobs.list(params)
      const jobs = (res.jobs || []).slice(0, 10)
      setMyJobs(jobs.filter((j: any) => j.status !== 'CANCELLED' && j.status !== 'COMPLETED'))
      const ownJobs = jobs.filter((j: any) => j.customerId === user?.id)
      if (ownJobs.length > 0) {
        const qResults = await Promise.allSettled(ownJobs.map((j: any) => v2Quotes.list(j.id)))
        const counts: Record<string, number> = {}
        ownJobs.forEach((j: any, i: number) => {
          const r = qResults[i]
          if (r.status === 'fulfilled') counts[j.id] = (r.value.quotes || []).filter((q: any) => q.status === 'PENDING').length
          else counts[j.id] = 0
        })
        setQuoteCounts(counts)
      } else setQuoteCounts({})
      const targetJobId = newJobId || (ownJobs.length > 0 ? ownJobs[0].id : null)
      if (targetJobId) {
        const [matchRes, allTaskersRes] = await Promise.allSettled([
          v2Match.getProviders(targetJobId), taskers.list(),
        ])
        const matched = matchRes.status === 'fulfilled' ? (matchRes.value.providers || []) : []
        const others = allTaskersRes.status === 'fulfilled' ? (allTaskersRes.value || []) : []
        const seen = new Set<string>()
        const merged: any[] = []
        const add = (p: any) => { if (p?.id && !seen.has(p.id)) { seen.add(p.id); merged.push(p) } }
        matched.forEach(add)
        others.forEach(add)
        setRelatedProviders(merged.slice(0, 10).length > 0 ? merged.slice(0, 10) : MOCK_PROVIDERS.slice(0, 10))
      } else {
        const allTaskers = await taskers.list().catch(() => null)
        setRelatedProviders((allTaskers || MOCK_PROVIDERS).slice(0, 10))
      }
      conversations.list().then((data: any[]) => {
        setRecentConversations(data.slice(0, 3))
      }).catch(() => {})
    } catch (e) { console.error('Load jobs error:', e)
    } finally { setLoading(false); setRefreshing(false); setStaggerKey(k => k + 1) }
  }, [selectedCat])

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return t('home.greeting.morning')
    if (h < 17) return t('home.greeting.afternoon')
    return t('home.greeting.evening')
  }

  const handleOfferPress = (offer: typeof hotOffers[0]) => { setSelectedOffer(offer); setBookingVisible(true) }
  const handleBookingConfirm = (data: BookingFormData) => { setBookingVisible(false); setSelectedOffer(null); Alert.alert(t('home.bookingConfirmedTitle'), t('home.bookingConfirmedMessage', { date: data.date, timeSlot: data.timeSlot })) }
  const handleBookingClose = () => { setBookingVisible(false); setSelectedOffer(null) }
  const handleSeasonalServicePress = (jobId: string, jobName: string) => {
    router.push(`/(customer)/find/job/${jobId}`)
  }
  const parseOfferPrice = (price: string): number | undefined => { const m = price.replace(/,/g, '').match(/(\d+)/); return m ? parseInt(m[1], 10) : undefined }
  const startChat = async (p: any) => {
    const pid = p.userId
    if (!pid) { router.push(`/(customer)/find/tasker-profile/${p.id}`); return }
    try { const conv = await conversations.create({ participantId: pid }); router.push(`/(chat)/${conv.id}`) }
    catch { router.push(`/(customer)/find/tasker-profile/${p.id}`) }
  }

  let staggerIdx = 0

  const renderHotOffer = (item: typeof hotOffers[0], i: number) => {
    const idx = staggerIdx++
    const BadgeIcon = item.icon
    return (
    <Animated.View key={item.id} style={cardStagger[idx]}>
    <TouchableOpacity activeOpacity={0.8} onPress={() => handleOfferPress(item)} style={styles.offCard}>
      <View style={[styles.offGradient, { backgroundColor: item.gradient[0] }]}>
        <View style={[styles.offBadge, { backgroundColor: item.badgeColor }]}>
          <Text style={styles.offBadgeText}>{item.badge}</Text>
        </View>
        <BadgeIcon size={32} color="rgba(255,255,255,0.3)" weight="regular" />
      </View>
      <View style={[styles.offBody, { backgroundColor: colors.white }]}>
        <Text style={[styles.offTitle, { color: colors.ink }]}>{item.title}</Text>
        <View style={styles.offLoc}>
          <MapPin size={10} color={colors.muted} weight="fill" />
          <Text style={[styles.offLocText, { color: colors.muted }]}>{item.loc} · {item.distance}</Text>
        </View>
        <Text style={[styles.offPrice, { color: colors.amberDark }]}>{item.price}</Text>
      </View>
    </TouchableOpacity>
    </Animated.View>
    )
  }

  const renderJobCard = (job: any, i: number) => {
    const idx = staggerIdx++
    const catImg = getCategoryImageUrl(job.categoryId)
    return (
    <Animated.View key={job.id || `demo-${i}`} style={cardStagger[idx]}>
    <TouchableOpacity style={[styles.jc, { backgroundColor: colors.white }]}
      activeOpacity={0.7}
      onPress={() => router.push(`/(customer)/jobs/v2/${job.id}`)}
    >
      <Image source={{ uri: catImg }} style={styles.jcCatImg} resizeMode="cover" />
      <View style={styles.jcBody}>
        <View style={styles.jcTop}>
          <Text style={[styles.jcTitle, { color: colors.ink }]} numberOfLines={1}>{job.title || t('home.untitledJob')}</Text>
          <Text style={[styles.jcPrice, { color: colors.amberDark }]}>LKR {job.budgetAmount?.toLocaleString() || '—'}</Text>
        </View>
        {(job.categoryName || job.status) && (
          <View style={styles.jcTags}>
            {job.categoryName && <View style={[styles.tag, { backgroundColor: colors.amberBg }]}><Text style={[styles.tagText, { color: colors.amberDark }]}>{job.categoryName}</Text></View>}
            {job.status && <View style={[styles.tag, { backgroundColor: colors.successBg }]}><Text style={[styles.tagText, { color: colors.success }]}>{t(translateJobStatus(job.status))}</Text></View>}
          </View>
        )}
        <View style={styles.jcLoc}>
          {job.isRemote ? <Globe size={12} color={colors.muted} weight="bold" /> : <MapPin size={12} color={colors.muted} weight="fill" />}
          <Text style={[styles.jcLocText, { color: colors.muted }]}>
            {job.isRemote ? t('home.noLocation') : (job.locationName || t('home.noLocation'))}
            {job.distance ? ` · ${job.distance}` : ''}
          </Text>
        </View>
        <View style={styles.jcActs}>
          <TouchableOpacity style={styles.applyBtn}>
            <PaperPlaneRight size={12} color="#111827" weight="fill" />
            <Text style={styles.applyText}>{job.isRemote ? t('home.sendQuote') : t('home.applyNow')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn}>
            <Bookmark size={13} color={colors.muted} weight="regular" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
    </Animated.View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadJobs(true)} tintColor={colors.amber} />}
      >
        {/* ─── Header ─── */}
        <View style={[styles.header, { backgroundColor: colors.white }]}>
          <View style={styles.hdrRow}>
            <View style={styles.hdrLeft}>
              <View style={styles.hdrAvatarWrap}>
                <View style={[styles.hdrAvatar, { backgroundColor: colors.amber }]}>
                  <Text style={styles.hdrAvatarText}>{(user?.name || 'U')[0]}</Text>
                </View>
              </View>
              <View>
                <Text style={[styles.hdrGreet, { color: colors.muted }]}>{getGreeting()}</Text>
                <Text style={[styles.hdrName, { color: colors.ink }]}>{user?.name || t('home.user')}</Text>
              </View>
            </View>
            <View style={styles.hdrRight}>
              <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/(customer)/settings/notifications')}>
                <Bell size={18} color={colors.ink} weight="regular" />
                <Animated.View style={[styles.notifPip, { transform: [{ scale: pulseScale }] }]} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/(customer)/(tabs)/settings')}>
                <Star size={18} color={colors.ink} weight="regular" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ─── Tier Card ─── */}
        <View style={[styles.tierCard, { backgroundColor: colors.white }]}>
          <View style={styles.tierRow}>
            <View style={styles.tierLeft}>
              <Trophy size={24} color={colors.amber} weight="fill" />
              <View>
                <Text style={[styles.tierLabel, { color: colors.ink }]}>Gold Tier</Text>
                <Text style={[styles.tierSub, { color: colors.muted }]}>12 jobs this month</Text>
              </View>
            </View>
            <View style={styles.tierRight}>
              <View style={[styles.tierRing, { borderColor: colors.amber }]}>
                <Text style={[styles.tierRingText, { color: colors.ink }]}>68%</Text>
              </View>
              <Text style={[styles.tierToNext, { color: colors.amberDark }]}>3 to Platinum</Text>
            </View>
          </View>
          <View style={styles.tierBarBg}>
            <View style={[styles.tierBarFill, { width: '68%', backgroundColor: colors.amber }]} />
          </View>
          <View style={styles.tierStats}>
            <View style={styles.tierStat}>
              <Fire size={14} color={colors.amberDark} weight="fill" />
              <Text style={[styles.tierStatText, { color: colors.ink }]}>7-week streak</Text>
            </View>
            <View style={styles.tierStatDiv} />
            <View style={styles.tierStat}>
              <Clock size={14} color={colors.muted} weight="regular" />
              <Text style={[styles.tierStatText, { color: colors.muted }]}>Avg 12m response</Text>
            </View>
          </View>
        </View>

        {/* ─── Search ─── */}
        <AISearchBar
          placeholder={t('home.searchPlaceholder')}
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

        {/* ─── Category Grid ─── */}
        <CategoryGrid
          onCategoryPress={(id) => {
            setSelectedCat(id === selectedCat ? 'all' : id)
          }}
          onServicePress={handleSeasonalServicePress}
        />

        {/* ─── Active Jobs ─── */}
        {myOwnJobs.length > 0 && (
          <View style={{ paddingHorizontal: 8, marginTop: 8 }}>
            <View style={styles.secRow}>
              <View style={styles.secTitleRow}>
                <Briefcase size={16} color={colors.success} weight="fill" />
                <Text style={[styles.secTitle, { color: colors.ink }]}>Active Jobs</Text>
              </View>
              <TouchableOpacity style={styles.secMore} onPress={() => router.push('/(customer)/jobs/v2')}>
                <Text style={[styles.secMoreText, { color: colors.amberDark }]}>See All</Text>
                <CaretRight size={12} color={colors.amberDark} weight="bold" />
              </TouchableOpacity>
            </View>
            {myOwnJobs.slice(0, 3).map((job: any) => (
              <TouchableOpacity key={job.id} style={[styles.activeCard, { backgroundColor: colors.white, borderLeftColor: colors.success }]}
                onPress={() => router.push(`/(customer)/jobs/v2/${job.id}`)} activeOpacity={0.7}>
                <View style={[styles.activeDot, { backgroundColor: colors.success }]} />
                <View style={styles.activeInfo}>
                  <Text style={[styles.activeTitle, { color: colors.ink }]} numberOfLines={1}>{job.title}</Text>
                  <Text style={[styles.activeStatus, { color: colors.success }]}>{t(translateJobStatus(job.status))}</Text>
                </View>
                {(quoteCounts[job.id] || 0) > 0 && (
                  <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>{quoteCounts[job.id]} quotes</Text></View>
                )}
                <CaretRight size={14} color={colors.muted} weight="bold" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ─── Seasonal Offers ─── */}
        <SeasonalOffersComponent onServicePress={handleSeasonalServicePress} />

        {/* ─── Hot Offers ─── */}
        <View style={styles.secRow}>
          <View style={styles.secTitleRow}>
            <Fire size={16} color={colors.amberDark} weight="fill" />
            <Text style={[styles.secTitle, { color: colors.ink }]}>Hot Offers</Text>
          </View>
          <TouchableOpacity style={styles.secMore} onPress={() => { setSelectedCat('all'); loadJobs() }}>
            <Text style={[styles.secMoreText, { color: colors.amberDark }]}>See All</Text>
            <CaretRight size={12} color={colors.amberDark} weight="bold" />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizScroll}>
          {hotOffers.map(renderHotOffer)}
        </ScrollView>

        {/* ─── Taskers ─── */}
        {relatedProviders.length > 0 && (
          <View>
          <View style={styles.secRow}>
            <View style={styles.secTitleRow}>
              <Users size={16} color={colors.amberDark} weight="fill" />
              <Text style={[styles.secTitle, { color: colors.ink }]}>Heroes Nearby ({relatedProviders.length})</Text>
            </View>
            <TouchableOpacity style={styles.secMore} onPress={() => router.push('/(customer)/find/taskers')}>
              <Text style={[styles.secMoreText, { color: colors.amberDark }]}>Find Heroes</Text>
              <CaretRight size={12} color={colors.amberDark} weight="bold" />
            </TouchableOpacity>
          </View>
          <View style={styles.providersGrid}>
            {relatedProviders.slice(0, 10).map((p: any, i: number) => (
              <View key={p.id || i} style={[styles.providerCard, { backgroundColor: colors.white, borderColor: colors.border }]}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => { router.push(`/(customer)/find/tasker-profile/${p.id}`) }}
                  style={styles.providerCardTouch}>
                  <View style={[styles.providerAvatar, { backgroundColor: colors.amberLight }]}>
                    {p.avatar ? <Image source={{ uri: p.avatar }} style={styles.providerAvatarImg} /> : <Text style={styles.providerAvatarText}>{(p.name || 'T')[0]}</Text>}
                    {p.verified && <View style={styles.verifiedBadge}><CheckCircle size={14} color="#3B82F6" weight="fill" /></View>}
                  </View>
                  <Text style={[styles.providerName, { color: colors.ink }]} numberOfLines={1}>{p.name || 'Hero'}</Text>
                  <View style={styles.providerMetaRow}>
                    {p.rating ? <Text style={[styles.providerMetaText, { color: colors.amber }]}><Star size={10} color={colors.amber} weight="fill" /> {p.rating.toFixed(1)}</Text> : null}
                    {p.badge ? <View style={[styles.providerBadge, { backgroundColor: p.badgeColor || '#6366F1' }]}><Text style={styles.providerBadgeText}>{p.badge}</Text></View> : null}
                  </View>
                  {(p.skills || p.categories) && (
                    <View style={styles.providerSkillsRow}>
                      {(p.skills || p.categories || []).slice(0, 3).map((s: string, i: number) => (
                        <View key={i} style={[styles.providerSkillChip, { backgroundColor: colors.amberBg, borderColor: colors.amberLight }]}>
                          <Text style={[styles.providerSkillText, { color: colors.amberDark }]} numberOfLines={1}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {p.completedJobs > 0 && <Text style={[styles.providerExp, { color: colors.muted }]}>{p.completedJobs} jobs</Text>}
                  {p.hourlyRate ? <Text style={[styles.providerRate, { color: colors.success }]}>LKR {p.hourlyRate}/hr</Text> : p.fixedRate ? <Text style={[styles.providerRate, { color: colors.success }]}>LKR {p.fixedRate}</Text> : null}
                </TouchableOpacity>
                <TouchableOpacity style={styles.chatBtn} onPress={() => startChat(p)} activeOpacity={0.6}>
                  <ChatCircle size={16} color={colors.amber} weight="fill" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          </View>
        )}

        {/* ─── Jobs Near You ─── */}
        {(loading || nearbyJobs.length > 0) && (
        <View>
        <View style={styles.secRow}>
          <View style={styles.secTitleRow}>
            <List size={16} color={colors.amberDark} weight="regular" />
            <Text style={[styles.secTitle, { color: colors.ink }]}>
              {selectedCat === 'all' ? 'Jobs Near You' : categories.find(c => c.id === selectedCat)?.label}
            </Text>
          </View>
          <TouchableOpacity style={styles.secMore} onPress={() => router.push('/(customer)/jobs/v2')}>
            <Text style={[styles.secMoreText, { color: colors.amberDark }]}>See All</Text>
            <CaretRight size={12} color={colors.amberDark} weight="bold" />
          </TouchableOpacity>
        </View>
        <View style={[styles.feedSection]}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.amber} style={{ padding: 40 }} />
          ) : nearbyJobs.length === 0 ? (
            <View style={styles.emptyFeed}>
              <MagnifyingGlass size={36} color={colors.muted} weight="regular" />
              <Text style={[styles.emptyText, { color: colors.muted }]}>No jobs found</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(customer)/jobs/v2/create')}>
                <Rocket size={16} color="#111827" weight="fill" />
                <Text style={styles.emptyBtnText}>Post a Job</Text>
              </TouchableOpacity>
            </View>
          ) : (
            nearbyJobs.map(renderJobCard)
          )}
        </View>
        </View>
        )}

        {/* ─── Real Estate ─── */}
        <View style={styles.secRow}>
          <View style={styles.secTitleRow}>
            <Buildings size={16} color={colors.amberDark} weight="fill" />
            <Text style={[styles.secTitle, { color: colors.ink }]}>Real Estate</Text>
          </View>
          <TouchableOpacity style={styles.secMore} onPress={() => router.push('/real-estate')}>
            <Text style={[styles.secMoreText, { color: colors.amberDark }]}>See All</Text>
            <CaretRight size={12} color={colors.amberDark} weight="bold" />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizScroll}>
          {[
            { id: 'r1', title: 'Modern 3BR Apartment', price: 'LKR 24M', loc: 'Nugegoda', type: 'For Sale', typeColor: '#F59E0B', gradient: ['#0F172A', '#1e3a5f'] },
            { id: 'r2', title: 'Luxury 2BR Condo', price: 'LKR 85K/mo', loc: 'Colombo 3', type: 'For Rent', typeColor: '#6366F1', gradient: ['#1a0a0a', '#5F1010'] },
            { id: 'r3', title: 'Office Space', price: 'LKR 180K/mo', loc: 'Colombo 7', type: 'Commercial', typeColor: '#10B981', gradient: ['#0a0a1a', '#1a1a5F'] },
          ].map(item => {
            const idx = staggerIdx++
            return (
            <Animated.View key={item.id} style={cardStagger[idx]}>
            <TouchableOpacity style={[styles.reCard, { backgroundColor: colors.white, borderColor: colors.border }]} activeOpacity={0.8} onPress={() => router.push('/real-estate')}>
              <View style={[styles.reImg, { backgroundColor: item.gradient[0] }]}>
                <View style={[styles.reType, { backgroundColor: item.typeColor }]}><Text style={styles.reTypeText}>{item.type}</Text></View>
                <View style={styles.reSave}><Heart size={14} color="#FFFFFF" weight="regular" /></View>
              </View>
              <View style={styles.reBody}>
                <Text style={[styles.rePrice, { color: colors.amberDark }]}>{item.price}</Text>
                <Text style={[styles.reTitle, { color: colors.ink }]}>{item.title}</Text>
                <Text style={[styles.reLoc, { color: colors.muted }]}>{item.loc}</Text>
              </View>
            </TouchableOpacity>
            </Animated.View>
            )
          })}
        </ScrollView>

        {/* ─── Quick Actions ─── */}
        <View style={[styles.actionsCard, { backgroundColor: colors.white }]}>
          <View style={styles.actionsTitleRow}>
            <PlusCircle size={15} color={colors.amberDark} weight="fill" />
            <Text style={[styles.actionsTitle, { color: colors.ink }]}>Quick Actions</Text>
          </View>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={[styles.actionBtnMain, { backgroundColor: colors.amber }]} onPress={() => router.push('/(customer)/jobs/v2/create')}>
              <Briefcase size={22} color="#111827" weight="fill" />
              <Text style={styles.actionBtnLabel}>Post a Job</Text>
              <Text style={styles.actionBtnSub}>Find the perfect pro</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtnCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/real-estate')}>
              <Buildings size={22} color={colors.amberDark} weight="fill" />
              <Text style={[styles.actionBtnLabel, { color: colors.ink }]}>List Property</Text>
              <Text style={[styles.actionBtnSub, { color: colors.muted }]}>Sell or rent</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtnCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.5 }]} activeOpacity={1}>
              <ShieldCheck size={22} color={colors.muted} weight="fill" />
              <Text style={[styles.actionBtnLabel, { color: colors.muted }]}>Helmet Sanitising</Text>
              <Text style={[styles.actionBtnSub, { color: colors.muted }]}>Clean & protect</Text>
              <View style={[styles.actionNewBadge, { backgroundColor: colors.muted }]}><Text style={styles.actionNewText}>Soon</Text></View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtnCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.5 }]} activeOpacity={1}>
              <Tag size={22} color={colors.muted} weight="fill" />
              <Text style={[styles.actionBtnLabel, { color: colors.muted }]}>Sell an Item</Text>
              <Text style={[styles.actionBtnSub, { color: colors.muted }]}>Marketplace</Text>
              <View style={[styles.actionNewBadge, { backgroundColor: colors.muted }]}><Text style={styles.actionNewText}>Soon</Text></View>
            </TouchableOpacity>
          </View>
        </View>

        {recentConversations.length > 0 && (
          <View>
            <View style={styles.secRow}>
              <View style={styles.secTitleRow}>
                <ChatCircle size={16} color={colors.amberDark} weight="regular" />
                <Text style={[styles.secTitle, { color: colors.ink }]}>{t('customer.messages')}</Text>
              </View>
              <TouchableOpacity style={styles.secMore} onPress={() => router.push('/(customer)/(tabs)/inbox')}>
                <Text style={[styles.secMoreText, { color: colors.amberDark }]}>{t('common.viewAll')}</Text>
                <CaretRight size={12} color={colors.amberDark} weight="bold" />
              </TouchableOpacity>
            </View>
            <View style={[styles.feedSection]}>
              {recentConversations.map((conv: any) => (
                <TouchableOpacity
                  key={conv.id}
                  style={[styles.convCard, { backgroundColor: colors.white, borderColor: colors.border }]}
                  onPress={() => router.push(`/(chat)/${conv.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.convAvatar, { backgroundColor: colors.customerAccent }]}>
                    <Text style={styles.convAvatarText}>{conv.otherUser?.name?.[0] || '?'}</Text>
                  </View>
                  <View style={styles.convContent}>
                    <View style={styles.convTopRow}>
                      <Text style={[styles.convName, { color: colors.ink }]} numberOfLines={1}>{conv.otherUser?.name || 'Unknown'}</Text>
                      {conv.lastMessage?.createdAt && (
                        <Text style={[styles.convTime, { color: colors.muted }]}>
                          {(() => {
                            const d = new Date(conv.lastMessage.createdAt)
                            const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
                            if (diff === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            if (diff === 1) return t('common.yesterday')
                            return d.toLocaleDateString()
                          })()}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.convLastMsg, { color: colors.muted }]} numberOfLines={1}>
                      {conv.lastMessage?.text || t('customer.noMessages')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {selectedOffer && (
        <BookingSheet visible={bookingVisible} onClose={handleBookingClose} onConfirm={handleBookingConfirm}
          serviceName={selectedOffer.title} basePrice={parseOfferPrice(selectedOffer.price)} />
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 32 },

  header: { marginHorizontal: 8, marginTop: 8, borderRadius: 24, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4 },
  hdrRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hdrLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hdrAvatarWrap: { position: 'relative' },
  hdrAvatar: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  hdrAvatarText: { fontSize: 16, fontFamily: fonts.heading, color: colors.ink },
  hdrGreet: { fontSize: 11, fontFamily: fonts.bodyMedium },
  hdrName: { fontSize: 19, fontFamily: fonts.heading, letterSpacing: -0.4 },
  hdrRight: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  notifBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  notifPip: { position: 'absolute', top: 7, right: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red, borderWidth: 1.5, borderColor: colors.white },
  settingsBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },

  tierCard: { marginHorizontal: 8, marginTop: 8, borderRadius: 24, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: colors.border },
  tierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tierLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tierLabel: { fontSize: 18, fontFamily: fonts.heading },
  tierSub: { fontSize: 12, fontFamily: fonts.body, marginTop: 1 },
  tierRight: { alignItems: 'center', gap: 4 },
  tierRing: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  tierRingText: { fontSize: 12, fontFamily: fonts.bodyMedium },
  tierToNext: { fontSize: 10, fontFamily: fonts.bodyMedium },
  tierBarBg: { height: 6, borderRadius: 3, backgroundColor: colors.border, marginBottom: 10, overflow: 'hidden' },
  tierBarFill: { height: 6, borderRadius: 3 },
  tierStats: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tierStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tierStatText: { fontSize: 12, fontFamily: fonts.bodyMedium },
  tierStatDiv: { width: 1, height: 14, backgroundColor: colors.border },

  pillsScroll: { gap: 8, paddingHorizontal: 8, paddingVertical: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 100, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  pillActive: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  pillText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink },
  pillTextActive: { color: colors.amberDark },

  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  secTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  secTitle: { fontSize: 16, fontFamily: fonts.heading },
  secMore: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  secMoreText: { fontSize: 12, fontFamily: fonts.bodyMedium },

  horizScroll: { gap: 10, paddingHorizontal: 8, paddingBottom: 4 },

  offCard: { minWidth: 210, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6 },
  offGradient: { height: 110, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  offBadge: { position: 'absolute', top: 10, left: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  offBadgeText: { fontSize: 10, fontFamily: fonts.bodyMedium, color: '#FFFFFF' },
  offBody: { padding: 12 },
  offTitle: { fontSize: 13, fontFamily: fonts.bodyMedium, marginBottom: 4 },
  offLoc: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  offLocText: { fontSize: 10, fontFamily: fonts.bodyMedium },
  offPrice: { fontSize: 14, fontFamily: fonts.heading, marginTop: 4 },

  activeCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 14, marginBottom: 6, marginHorizontal: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1, borderLeftWidth: 4 },
  activeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  activeInfo: { flex: 1 },
  activeTitle: { fontSize: 14, fontFamily: fonts.bodyMedium },
  activeStatus: { fontSize: 11, fontFamily: fonts.body, marginTop: 2 },
  activeBadge: { backgroundColor: colors.amber, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, marginRight: 6 },
  activeBadgeText: { fontSize: 10, fontFamily: fonts.bodyMedium, color: '#111827' },

  feedSection: { paddingHorizontal: 8 },
  jc: { flexDirection: 'row', borderRadius: 20, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3, overflow: 'hidden' },
  jcCatImg: { width: 80, height: 100, borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },
  jcBody: { padding: 12, paddingLeft: 10, flex: 1, justifyContent: 'center' },
  jcTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  jcTitle: { fontSize: 14, fontFamily: fonts.bodyMedium, flex: 1, marginRight: 8 },
  jcPrice: { fontSize: 14, fontFamily: fonts.heading },
  jcTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 6 },
  tag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100 },
  tagText: { fontSize: 10, fontFamily: fonts.bodyMedium },
  jcLoc: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 9 },
  jcLocText: { fontSize: 11, fontFamily: fonts.bodyMedium },
  jcActs: { flexDirection: 'row', gap: 7 },
  applyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.amber, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12, shadowColor: colors.amber, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  applyText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.ink },
  saveBtn: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },

  emptyFeed: { alignItems: 'center', padding: 40, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: fonts.body },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.amber, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 },
  emptyBtnText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: '#111827' },

  reCard: { minWidth: 210, borderRadius: 20, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 4 },
  reImg: { height: 120, position: 'relative', padding: 10 },
  reType: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, alignSelf: 'flex-start' },
  reTypeText: { fontSize: 10, fontFamily: fonts.bodyMedium, color: '#111827' },
  reSave: { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  reBody: { padding: 12 },
  rePrice: { fontSize: 16, fontFamily: fonts.heading, letterSpacing: -0.3, marginBottom: 2 },
  reTitle: { fontSize: 13, fontFamily: fonts.bodyMedium, marginBottom: 2 },
  reLoc: { fontSize: 11, fontFamily: fonts.bodyMedium },

  actionsCard: { marginHorizontal: 8, marginTop: 8, borderRadius: 24, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4 },
  actionsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  actionsTitle: { fontSize: 14, fontFamily: fonts.bodyMedium },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtnMain: { width: '48%', borderRadius: 20, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#F59E0B' },
  actionBtnCard: { width: '48%', borderRadius: 20, padding: 16, alignItems: 'center', borderWidth: 1.5, position: 'relative', overflow: 'hidden' },
  actionBtnLabel: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink, textAlign: 'center', marginTop: 6 },
  actionBtnSub: { fontSize: 10, fontFamily: fonts.body, textAlign: 'center', marginTop: 2, color: colors.ink, opacity: 0.7 },
  actionNewBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: colors.red, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100 },
  actionNewText: { fontSize: 9, fontFamily: fonts.bodyMedium, color: '#FFFFFF' },

  providersGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, gap: 8, paddingBottom: 4 },
  providerCard: { width: '48%', borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  providerCardTouch: { padding: 14, gap: 4 },
  chatBtn: { position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.amber + '20', justifyContent: 'center', alignItems: 'center' },
  providerAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  providerAvatarText: { fontSize: 18, fontFamily: fonts.heading, color: colors.amberDark },
  providerAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  verifiedBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: colors.white, borderRadius: 7 },
  providerName: { fontSize: 13, fontFamily: fonts.bodyMedium },
  providerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  providerMetaText: { fontSize: 11, fontFamily: fonts.bodyMedium },
  providerBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  providerBadgeText: { fontSize: 8, fontFamily: fonts.bodySemiBold, color: '#fff' },
  providerSkillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  providerSkillChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 0.5 },
  providerSkillText: { fontSize: 9, fontFamily: fonts.bodyMedium },
  providerExp: { fontSize: 10, fontFamily: fonts.body, color: colors.muted },
  providerRate: { fontSize: 13, fontFamily: fonts.heading, marginTop: 2 },
  convCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, marginBottom: 6, borderWidth: 1 },
  convAvatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  convAvatarText: { fontSize: 16, fontFamily: fonts.heading, color: '#fff' },
  convContent: { flex: 1 },
  convTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  convName: { fontSize: 14, fontFamily: fonts.bodyMedium, flex: 1, marginRight: 8 },
  convTime: { fontSize: 11, fontFamily: fonts.body },
  convLastMsg: { fontSize: 13, fontFamily: fonts.body },
})
