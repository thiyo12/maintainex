import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Animated, ActivityIndicator, RefreshControl, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../../lib/auth'
import { v2Jobs } from '../../../lib/api-v2'
import { matchCategory } from '../../../lib/aiMatch'
import { useTheme } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { spacing, fontSizes } from '../../../lib/tokens'
import JobLifecycleTracker from '../../../components/ui/JobLifecycleTracker'
import { useStagger } from '../../../lib/animations'
import BookingSheet from '../../../components/offers/BookingSheet'
import type { BookingFormData } from '../../../components/offers/BookingSheet'

const CATEGORIES = [
  { id: 'all', icon: 'grid-outline', label: 'All' },
  { id: 'cleaning', icon: 'sparkles-outline', label: 'Cleaning' },
  { id: 'electrical', icon: 'flash-outline', label: 'Electrical' },
  { id: 'plumbing', icon: 'water-outline', label: 'Plumbing' },
  { id: 'ac', icon: 'snow-outline', label: 'AC' },
  { id: 'painting', icon: 'color-palette-outline', label: 'Painting' },
  { id: 'digital', icon: 'laptop-outline', label: 'Digital' },
]

const HOT_OFFERS = [
  { id: 'h1', gradient: ['#0F172A', '#1E3A5F'], badge: 'Hot deal', badgeColor: '#EF4444', icon: 'sparkles', label: 'Deep Clean Special', title: 'Full House Cleaning', loc: 'Colombo 5', distance: '1.2km', price: 'From LKR 2,500' },
  { id: 'h2', gradient: ['#1a1a0a', '#3D2B00'], badge: 'New', badgeColor: '#F59E0B', icon: 'flash', label: 'Same-day Electric', title: 'Electrical Repairs', loc: 'Nugegoda', distance: '3.4km', price: 'From LKR 1,800' },
  { id: 'h3', gradient: ['#0a1a0a', '#1a3a1a'], badge: 'Featured', badgeColor: '#6366F1', icon: 'laptop', label: 'Web Design Pro', title: 'Website in 5 Days', loc: 'Remote', distance: 'Worldwide', price: 'From LKR 15,000' },
]

export default function CustomerHome() {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { user } = useAuth()
  const [myJobs, setMyJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedCat, setSelectedCat] = useState('all')
  const [aiQuery, setAiQuery] = useState('')
  const [aiMatchResult, setAiMatchResult] = useState<ReturnType<typeof matchCategory>>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const glowAnim = useRef(new Animated.Value(0)).current
  const [staggerKey, setStaggerKey] = useState(0)
  const [selectedOffer, setSelectedOffer] = useState<typeof HOT_OFFERS[0] | null>(null)
  const [bookingVisible, setBookingVisible] = useState(false)

  const totalCards = useMemo(() => HOT_OFFERS.length + (myJobs?.length || 0) + 3, [myJobs])
  const cardStagger = useStagger(totalCards, 100, 60, staggerKey)

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start()
    loadJobs()
  }, [])

  const loadJobs = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      const params = selectedCat !== 'all' ? `category=${selectedCat}` : ''
      const res = await v2Jobs.list(params)
      setMyJobs((res.jobs || []).slice(0, 10))
    } catch (e) {
      console.error('Load jobs error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
      setStaggerKey(k => k + 1)
    }
  }, [selectedCat])

  useEffect(() => { loadJobs() }, [loadJobs])

  const handleAiChange = useCallback((text: string) => {
    setAiQuery(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const result = matchCategory(text)
      setAiMatchResult(result)
      if (result) {
        const cat = CATEGORIES.find(c => result.categoryName.toLowerCase().includes(c.id) || c.id === result.categoryName.toLowerCase())
        if (cat) setSelectedCat(cat.id)
      }
    }, 400)
  }, [])

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.6] })
  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.08] })
  const borderGlow = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [colors.amber + '40', colors.amber] })

  const handleApply = (job: any) => {
    router.push(`/(customer)/jobs/v2/${job.id}`)
  }

  const handleSave = (job: any) => {
    Alert.alert('Saved', `${job.title || 'Job'} bookmarked`)
  }

  const handleOfferPress = (offer: typeof HOT_OFFERS[0]) => {
    setSelectedOffer(offer)
    setBookingVisible(true)
  }

  const handleBookingConfirm = (data: BookingFormData) => {
    setBookingVisible(false)
    setSelectedOffer(null)
    Alert.alert('Booking Confirmed', `Your booking has been placed for ${data.date} at ${data.timeSlot}`)
  }

  const handleBookingClose = () => {
    setBookingVisible(false)
    setSelectedOffer(null)
  }

  const parseOfferPrice = (price: string): number | undefined => {
    const match = price.replace(/,/g, '').match(/(\d+)/)
    return match ? parseInt(match[1], 10) : undefined
  }

  let staggerIdx = 0

  const renderHotOffer = (item: typeof HOT_OFFERS[0], i: number) => {
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
    return (
    <Animated.View key={job.id || `demo-${i}`} style={cardStagger[idx]}>
    <TouchableOpacity
      key={job.id || `demo-${i}`}
      style={[styles.jc, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
      activeOpacity={0.7}
      onPress={() => router.push(`/(customer)/jobs/v2/${job.id}`)}
    >
      <View style={[styles.jcAcc, { backgroundColor: colors.amber }]} />
      <View style={styles.jcBody}>
        <View style={styles.jcTop}>
          <Text style={[styles.jcTitle, { color: colors.ink }]} numberOfLines={1}>{job.title || 'Untitled Job'}</Text>
          <Text style={[styles.jcPrice, { color: colors.amberDark }]}>LKR {job.budgetAmount?.toLocaleString() || '—'}</Text>
        </View>
        {(job.categoryName || job.urgency) && (
          <View style={styles.jcTags}>
            {job.categoryName && <View style={[styles.tag, { backgroundColor: colors.amberBg }]}><Text style={[styles.tagText, { color: colors.amberDark }]}>{job.categoryName}</Text></View>}
            {job.urgency && <View style={[styles.tag, { backgroundColor: colors.amberBg }]}><Text style={[styles.tagText, { color: colors.amberDark }]}>{job.urgency}</Text></View>}
            {job.status && <View style={[styles.tag, { backgroundColor: colors.successBg }]}><Text style={[styles.tagText, { color: colors.success }]}>{job.status.replace(/_/g, ' ')}</Text></View>}
          </View>
        )}
        <View style={styles.jcLoc}>
          <Ionicons name={job.isRemote ? 'globe-outline' : 'location-outline'} size={12} color={colors.muted} />
          <Text style={[styles.jcLocText, { color: colors.muted }]}>
            {job.isRemote ? 'Remote' : (job.locationName || 'No location')}
            {job.distance ? ` · ${job.distance}` : ''}
          </Text>
        </View>
        <View style={styles.jcActs}>
          <TouchableOpacity style={styles.applyBtn} onPress={() => handleApply(job)}>
            <Ionicons name="send-outline" size={12} color="#111827" />
            <Text style={styles.applyText}>{job.isRemote ? 'Send Quote' : 'Apply Now'}</Text>
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
              <Text style={[styles.hdrName, { color: colors.ink }]}>{user?.name || 'User'}</Text>
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
              placeholder="Search in English, தமிழ், සිංහල…"
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
                Did you mean <Text style={{ fontFamily: fonts.heading }}>{aiMatchResult.categoryName}</Text>?
              </Text>
            </View>
          )}
        </View>

        {/* ─── Category Pills ─── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
          {CATEGORIES.map(cat => (
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

        {/* ─── Hot Offers ─── */}
        <View style={styles.secRow}>
          <View style={styles.secTitleRow}>
            <Ionicons name="flame-outline" size={16} color={colors.amberDark} />
            <Text style={[styles.secTitle, { color: colors.ink }]}>Hot Offers Near You</Text>
          </View>
          <TouchableOpacity style={styles.secMore} onPress={() => { setSelectedCat('all'); loadJobs() }}>
            <Text style={[styles.secMoreText, { color: colors.amberDark }]}>See all</Text>
            <Ionicons name="chevron-forward" size={12} color={colors.amberDark} />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizScroll}>
          {HOT_OFFERS.map(renderHotOffer)}
        </ScrollView>

        {/* ─── Jobs Near You ─── */}
        <View style={styles.secRow}>
          <View style={styles.secTitleRow}>
            <Ionicons name="list-outline" size={16} color={colors.amberDark} />
            <Text style={[styles.secTitle, { color: colors.ink }]}>
              {selectedCat === 'all' ? 'Jobs Near You' : `${CATEGORIES.find(c => c.id === selectedCat)?.label || 'Jobs'}`}
            </Text>
          </View>
          <TouchableOpacity style={styles.secMore} onPress={() => router.push('/(customer)/jobs/v2')}>
            <Text style={[styles.secMoreText, { color: colors.amberDark }]}>See all</Text>
            <Ionicons name="chevron-forward" size={12} color={colors.amberDark} />
          </TouchableOpacity>
        </View>
        <View style={[styles.feedSection, { backgroundColor: colors.white }]}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.amber} style={{ padding: 40 }} />
          ) : myJobs.length === 0 ? (
            <View style={styles.emptyFeed}>
              <Ionicons name="search-outline" size={36} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>No jobs found</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/post-job')}>
                <Text style={styles.emptyBtnText}>Post a Job</Text>
              </TouchableOpacity>
            </View>
          ) : (
            myJobs.map(renderJobCard)
          )}
        </View>

        {/* ─── Active Jobs ─── */}
        {myJobs.filter((j: any) => j.status !== 'OPEN' && j.status !== 'COMPLETED' && j.status !== 'CANCELLED').length > 0 && (
          <View style={{ paddingHorizontal: 8, marginTop: 12 }}>
            <View style={styles.secRow}>
              <View style={styles.secTitleRow}>
                <Ionicons name="briefcase-outline" size={16} color={colors.amberDark} />
                <Text style={[styles.secTitle, { color: colors.ink }]}>Active Jobs</Text>
              </View>
              <TouchableOpacity style={styles.secMore} onPress={() => router.push('/(customer)/jobs/v2')}>
                <Text style={[styles.secMoreText, { color: colors.amberDark }]}>See all</Text>
                <Ionicons name="chevron-forward" size={12} color={colors.amberDark} />
              </TouchableOpacity>
            </View>
            {myJobs.filter((j: any) => j.status !== 'OPEN' && j.status !== 'COMPLETED' && j.status !== 'CANCELLED').slice(0, 3).map((job: any) => (
              <TouchableOpacity
                key={job.id}
                style={[styles.activeJobCard, { backgroundColor: colors.white }]}
                onPress={() => router.push(`/(customer)/jobs/v2/${job.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.activeJobTop}>
                  <Text style={[styles.activeJobTitle, { color: colors.ink }]}>{job.title}</Text>
                  <Text style={[styles.activeBudget, { color: colors.amberDark }]}>LKR {job.budgetAmount}</Text>
                </View>
                <JobLifecycleTracker status={job.status} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ─── Real Estate ─── */}
        <View style={styles.secRow}>
          <View style={styles.secTitleRow}>
            <Ionicons name="business-outline" size={16} color={colors.amberDark} />
            <Text style={[styles.secTitle, { color: colors.ink }]}>Real Estate</Text>
          </View>
          <TouchableOpacity style={styles.secMore} onPress={() => router.push('/real-estate')}>
            <Text style={[styles.secMoreText, { color: colors.amberDark }]}>See all</Text>
            <Ionicons name="chevron-forward" size={12} color={colors.amberDark} />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizScroll}>
          {[
            { id: 'r1', title: 'Modern 3BR House', price: 'LKR 24.5M', loc: 'Nugegoda, Colombo', type: 'For Sale', typeColor: '#F59E0B', gradient: ['#0F172A', '#1e3a5f'] },
            { id: 'r2', title: '2BR Luxury Apartment', price: 'LKR 85,000/mo', loc: 'Colombo 3', type: 'For Rent', typeColor: '#6366F1', gradient: ['#1a0a0a', '#5F1010'] },
            { id: 'r3', title: 'Office Space 2500sqft', price: 'LKR 180,000/mo', loc: 'Colombo 7', type: 'Commercial', typeColor: '#10B981', gradient: ['#0a0a1a', '#1a1a5F'] },
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
            <Text style={[styles.postBarText, { color: colors.ink }]}>What would you like to post?</Text>
          </View>
          <View style={styles.postGrid}>
            <TouchableOpacity style={[styles.postBtn, styles.postBtnMain, { backgroundColor: colors.amber }]} onPress={() => router.push('/post-job')}>
              <View style={[styles.postIcon, { backgroundColor: 'rgba(0,0,0,0.15)' }]}>
                <Ionicons name="briefcase-outline" size={18} color="#111827" />
              </View>
              <Text style={styles.postLabel}>Post a Job</Text>
              <Text style={styles.postSub}>Get quotes from taskers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.postBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/real-estate')}>
              <View style={[styles.postIcon, { backgroundColor: colors.amberBg }]}>
                <Ionicons name="business-outline" size={18} color={colors.amberDark} />
              </View>
              <Text style={[styles.postLabel, { color: colors.ink }]}>List Property</Text>
              <Text style={[styles.postSub, { color: colors.muted }]}>Sale, rent or commercial</Text>
              <View style={styles.newBadge}><Text style={styles.newBadgeText}>New</Text></View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.postBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/post-job')}>
              <View style={[styles.postIcon, { backgroundColor: colors.amberBg }]}>
                <Ionicons name="laptop-outline" size={18} color={colors.amberDark} />
              </View>
              <Text style={[styles.postLabel, { color: colors.ink }]}>Digital Service</Text>
              <Text style={[styles.postSub, { color: colors.muted }]}>Web, design & marketing</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.postBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.postIcon, { backgroundColor: colors.amberBg }]}>
                <Ionicons name="pricetag-outline" size={18} color={colors.amberDark} />
              </View>
              <Text style={[styles.postLabel, { color: colors.ink }]}>Sell an Item</Text>
              <Text style={[styles.postSub, { color: colors.muted }]}>Post a classified ad</Text>
              <View style={[styles.newBadge, { backgroundColor: colors.muted }]}><Text style={styles.newBadgeText}>Soon</Text></View>
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
  activeJobCard: { borderRadius: 16, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  activeJobTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  activeJobTitle: { fontSize: 14, fontFamily: fonts.bodyMedium, flex: 1 },
  activeBudget: { fontSize: 14, fontFamily: fonts.heading, marginLeft: 8 },
})
