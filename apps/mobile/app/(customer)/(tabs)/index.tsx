import { useEffect, useRef, useState, useCallback, useMemo, useSyncExternalStore } from 'react'
import { View, Text, TextInput, Image, TouchableOpacity, ScrollView, StyleSheet, Animated, ActivityIndicator, RefreshControl, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../../lib/auth'
import { v2Jobs, v2Quotes, v2Match } from '../../../lib/api-v2'
import { taskers, conversations } from '../../../lib/api'
import { matchCategory } from '../../../lib/aiMatch'
import { getCategoryImageUrl } from '../../../lib/categories'
import { useTranslation } from 'react-i18next'
import { translateJobStatus } from '../../../lib/i18n'
import { useTheme } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { spacing, fontSizes } from '../../../lib/tokens'
import { useStagger } from '../../../lib/animations'
import { on, removedJobs, subscribe, getVersion } from '../../../lib/events'
import BookingSheet from '../../../components/offers/BookingSheet'
import type { BookingFormData } from '../../../components/offers/BookingSheet'

export default function CustomerHome() {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useTranslation()
  const categories = useMemo(() => [
    { id: 'all', icon: 'grid-outline', label: t('home.categories.all') },
    { id: 'cleaning', icon: 'sparkles-outline', label: t('home.categories.cleaning') },
    { id: 'electrical', icon: 'flash-outline', label: t('home.categories.electrical') },
    { id: 'plumbing', icon: 'water-outline', label: t('home.categories.plumbing') },
    { id: 'ac', icon: 'snow-outline', label: t('home.categories.ac') },
    { id: 'painting', icon: 'color-palette-outline', label: t('home.categories.painting') },
    { id: 'digital', icon: 'laptop-outline', label: t('home.categories.digital') },
  ], [])
  const hotOffers = useMemo(() => [
    { id: 'h1', gradient: ['#0F172A', '#1E3A5F'], badge: t('home.hotOffersList.hotDeal'), badgeColor: '#EF4444', icon: 'sparkles', label: t('home.hotOffersList.deepClean'), title: t('home.hotOffersList.fullHouseCleaning'), loc: t('home.hotOffersList.colombo5'), distance: t('home.hotOffersList.distance1'), price: t('home.hotOffersList.fromPrice1') },
    { id: 'h2', gradient: ['#1a1a0a', '#3D2B00'], badge: t('home.hotOffersList.new'), badgeColor: '#F59E0B', icon: 'flash', label: t('home.hotOffersList.sameDayElectric'), title: t('home.hotOffersList.electricalRepairs'), loc: t('home.hotOffersList.nugegoda'), distance: t('home.hotOffersList.distance2'), price: t('home.hotOffersList.fromPrice2') },
    { id: 'h3', gradient: ['#0a1a0a', '#1a3a1a'], badge: t('home.hotOffersList.featured'), badgeColor: '#6366F1', icon: 'laptop', label: t('home.hotOffersList.webDesignPro'), title: t('home.hotOffersList.websiteIn5Days'), loc: t('home.hotOffersList.remote'), distance: t('home.hotOffersList.worldwide'), price: t('home.hotOffersList.fromPrice3') },
  ], [])
  const [myJobs, setMyJobs] = useState<any[]>([])
  const [quoteCounts, setQuoteCounts] = useState<Record<string, number>>({})
  const [relatedProviders, setRelatedProviders] = useState<any[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedCat, setSelectedCat] = useState('all')
  const [aiQuery, setAiQuery] = useState('')
  const [aiMatchResult, setAiMatchResult] = useState<ReturnType<typeof matchCategory>>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const glowAnim = useRef(new Animated.Value(0)).current
  const activeGreenAnim = useRef(new Animated.Value(0)).current
  const [staggerKey, setStaggerKey] = useState(0)
  const [selectedOffer, setSelectedOffer] = useState<typeof hotOffers[0] | null>(null)
  const [bookingVisible, setBookingVisible] = useState(false)
  const { newJobId } = useLocalSearchParams<{ newJobId?: string }>()

  const userId = user?.id
  const myOwnJobs = myJobs.filter(j => !removedJobs.has(j.id) && (j.customerId === userId || (newJobId && j.id === newJobId)) && j.status !== 'COMPLETED' && j.status !== 'CANCELLED')
  const nearbyJobs = myJobs.filter(j => !removedJobs.has(j.id) && j.customerId !== userId && (!newJobId || j.id !== newJobId))

  const MOCK_PROVIDERS = [
    { id: 'm1', userId: 'u1', name: 'Saman Kumara', avatar: '', rating: 4.8, completedJobs: 127, hourlyRate: 1500, verified: true, badge: 'PRO', badgeColor: '#6366F1', categories: ['Cleaning', 'Plumbing'], entityType: 'INDIVIDUAL', experienceYears: 6, bio: 'Expert cleaner and plumber with 6+ years experience serving Colombo area.' },
    { id: 'm2', userId: 'u2', name: 'Priya Devi', avatar: '', rating: 4.9, completedJobs: 89, fixedRate: 8500, verified: true, badge: 'Top Rated', badgeColor: '#F59E0B', categories: ['Electrical', 'AC'], entityType: 'INDIVIDUAL', experienceYears: 4, bio: 'Licensed electrician specializing in home wiring and AC repairs.' },
    { id: 'm3', userId: 'u3', name: 'QuickFix Solutions', avatar: '', rating: 4.6, completedJobs: 203, hourlyRate: 1200, verified: true, badge: 'Expert', badgeColor: '#10B981', categories: ['Painting', 'Cleaning'], entityType: 'COMPANY', experienceYears: 8, bio: 'Trusted painting and cleaning company serving 200+ happy clients.' },
    { id: 'm4', userId: 'u4', name: 'Nimal Fernando', avatar: '', rating: 4.7, completedJobs: 156, hourlyRate: 1800, verified: true, badge: 'PRO', badgeColor: '#6366F1', categories: ['Plumbing', 'Electrical'], entityType: 'INDIVIDUAL', experienceYears: 10, bio: 'Master plumber and electrician with over a decade of experience.' },
    { id: 'm5', userId: 'u5', name: 'TechHome Services', avatar: '', rating: 4.5, completedJobs: 64, fixedRate: 12000, verified: true, badge: 'New', badgeColor: '#3B82F6', categories: ['Digital', 'Photography'], entityType: 'COMPANY', experienceYears: 3, bio: 'Full-service digital solutions company offering web, design and photography.' },
    { id: 'm6', userId: 'u6', name: 'Ruwan Wick', avatar: '', rating: 4.9, completedJobs: 312, hourlyRate: 2000, verified: true, badge: 'PRO', badgeColor: '#6366F1', categories: ['Electrical', 'AC', 'Plumbing'], entityType: 'INDIVIDUAL', experienceYears: 12, bio: 'Top-rated multi-skilled professional with 12+ years in electrical and plumbing.' },
    { id: 'm7', userId: 'u7', name: 'Sparkle Clean Co', avatar: '', rating: 4.4, completedJobs: 45, fixedRate: 5500, verified: false, badge: 'Featured', badgeColor: '#EF4444', categories: ['Cleaning'], entityType: 'COMPANY', experienceYears: 2, bio: 'Professional cleaning company offering deep cleaning and maintenance.' },
    { id: 'm8', userId: 'u8', name: 'Thilina Raj', avatar: '', rating: 4.8, completedJobs: 178, hourlyRate: 1600, verified: true, badge: 'Top Rated', badgeColor: '#F59E0B', categories: ['Digital', 'Tutoring', 'Photography'], entityType: 'INDIVIDUAL', experienceYears: 7, bio: 'Digital creator and tutor specializing in web development and photography.' },
  ]

  const totalCards = useMemo(() => hotOffers.length + (myJobs?.length || 0) + 3, [myJobs])
  const cardStagger = useStagger(totalCards, 100, 60, staggerKey)

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: false }),
      ])
    ).start()
    Animated.loop(
      Animated.sequence([
        Animated.timing(activeGreenAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
        Animated.timing(activeGreenAnim, { toValue: 0, duration: 1000, useNativeDriver: false }),
      ])
    ).start()
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
      } else {
        setQuoteCounts({})
      }
      const targetJobId = newJobId || (ownJobs.length > 0 ? ownJobs[0].id : null)
      if (targetJobId) {
        const [matchRes, allTaskersRes] = await Promise.allSettled([
          v2Match.getProviders(targetJobId),
          taskers.list(),
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
    } catch (e) {
      console.error('Load jobs error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
      setStaggerKey(k => k + 1)
    }
  }, [selectedCat])

  const handleAiChange = useCallback((text: string) => {
    setAiQuery(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const result = matchCategory(text)
      setAiMatchResult(result)
      if (result) {
        const cat = categories.find(c => result.categoryName.toLowerCase().includes(c.id) || c.id === result.categoryName.toLowerCase())
        if (cat) setSelectedCat(cat.id)
      }
    }, 400)
  }, [])

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return t('home.greeting.morning')
    if (h < 17) return t('home.greeting.afternoon')
    return t('home.greeting.evening')
  }

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.6] })
  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.08] })
  const borderGlow = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [colors.amber + '40', colors.amber] })
  const greenPulse = activeGreenAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] })
  const greenBorder = activeGreenAnim.interpolate({ inputRange: [0, 1], outputRange: [colors.success + '60', colors.success] })
  const greenBorderWidth = activeGreenAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] })

  const handleOfferPress = (offer: typeof hotOffers[0]) => {
    setSelectedOffer(offer)
    setBookingVisible(true)
  }

  const handleBookingConfirm = (data: BookingFormData) => {
    setBookingVisible(false)
    setSelectedOffer(null)
    Alert.alert(t('home.bookingConfirmedTitle'), t('home.bookingConfirmedMessage', { date: data.date, timeSlot: data.timeSlot }))
  }

  const handleBookingClose = () => {
    setBookingVisible(false)
    setSelectedOffer(null)
  }

  const parseOfferPrice = (price: string): number | undefined => {
    const match = price.replace(/,/g, '').match(/(\d+)/)
    return match ? parseInt(match[1], 10) : undefined
  }

  const startChat = async (p: any) => {
    const participantId = p.userId
    if (!participantId) {
      router.push(`/(customer)/find/tasker-profile/${p.id}`)
      return
    }
    try {
      const conv = await conversations.create({ participantId })
      router.push(`/(chat)/${conv.id}`)
    } catch {
      router.push(`/(customer)/find/tasker-profile/${p.id}`)
    }
  }

  let staggerIdx = 0

  const renderHotOffer = (item: typeof hotOffers[0], i: number) => {
    const idx = staggerIdx++
    return (
    <Animated.View key={item.id} style={cardStagger[idx]}>
    <TouchableOpacity activeOpacity={0.8} onPress={() => handleOfferPress(item)} style={styles.offCard}>
      <View style={[styles.offImg, { backgroundColor: item.gradient[0] }]}>
        <View style={[styles.offBadge, { backgroundColor: item.badgeColor }]}>
          <Text style={styles.offBadgeText}>{item.badge}</Text>
        </View>
        <View style={styles.offImgBottom}>
          <Ionicons name={item.icon as any} size={13} color={colors.amber} />
          <Text style={styles.offImgLabel}>{item.label}</Text>
        </View>
      </View>
      <View style={[styles.offBody, { backgroundColor: colors.white }]}>
        <Text style={[styles.offTitle, { color: colors.ink }]}>{item.title}</Text>
        <View style={styles.offLoc}>
          <Ionicons name="location-outline" size={10} color={colors.muted} />
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
    <TouchableOpacity
      key={job.id || `demo-${i}`}
      style={[styles.jc, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
      activeOpacity={0.7}
      onPress={() => router.push(`/(customer)/jobs/v2/${job.id}`)}
    >
      <Image source={{ uri: catImg }} style={styles.jcCatImg} resizeMode="cover" />
      <View style={styles.jcBody}>
        <View style={styles.jcTop}>
          <Text style={[styles.jcTitle, { color: colors.ink }]} numberOfLines={1}>{job.title || t('home.untitledJob')}</Text>
          <Text style={[styles.jcPrice, { color: colors.amberDark }]}>LKR {job.budgetAmount?.toLocaleString() || '—'}</Text>
        </View>
        {(job.categoryName || job.urgency) && (
          <View style={styles.jcTags}>
            {job.categoryName && <View style={[styles.tag, { backgroundColor: colors.amberBg }]}><Text style={[styles.tagText, { color: colors.amberDark }]}>{job.categoryName}</Text></View>}
            {job.urgency && <View style={[styles.tag, { backgroundColor: colors.amberBg }]}><Text style={[styles.tagText, { color: colors.amberDark }]}>{job.urgency}</Text></View>}
            {job.status && <View style={[styles.tag, { backgroundColor: colors.successBg }]}><Text style={[styles.tagText, { color: colors.success }]}>{t(translateJobStatus(job.status))}</Text></View>}
          </View>
        )}
        <View style={styles.jcLoc}>
          <Ionicons name={job.isRemote ? 'globe-outline' : 'location-outline'} size={12} color={colors.muted} />
          <Text style={[styles.jcLocText, { color: colors.muted }]}>
            {job.isRemote ? t('home.noLocation') : (job.locationName || t('home.noLocation'))}
            {job.distance ? ` · ${job.distance}` : ''}
          </Text>
        </View>
        <View style={styles.jcActs}>
          <TouchableOpacity style={styles.applyBtn} onPress={() => handleApply(job)}>
            <Ionicons name="send-outline" size={12} color="#111827" />
            <Text style={styles.applyText}>{job.isRemote ? t('home.sendQuote') : t('home.applyNow')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={() => handleSave(job)}>
            <Ionicons name="bookmark-outline" size={13} color={colors.muted} />
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
              <Text style={[styles.hdrGreet, { color: colors.muted }]}>{getGreeting()}</Text>
              <Text style={[styles.hdrName, { color: colors.ink }]}>{user?.name || t('home.user')}</Text>
            </View>
            <View style={styles.hdrRight}>
              <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/(customer)/settings/notifications')}>
                <Ionicons name="notifications-outline" size={17} color={colors.ink} />
                <View style={styles.notifPip} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.avt, { backgroundColor: colors.amber }]} onPress={() => router.push('/(customer)/(tabs)/settings')}>
                <Text style={styles.avtText}>{(user?.name || 'U')[0]}</Text>
                <View style={styles.avtDot} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ─── AI Search Bar ─── */}
        <View style={styles.aiWrap}>
          <Animated.View style={[styles.glowRing, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
          <Animated.View style={[styles.aiBar, { backgroundColor: colors.white, borderColor: aiMatchResult ? colors.amber : borderGlow }]}>
            <Ionicons name="sparkles" size={16} color={colors.amberDark} style={styles.aiSpark} />
            <TextInput
              style={[styles.aiInput, { color: colors.ink }]}
              placeholder={t('home.searchPlaceholder')}
              placeholderTextColor={colors.muted}
              value={aiQuery}
              onChangeText={handleAiChange}
            />
            <TouchableOpacity style={styles.aiBtn} onPress={() => { if (aiMatchResult && aiMatchResult.categoryName) loadJobs() }}>
              <Ionicons name="arrow-forward" size={13} color="#111827" />
            </TouchableOpacity>
          </Animated.View>
          {aiMatchResult && aiMatchResult.correctedText && aiQuery.length > 0 && (
            <View style={[styles.correctionCard, { backgroundColor: colors.amberBg }]}>
              <Ionicons name="text-outline" size={14} color={colors.amberDark} />
              <Text style={[styles.correctionText, { color: colors.ink }]}>
                {t('home.didYouMean')}<Text style={{ fontFamily: fonts.heading }}>{aiMatchResult.categoryName}</Text>?
              </Text>
            </View>
          )}
        </View>

        {/* ─── Category Pills ─── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.pill, selectedCat === cat.id && { backgroundColor: colors.amberBg, borderColor: colors.amber }]}
              onPress={() => { setSelectedCat(cat.id); setAiMatchResult(null); setAiQuery('') }}
              activeOpacity={0.7}
            >
              <Ionicons name={cat.icon as any} size={13} color={selectedCat === cat.id ? colors.amberDark : colors.muted} />
              <Text style={[styles.pillText, { color: selectedCat === cat.id ? colors.amberDark : colors.ink }]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ─── Active Jobs (Uber-style, user's own jobs) ─── */}
        {myOwnJobs.length > 0 && (
          <View style={{ paddingHorizontal: 8, marginTop: 12 }}>
            <View style={styles.secRow}>
              <View style={styles.secTitleRow}>
                <Ionicons name="briefcase-outline" size={16} color={colors.success} />
                <Text style={[styles.secTitle, { color: colors.ink }]}>{t('home.activeJobs')}</Text>
                <Animated.View style={[styles.greenDot, { opacity: greenPulse }]} />
              </View>
              <TouchableOpacity style={styles.secMore} onPress={() => router.push('/(customer)/jobs/v2')}>
                <Text style={[styles.secMoreText, { color: colors.success }]}>{t('common.seeAll')}</Text>
                <Ionicons name="chevron-forward" size={12} color={colors.success} />
              </TouchableOpacity>
            </View>
            <View style={styles.activeJobsList}>
              {myOwnJobs.slice(0, 3).map((job: any) => (
                <Animated.View
                  key={job.id}
                  style={[styles.activeJobCard, { backgroundColor: colors.white, borderColor: colors.success + '30', opacity: activeGreenAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }]}
                >
                  <TouchableOpacity
                    onPress={() => router.push(`/(customer)/jobs/v2/${job.id}`)}
                    activeOpacity={0.7}
                    style={styles.activeJobCardTouch}
                  >
                    <Animated.View style={[styles.activeJobPulse, { backgroundColor: colors.success, opacity: greenPulse }]} />
                    <View style={styles.activeJobInfo}>
                      <View style={styles.activeJobTitleRow}>
                        <Text style={[styles.activeJobTitle, { color: colors.ink }]} numberOfLines={1}>{job.title}</Text>
                        {(quoteCounts[job.id] || 0) > 0 && (
                          <View style={styles.quoteBadge}>
                            <Text style={styles.quoteBadgeText}>{quoteCounts[job.id]} {t('jobDetail.quote')}</Text>
                          </View>
                        )}
                        {job.preferredDate && (
                          <View style={styles.dateBadge}>
                            <Text style={styles.dateBadgeText}>{job.preferredDate}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.activeJobStatus, { color: colors.success }]}>{t(translateJobStatus(job.status))}</Text>
                    </View>
                    <Text style={[styles.activeJobBudget, { color: colors.success }]}>LKR {job.budgetAmount?.toLocaleString()}</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.success} />
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </View>
        )}

        {/* ─── Hot Offers ─── */}
        <View style={styles.secRow}>
          <View style={styles.secTitleRow}>
            <Ionicons name="flame-outline" size={16} color={colors.amberDark} />
            <Text style={[styles.secTitle, { color: colors.ink }]}>{t('home.hotOffers')}</Text>
          </View>
          <TouchableOpacity style={styles.secMore} onPress={() => { setSelectedCat('all'); loadJobs() }}>
            <Text style={[styles.secMoreText, { color: colors.amberDark }]}>{t('common.seeAll')}</Text>
            <Ionicons name="chevron-forward" size={12} color={colors.amberDark} />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizScroll}>
          {hotOffers.map(renderHotOffer)}
        </ScrollView>

        {/* ─── Nearby Taskers ─── */}
        {relatedProviders.length > 0 && (
          <View>
          <View style={styles.secRow}>
            <View style={styles.secTitleRow}>
              <Ionicons name="people-outline" size={16} color={colors.amberDark} />
              <Text style={[styles.secTitle, { color: colors.ink }]}>{t('customer.taskersNearby', { n: relatedProviders.length })}</Text>
            </View>
            <TouchableOpacity style={styles.secMore} onPress={() => router.push('/(customer)/find/taskers')}>
              <Text style={[styles.secMoreText, { color: colors.amberDark }]}>{t('customer.findTasker')}</Text>
              <Ionicons name="chevron-forward" size={12} color={colors.amberDark} />
            </TouchableOpacity>
          </View>
          <View style={styles.providersGrid}>
            {relatedProviders.slice(0, 10).map((p: any, i: number) => (
              <View
                key={p.id || i}
                style={[styles.providerCard, { backgroundColor: colors.white }]}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    const base = `/(customer)/find/tasker-profile/${p.id}`
                    const jobId = myOwnJobs[0]?.id
                    router.push(jobId ? `${base}?jobId=${jobId}` : base)
                  }}
                  style={styles.providerCardTouch}
                >
                  <View style={styles.providerAvatar}>
                    {p.avatar ? (
                      <Image source={{ uri: p.avatar }} style={styles.providerAvatarImg} />
                    ) : (
                      <Text style={styles.providerAvatarText}>{(p.name || 'T')[0]}</Text>
                    )}
                    {p.verified && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#3B82F6" />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.providerName, { color: colors.ink }]} numberOfLines={1}>{p.name || t('jobDetail.provider')}</Text>
                  <View style={styles.providerMetaRow}>
                    {p.entityType && (
                      <View style={[styles.entityTag, { backgroundColor: p.entityType === 'COMPANY' ? '#6366F1' + '20' : '#10B981' + '20' }]}>
                        <Text style={[styles.entityTagText, { color: p.entityType === 'COMPANY' ? '#6366F1' : '#10B981' }]}>
                          {p.entityType === 'COMPANY' ? t('customer.company') : t('customer.individual')}
                        </Text>
                      </View>
                    )}
                    {p.rating ? (
                      <Text style={[styles.providerMetaText, { color: colors.amber }]}>★ {p.rating.toFixed(1)}</Text>
                    ) : null}
                    {p.badge ? (
                      <View style={[styles.providerBadge, { backgroundColor: p.badgeColor || '#6366F1' }]}>
                        <Text style={styles.providerBadgeText}>{p.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  {p.completedJobs > 0 && (
                    <Text style={[styles.providerExp, { color: colors.muted }]}>{p.completedJobs} {t('customer.jobsCompleted')}</Text>
                  )}
                  <View style={styles.providerChargeRow}>
                    {p.hourlyRate ? (
                      <Text style={[styles.providerRate, { color: colors.success }]}>LKR {p.hourlyRate}/hr</Text>
                    ) : p.fixedRate ? (
                      <Text style={[styles.providerRate, { color: colors.success }]}>LKR {p.fixedRate}</Text>
                    ) : null}
                  </View>
                  {p.categories && p.categories.length > 0 && (
                    <View style={styles.providerCats}>
                      {(p.categories || []).slice(0, 2).map((cat: string, ci: number) => (
                        <View key={ci} style={[styles.catTag, { backgroundColor: colors.amber + '20' }]}>
                          <Text style={[styles.catTagText, { color: colors.amberDark }]}>{cat}</Text>
                        </View>
                      ))}
                      {(p.categories || []).length > 2 && (
                        <Text style={[styles.catMore, { color: colors.muted }]}>+{p.categories.length - 2}</Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.chatBtnWrap}
                  onPress={() => startChat(p)}
                  activeOpacity={0.6}
                >
                  <Ionicons name="chatbubble-outline" size={16} color={colors.amber} />
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
            <Ionicons name="list-outline" size={16} color={colors.amberDark} />
            <Text style={[styles.secTitle, { color: colors.ink }]}>
              {selectedCat === 'all' ? t('home.jobsNearYou') : categories.find(c => c.id === selectedCat)?.label}
            </Text>
          </View>
          <TouchableOpacity style={styles.secMore} onPress={() => router.push('/(customer)/jobs/v2')}>
            <Text style={[styles.secMoreText, { color: colors.amberDark }]}>{t('common.seeAll')}</Text>
            <Ionicons name="chevron-forward" size={12} color={colors.amberDark} />
          </TouchableOpacity>
        </View>
        <View style={[styles.feedSection, { backgroundColor: colors.white }]}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.amber} style={{ padding: 40 }} />
          ) : nearbyJobs.length === 0 ? (
            <View style={styles.emptyFeed}>
              <Ionicons name="search-outline" size={36} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>{t('home.noJobs')}</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/post-job')}>
                <Text style={styles.emptyBtnText}>{t('home.postJob')}</Text>
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
            <Ionicons name="business-outline" size={16} color={colors.amberDark} />
            <Text style={[styles.secTitle, { color: colors.ink }]}>{t('realEstate.title')}</Text>
          </View>
          <TouchableOpacity style={styles.secMore} onPress={() => router.push('/real-estate')}>
            <Text style={[styles.secMoreText, { color: colors.amberDark }]}>{t('common.seeAll')}</Text>
            <Ionicons name="chevron-forward" size={12} color={colors.amberDark} />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizScroll}>
          {[
            { id: 'r1', title: t('realEstate.modern3BR'), price: t('realEstate.price24M'), loc: t('realEstate.nugegoda'), type: t('realEstate.forSale'), typeColor: '#F59E0B', gradient: ['#0F172A', '#1e3a5f'] },
            { id: 'r2', title: t('realEstate.luxury2BR'), price: t('realEstate.price85K'), loc: t('realEstate.colombo3'), type: t('realEstate.forRent'), typeColor: '#6366F1', gradient: ['#1a0a0a', '#5F1010'] },
            { id: 'r3', title: t('realEstate.officeSpace'), price: t('realEstate.price180K'), loc: t('realEstate.colombo7'), type: t('realEstate.commercial'), typeColor: '#10B981', gradient: ['#0a0a1a', '#1a1a5F'] },
          ].map(item => {
            const idx = staggerIdx++
            return (
            <Animated.View key={item.id} style={cardStagger[idx]}>
            <TouchableOpacity style={[styles.reCard, { backgroundColor: colors.white, borderColor: colors.border }]} activeOpacity={0.8} onPress={() => router.push('/real-estate')}>
              <View style={[styles.reImg, { backgroundColor: item.gradient[0] }]}>
                <View style={[styles.reType, { backgroundColor: item.typeColor }]}>
                  <Text style={styles.reTypeText}>{item.type}</Text>
                </View>
                <View style={styles.reSave}>
                  <Ionicons name="heart-outline" size={14} color="#FFFFFF" />
                </View>
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

        {/* ─── Post Grid ─── */}
        <View style={[styles.postBar, { backgroundColor: colors.white }]}>
          <View style={styles.postBarTitle}>
            <Ionicons name="add-circle-outline" size={15} color={colors.amberDark} />
            <Text style={[styles.postBarText, { color: colors.ink }]}>{t('home.postOptions.title')}</Text>
          </View>
          <View style={styles.postGrid}>
            <TouchableOpacity style={[styles.postBtn, styles.postBtnMain, { backgroundColor: colors.amber }]} onPress={() => router.push('/post-job')}>
              <View style={[styles.postIcon, { backgroundColor: 'rgba(0,0,0,0.15)' }]}>
                <Ionicons name="briefcase-outline" size={18} color="#111827" />
              </View>
              <Text style={styles.postLabel}>{t('home.postOptions.postJob')}</Text>
              <Text style={styles.postSub}>{t('home.postOptions.postJobDesc')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.postBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/real-estate')}>
              <View style={[styles.postIcon, { backgroundColor: colors.amberBg }]}>
                <Ionicons name="business-outline" size={18} color={colors.amberDark} />
              </View>
              <Text style={[styles.postLabel, { color: colors.ink }]}>{t('home.postOptions.listProperty')}</Text>
              <Text style={[styles.postSub, { color: colors.muted }]}>{t('home.postOptions.listPropertyDesc')}</Text>
              <View style={styles.newBadge}><Text style={styles.newBadgeText}>{t('home.postOptions.new')}</Text></View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.postBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/post-job')}>
              <View style={[styles.postIcon, { backgroundColor: colors.amberBg }]}>
                <Ionicons name="laptop-outline" size={18} color={colors.amberDark} />
              </View>
              <Text style={[styles.postLabel, { color: colors.ink }]}>{t('home.postOptions.digitalService')}</Text>
              <Text style={[styles.postSub, { color: colors.muted }]}>{t('home.postOptions.digitalServiceDesc')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.postBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.postIcon, { backgroundColor: colors.amberBg }]}>
                <Ionicons name="pricetag-outline" size={18} color={colors.amberDark} />
              </View>
              <Text style={[styles.postLabel, { color: colors.ink }]}>{t('home.postOptions.sellItem')}</Text>
              <Text style={[styles.postSub, { color: colors.muted }]}>{t('home.postOptions.sellItemDesc')}</Text>
              <View style={[styles.newBadge, { backgroundColor: colors.muted }]}><Text style={styles.newBadgeText}>{t('home.postOptions.soon')}</Text></View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {selectedOffer && (
        <BookingSheet
          visible={bookingVisible}
          onClose={handleBookingClose}
          onConfirm={handleBookingConfirm}
          serviceName={selectedOffer.title}
          basePrice={parseOfferPrice(selectedOffer.price)}
        />
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 32 },

  header: { marginHorizontal: 8, marginTop: 8, borderRadius: 18, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 4 },
  hdrRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hdrLeft: { gap: 1 },
  hdrGreet: { fontSize: 11, fontFamily: fonts.bodyMedium },
  hdrName: { fontSize: 19, fontFamily: fonts.heading, letterSpacing: -0.4 },
  hdrRight: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  notifBtn: { width: 36, height: 36, borderRadius: 11, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  notifPip: { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 50, backgroundColor: colors.red, borderWidth: 1.5, borderColor: colors.white },
  avt: { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  avtText: { fontSize: 13, fontFamily: fonts.heading, color: '#111827' },
  avtDot: { position: 'absolute', bottom: -2, right: -2, width: 9, height: 9, borderRadius: 50, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.white },

  aiWrap: { marginHorizontal: 8, marginTop: 8, position: 'relative' },
  glowRing: { position: 'absolute', inset: -8, borderRadius: 26, backgroundColor: colors.amber, opacity: 0.3, shadowColor: colors.amber, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 16, elevation: 8 },
  aiBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1.5, paddingVertical: 13, paddingLeft: 42, paddingRight: 46 },
  aiSpark: { position: 'absolute', left: 15 },
  aiInput: { flex: 1, fontSize: 13, fontFamily: fonts.bodyMedium },
  aiBtn: { position: 'absolute', right: 7, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.amber, justifyContent: 'center', alignItems: 'center', shadowColor: colors.amber, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  correctionCard: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, borderRadius: 10, padding: 10 },
  correctionText: { fontSize: 12, fontFamily: fonts.body, flex: 1 },

  pillsScroll: { gap: 7, paddingHorizontal: 8, paddingVertical: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 13, borderRadius: 100, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  pillText: { fontSize: 11, fontFamily: fonts.bodyMedium },

  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  secTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  secTitle: { fontSize: 14, fontFamily: fonts.heading },
  secMore: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  secMoreText: { fontSize: 11, fontFamily: fonts.bodyMedium },

  horizScroll: { gap: 10, paddingHorizontal: 8, paddingBottom: 4 },

  offCard: { minWidth: 200, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  offImg: { height: 110, justifyContent: 'flex-end', padding: 10, position: 'relative' },
  offBadge: { position: 'absolute', top: 10, left: 10, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100 },
  offBadgeText: { fontSize: 9, fontFamily: fonts.bodyMedium, color: '#FFFFFF' },
  offImgBottom: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  offImgLabel: { fontSize: 11, fontFamily: fonts.bodyMedium, color: 'rgba(255,255,255,0.7)' },
  offBody: { padding: 10 },
  offTitle: { fontSize: 12, fontFamily: fonts.bodyMedium, marginBottom: 3 },
  offLoc: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  offLocText: { fontSize: 10, fontFamily: fonts.bodyMedium },
  offPrice: { fontSize: 13, fontFamily: fonts.heading, marginTop: 4 },

  feedSection: { marginHorizontal: 8, borderRadius: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.07, shadowRadius: 22, elevation: 4, overflow: 'hidden' },
  jc: { flexDirection: 'row' },
  jcCatImg: { width: 80, height: 80, borderRadius: 12, margin: 12 },
  jcAcc: { width: 4, flexShrink: 0 },
  jcBody: { padding: 13, paddingLeft: 11, flex: 1 },
  jcTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  jcTitle: { fontSize: 14, fontFamily: fonts.bodyMedium, flex: 1, marginRight: 8 },
  jcPrice: { fontSize: 14, fontFamily: fonts.heading },
  jcTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 6 },
  tag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100 },
  tagText: { fontSize: 10, fontFamily: fonts.bodyMedium },
  jcLoc: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 9 },
  jcLocText: { fontSize: 11, fontFamily: fonts.bodyMedium },
  jcActs: { flexDirection: 'row', gap: 7 },
  applyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.amber, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 11, shadowColor: colors.amber, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  applyText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#111827' },
  saveBtn: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: 11, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },

  emptyFeed: { alignItems: 'center', padding: 40, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: fonts.body },
  emptyBtn: { backgroundColor: colors.amber, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  emptyBtnText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: '#111827' },

  reCard: { minWidth: 210, borderRadius: 16, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4 },
  reImg: { height: 120, position: 'relative', padding: 10 },
  reType: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100, alignSelf: 'flex-start' },
  reTypeText: { fontSize: 9, fontFamily: fonts.bodyMedium, color: '#111827' },
  reSave: { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  reBody: { padding: 10 },
  rePrice: { fontSize: 15, fontFamily: fonts.heading, letterSpacing: -0.3, marginBottom: 2 },
  reTitle: { fontSize: 12, fontFamily: fonts.bodyMedium, marginBottom: 2 },
  reLoc: { fontSize: 10, fontFamily: fonts.bodyMedium },

  postBar: { marginHorizontal: 8, marginTop: 8, borderRadius: 18, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4 },
  postBarTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  postBarText: { fontSize: 12, fontFamily: fonts.bodyMedium },
  postGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  postBtn: { width: '48%', borderRadius: 14, padding: 13, alignItems: 'center', borderWidth: 1.5, position: 'relative', overflow: 'hidden' },
  postBtnMain: { borderColor: '#F59E0B' },
  postIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  postLabel: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#111827', textAlign: 'center' },
  postSub: { fontSize: 9, fontFamily: fonts.bodyMedium, textAlign: 'center', marginTop: 2 },
  newBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: colors.red, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100 },
  newBadgeText: { fontSize: 8, fontFamily: fonts.bodyMedium, color: '#FFFFFF' },
  activeJobsList: { paddingHorizontal: 8, gap: 8, paddingBottom: 4 },
  activeJobCard: { borderRadius: 14, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1, overflow: 'hidden' },
  activeJobCardTouch: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
  activeJobPulse: { width: 6, height: 6, borderRadius: 3 },
  activeJobInfo: { flex: 1 },
  activeJobTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeJobTitle: { fontSize: 13, fontFamily: fonts.bodyMedium, flexShrink: 1 },
  activeJobStatus: { fontSize: 10, fontFamily: fonts.bodyMedium, marginTop: 2 },
  quoteBadge: { backgroundColor: colors.amber, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 100 },
  quoteBadgeText: { fontSize: 9, fontFamily: fonts.bodyMedium, color: '#111827' },
  dateBadge: { backgroundColor: '#6366F1', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 100 },
  dateBadgeText: { fontSize: 9, fontFamily: fonts.bodyMedium, color: '#fff' },
  activeJobBudget: { fontSize: 13, fontFamily: fonts.heading },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  providersGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, gap: 8, paddingBottom: 4 },
  providerCard: { width: '48%', borderRadius: 14, backgroundColor: colors.white, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', position: 'relative' },
  providerCardTouch: { padding: 14, gap: 4 },
  chatBtnWrap: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.amber + '15', justifyContent: 'center', alignItems: 'center' },
  providerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.amberLight, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  providerAvatarText: { fontSize: 16, fontFamily: fonts.heading, color: colors.amberDark },
  providerName: { fontSize: 12, fontFamily: fonts.bodyMedium },
  providerMetaText: { fontSize: 10, fontFamily: fonts.bodyMedium },
  providerRate: { fontSize: 12, fontFamily: fonts.heading, marginTop: 2 },
  providerAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  verifiedBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: colors.white, borderRadius: 7 },
  providerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  entityTag: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  entityTagText: { fontSize: 8, fontFamily: fonts.bodySemiBold },
  providerBadge: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  providerBadgeText: { fontSize: 8, fontFamily: fonts.bodySemiBold, color: '#fff' },
  providerExp: { fontSize: 10, fontFamily: fonts.body, color: colors.muted },
  providerChargeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  providerCats: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  catTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  catTagText: { fontSize: 9, fontFamily: fonts.bodyMedium },
  catMore: { fontSize: 9, fontFamily: fonts.body },
})
