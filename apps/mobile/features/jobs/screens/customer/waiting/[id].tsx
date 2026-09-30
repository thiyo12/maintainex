import { Component, useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Animated, FlatList,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Hourglass, UsersThree, ChatCircleDots, MapPin, Wallet, CheckCircle, ArrowRight, CaretLeft, Sparkle, Star, WarningCircle } from 'phosphor-react-native'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { getAuthToken } from '@/api/token'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'

interface QuoteItem {
  id: string
  providerId: string
  providerType: string
  price: number
  estimatedCompletionTime: string
  message?: string
  status: string
  createdAt: string
  provider: { id: string; name: string; phone: string | null } | null
  providerRating: number
  completedJobs: number
}

interface JobData {
  id: string
  title: string
  status: string
  budgetAmount: number | null
  notifiedCount: number
  smartBooking: any
  quotes: QuoteItem[]
  locationName?: string | null
  createdAt?: string | null
  responseState?: string | null
  responseDeadline?: string | null
  escalatedAt?: string | null
}

function useSlideIn(delay = 0) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 6, tension: 80, delay, useNativeDriver: true }).start()
  }, [])
  return anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] })
}

export default function WaitingScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const params = useLocalSearchParams<{ id: string }>()
  const jobId = params.id
  const slideAnim = useSlideIn()

  const [loading, setLoading] = useState(true)
  const [job, setJob] = useState<JobData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pulse] = useState(new Animated.Value(0))
  const [spin] = useState(new Animated.Value(0))

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start()
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 2600, useNativeDriver: true })
    ).start()
  }, [])

  const fetchJob = async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true)
    try {
      const token = await getAuthToken()
      const headers: any = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`${API_URL}/api/mobile/v2/jobs/${jobId}`, { headers })
      if (!res.ok) { setError('Could not load your job.'); return }
      const data = await res.json()
      const j = data.job
      setJob({
        id: j.id,
        title: j.title,
        status: j.status,
        budgetAmount: j.budgetAmount != null ? Number(j.budgetAmount) : null,
        notifiedCount: j.notifiedCount || 0,
        smartBooking: j.smartBooking,
        quotes: j.quotes || [],
        locationName: j.locationName,
        createdAt: j.createdAt || null,
        responseState: j.responseState || null,
        responseDeadline: j.responseDeadline || null,
        escalatedAt: j.escalatedAt || null,
      })
      if (j.status !== 'OPEN') {
        // Job progressed (accepted/completed) — stop polling, let user act
      }
    } catch {
      setError('Network error while checking your job.')
    } finally {
      if (showSpinner) setLoading(false)
    }
  }

  useEffect(() => {
    fetchJob(true)
    const interval = setInterval(() => fetchJob(false), 4000)
    return () => clearInterval(interval)
  }, [jobId])

  const quoteCount = job?.quotes?.length || 0
  const progressed = job && job.status !== 'OPEN'
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const remainingMs = job?.responseDeadline ? new Date(job.responseDeadline).getTime() - now : 0
  const remainingMins = Math.max(0, Math.ceil(remainingMs / 60000))
  const countdown = remainingMins > 0
    ? `${Math.floor(remainingMins / 60)}h ${remainingMins % 60}m`
    : '0h 0m'
  const escalated = job?.responseState === 'escalated'
  const elapsedMinutes = job?.createdAt ? Math.max(0, Math.floor((now - new Date(job.createdAt).getTime()) / 60000)) : 0
  const needsEscalation = !progressed && quoteCount === 0 && elapsedMinutes >= 20

  if (error && loading === false && !job) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={[styles.emptyText, { color: colors.muted }]}>{error}</Text>
          <TouchableOpacity style={[styles.primaryBtn, { marginTop: 20 }]} onPress={() => { setError(null); fetchJob(true) }}>
            <Text style={styles.primaryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  if (loading && !job) {
    return <SafeAreaView style={styles.container}><ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} /></SafeAreaView>
  }

  if (!job) {
    return <SafeAreaView style={styles.container}><ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} /></SafeAreaView>
  }

  const rotation = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] })

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <CaretLeft size={20} color={colors.ink} weight="bold" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Finding your tasker</Text>
        <View style={styles.backBtn} />
      </View>

      <Animated.ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} style={{ transform: [{ translateY: slideAnim }] }}>
        <View style={styles.statusArea}>
          <View style={styles.radarWrap}>
            <View style={[styles.radarRing, { borderColor: colors.amber }]} />
            <View style={[styles.radarRing2, { borderColor: colors.amber }]} />
            <Animated.View style={[styles.radarCore, { backgroundColor: colors.amber, opacity: pulseOpacity }]}>
              <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                <Hourglass size={40} color="#111827" weight="bold" />
              </Animated.View>
            </Animated.View>
          </View>

          {progressed ? (
            <>
              <Text style={[styles.statusTitle, { color: colors.ink }]}>Your job is progressing</Text>
              <Text style={[styles.statusSub, { color: colors.muted }]}>A tasker has been matched for your job.</Text>
            </>
          ) : (
            <>
              <Text style={[styles.statusTitle, { color: colors.ink }]}>Notifying taskers…</Text>
              <Text style={[styles.statusSub, { color: colors.muted }]}>
                Notifying {job?.notifiedCount ?? 0} taskers in your area
              </Text>
            </>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.white, borderColor: colors.border }]}>
            <UsersThree size={22} color={colors.amberDark} weight="fill" />
            <Text style={[styles.statValue, { color: colors.ink }]}>{job?.notifiedCount ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Taskers notified</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.white, borderColor: colors.border }]}>
            <ChatCircleDots size={22} color={colors.amberDark} weight="fill" />
            <Text style={[styles.statValue, { color: colors.ink }]}>{quoteCount}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Quotes received</Text>
          </View>
        </View>

        <View style={[styles.supportInfo, { backgroundColor: colors.white, borderColor: colors.border }]}>
          <Hourglass size={16} color={colors.amber} weight="fill" />
          <Text style={[styles.supportText, { color: colors.muted }]}>
            {escalated
              ? 'This job has been escalated to our support team for a personal tasker match.'
              : `If no tasker responds, this job is auto-escalated to support in ${countdown}.`}
          </Text>
        </View>
        {(needsEscalation || escalated) && (
          <View style={[styles.escalationCard, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
            <WarningCircle size={16} color="#DC2626" />
            <Text style={[styles.escalationText, { color: '#991B1B' }]}>
              {escalated
                ? 'Our support team has been notified and will personally match you with a tasker.'
                : 'We\'ve noticed no tasker has responded yet — support has been notified to help you.'}
            </Text>
          </View>
        )}

        <Text style={[styles.sectionLabel, { color: colors.ink }]}>Incoming quotes</Text>
        {quoteCount === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.white, borderColor: colors.border }]}>
            <Sparkle size={22} color={colors.amberDark} weight="fill" />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              No quotes yet. Taskers are reviewing your job — quotes will appear here automatically.
            </Text>
          </View>
        ) : (
          <>
            {job.quotes.map((q) => (
              <TouchableOpacity key={q.id} style={[styles.quoteCard, { backgroundColor: colors.white, borderColor: colors.border }]}
                onPress={() => router.push(`/(customer)/jobs/v2/quotes/${job.id}?highlight=${q.id}`)}>
                <View style={styles.quoteTop}>
                  <View style={styles.quoteAvatar}>
                    <Text style={[styles.quoteAvatarText, { color: colors.amberDark }]}>
                      {q.provider?.name?.charAt(0)?.toUpperCase() || 'T'}
                    </Text>
                  </View>
                  <View style={styles.quoteInfo}>
                    <Text style={[styles.quoteName, { color: colors.ink }]}>{q.provider?.name || 'Tasker'}</Text>
                    <View style={styles.quoteMeta}>
                      {q.providerRating > 0 && (
                        <View style={styles.metaItem}>
                          <Star size={12} color={colors.amber} weight="fill" />
                          <Text style={[styles.metaText, { color: colors.muted }]}>{q.providerRating.toFixed(1)}</Text>
                        </View>
                      )}
                      <Text style={[styles.metaText, { color: colors.muted }]}>{q.completedJobs || 0} jobs done</Text>
                    </View>
                  </View>
                  <View style={styles.quotePriceWrap}>
                    <Text style={[styles.quotePrice, { color: colors.amberDark }]}>Rs {q.price.toLocaleString()}</Text>
                  </View>
                </View>
                {q.estimatedCompletionTime ? (
                  <Text style={[styles.quoteTime, { color: colors.muted }]}>Est. completion: {q.estimatedCompletionTime}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
            <Text style={[styles.hint, { color: colors.muted }]}>Tap a quote to review it.</Text>
          </>
        )}

        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.summaryRow}>
            <MapPin size={18} color={colors.amberDark} weight="fill" />
            <Text style={[styles.summaryText, { color: colors.ink }]}>{job?.smartBooking?.locationText || job?.locationName || 'Location not set'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Wallet size={18} color={colors.amberDark} weight="fill" />
            <Text style={[styles.summaryText, { color: colors.ink }]}>
              Budget range: {job?.smartBooking?.estimatedPriceMin != null
                ? `${job.smartBooking.estimatedPriceMin.toLocaleString()} – ${job.smartBooking.estimatedPriceMax?.toLocaleString() ?? ''}`
                : `Rs ${job?.budgetAmount?.toLocaleString() ?? ''}`}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.amber }]}
            onPress={() => router.push(`/(customer)/jobs/v2/quotes/${job.id}`)}>
            <ArrowRight size={18} color="#111827" weight="bold" />
            <Text style={styles.primaryBtnTextDark}>{quoteCount > 0 ? `Review ${quoteCount} quote${quoteCount > 1 ? 's' : ''}` : 'Go to quotes'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]}
            onPress={() => router.replace('/(customer)/(tabs)/activity')}>
            <Text style={[styles.secondaryBtnText, { color: colors.ink }]}>View my jobs</Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { width: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: fonts.headingBold },
  scroll: { padding: 20, paddingBottom: 40 },

  statusArea: { alignItems: 'center', paddingVertical: 16 },
  radarWrap: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  radarRing: { position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 1.5, opacity: 0.4 },
  radarRing2: { position: 'absolute', width: 112, height: 112, borderRadius: 56, borderWidth: 1.5, opacity: 0.3 },
  radarCore: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontSize: 20, fontFamily: fonts.heading, textAlign: 'center', marginBottom: 6 },
  statusSub: { fontSize: 14, fontFamily: fonts.body, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },

  statsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  statCard: { flex: 1, borderRadius: 20, padding: 18, borderWidth: 1.5, alignItems: 'center' },
  statValue: { fontSize: 26, fontFamily: fonts.heading, marginVertical: 4 },
  statLabel: { fontSize: 12, fontFamily: fonts.bodyMedium, textAlign: 'center' },

  supportInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 14, borderWidth: 1, marginTop: 14 },
  supportText: { fontSize: 12, fontFamily: fonts.body, flex: 1, lineHeight: 17 },
  escalationCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, padding: 14, borderWidth: 1, marginTop: 10 },
  escalationText: { fontSize: 13, fontFamily: fonts.bodyMedium, lineHeight: 19, flex: 1 },

  sectionLabel: { fontSize: 15, fontFamily: fonts.heading, marginTop: 22, marginBottom: 10 },
  emptyCard: { borderRadius: 18, padding: 20, borderWidth: 1.5, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 13, fontFamily: fonts.body, textAlign: 'center', lineHeight: 19 },

  quoteCard: { borderRadius: 18, padding: 16, borderWidth: 1.5, marginBottom: 10 },
  quoteTop: { flexDirection: 'row', alignItems: 'center' },
  quoteAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.amberBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  quoteAvatarText: { fontSize: 18, fontFamily: fonts.headingBold },
  quoteInfo: { flex: 1 },
  quoteName: { fontSize: 15, fontFamily: fonts.bodySemiBold, marginBottom: 3 },
  quoteMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  metaText: { fontSize: 12, fontFamily: fonts.body },
  quotePriceWrap: { marginLeft: 8 },
  quotePrice: { fontSize: 15, fontFamily: fonts.heading },
  quoteTime: { fontSize: 12, fontFamily: fonts.body, marginTop: 8 },

  hint: { fontSize: 12, fontFamily: fonts.body, textAlign: 'center', marginTop: 4 },

  summaryCard: { borderRadius: 16, padding: 14, borderWidth: 1.5, marginTop: 18, gap: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryText: { fontSize: 13, fontFamily: fonts.bodyMedium, flex: 1 },

  actions: { marginTop: 20, gap: 10 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 100 },
  primaryBtnTextDark: { fontSize: 16, fontFamily: fonts.bodySemiBold, color: '#111827' },
  primaryBtnText: { fontSize: 16, fontFamily: fonts.bodySemiBold, color: '#fff' },
  secondaryBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 100, borderWidth: 1.5 },
  secondaryBtnText: { fontSize: 15, fontFamily: fonts.bodySemiBold },
})
