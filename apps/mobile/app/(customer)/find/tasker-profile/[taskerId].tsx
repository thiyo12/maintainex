import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { CaretLeft, ChatCircleText, Check, DotsThree, SealCheck, Star } from 'phosphor-react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { conversations, taskers, templateJobs } from '../../../../lib/api'
import { v3 } from '../../../../theme/v3/tokens'
import AvatarCircle from '../../../../components/ui/AvatarCircle'
import { buildSampleProfile } from '../../../../lib/sampleTaskers'

const formatPercent = (value: unknown) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `${n > 1 ? n.toFixed(1) : (n * 100).toFixed(1)}%`
}

const money = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? `LKR ${n.toLocaleString()}` : null
}

export default function ProviderProfile() {
  const router = useRouter()
  const { taskerId, jobId } = useLocalSearchParams<{ taskerId: string; jobId?: string }>()
  const [tasker, setTasker] = useState<any>(null)
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [startingChat, setStartingChat] = useState(false)

  const load = useCallback(async () => {
    if (!taskerId) return
    setLoading(true)
    setError(false)
    try {
      if (__DEV__ && taskerId.startsWith('sample-tasker-')) {
        const service = jobId ? await templateJobs.get(jobId).catch(() => null) : null
        setTasker(buildSampleProfile(taskerId, service?.name || jobId))
        setJob(service)
        return
      }
      const [provider, service] = await Promise.all([
        taskers.get(taskerId),
        jobId ? templateJobs.get(jobId).catch(() => null) : Promise.resolve(null),
      ])
      setTasker(provider)
      setJob(service)
    } catch (e) {
      console.error('Failed to load provider profile', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [taskerId, jobId])

  useEffect(() => { load() }, [load])

  const name = tasker?.user?.name || tasker?.name || tasker?.companyName || 'Professional'
  const specialty = tasker?.skills?.[0] || tasker?.specialty || tasker?.category || 'MaintainEX professional'
  const reviews = Array.isArray(tasker?.reviews) ? tasker.reviews : []
  const featuredReview = reviews[0]
  const rating = Number(tasker?.rating || 0)
  const jobs = Number(tasker?.completedJobs || tasker?.jobsCompleted || 0)

  const price = useMemo(() => {
    const providerPrice = Number(tasker?.startingPrice || tasker?.hourlyRate || 0)
    if (providerPrice > 0) return money(providerPrice)
    const min = Number(job?.priceMin || 0)
    const max = Number(job?.priceMax || 0)
    if (min > 0 && max > 0) return money(Math.round((min + max) / 2))
    return 'Quote required'
  }, [tasker, job])

  const message = async (quoteRequest = false) => {
    const participantId = tasker?.userId || tasker?.user?.id
    if (!participantId) {
      Alert.alert('Unable to message', 'This provider does not have a messaging profile yet.')
      return
    }
    setStartingChat(true)
    try {
      const text = quoteRequest
        ? `Hi ${name}, I would like a quote${job?.name ? ` for ${job.name}` : ''}.`
        : `Hi ${name}, I’m interested in your services.`
      const conversation = await conversations.create({ participantId, initialMessage: text })
      if (!conversation?.id) throw new Error('Conversation could not be created')
      if (conversation.existing) await conversations.sendMessage(conversation.id, text).catch(() => {})
      router.push(`/(chat)/${conversation.id}` as any)
    } catch (e: any) {
      Alert.alert('Unable to start chat', e?.message || 'Please try again.')
    } finally {
      setStartingChat(false)
    }
  }

  const book = () => {
    if (!jobId) {
      Alert.alert('Choose a service first', 'Select a service before starting a protected booking.')
      return
    }
    router.push({ pathname: '/(customer)/find/booking/[jobId]', params: { jobId, taskerId } } as any)
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingWrap}><ActivityIndicator color={v3.colors.ink} /></View>
      </SafeAreaView>
    )
  }

  if (error || !tasker) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}><CaretLeft size={20} color={v3.colors.ink} weight="bold" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Professional profile</Text>
          <View style={styles.headerButtonRight} />
        </View>
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Profile unavailable</Text>
          <Text style={styles.errorBody}>We couldn’t load this professional right now.</Text>
          <TouchableOpacity style={styles.retry} onPress={load}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()} hitSlop={10}><CaretLeft size={20} color={v3.colors.ink} weight="bold" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Professional profile</Text>
        <View style={styles.headerButtonRight}><DotsThree size={17} color={v3.colors.ink} weight="bold" /></View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHero}>
          <AvatarCircle uri={tasker.profileImage || tasker.avatarUrl || tasker.user?.profileImage} name={name} size={76} showOnline={!!tasker.isOnline} showVerified verified={!!tasker.isVerified} />
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.specialty}>{specialty}</Text>
          <View style={styles.ratingRow}>
            <Star size={16} color={v3.colors.amber} weight="fill" />
            <Text style={styles.ratingText}>{rating > 0 ? rating.toFixed(1) : 'New'} · {jobs} completed</Text>
          </View>
          <View style={styles.badges}>
            {rating >= 4.8 ? <View style={styles.darkBadge}><Text style={styles.darkBadgeText}>TOP TASKER</Text></View> : null}
            {tasker.isVerified ? <View style={styles.lightBadge}><SealCheck size={11} color={v3.colors.success} weight="fill" /><Text style={styles.lightBadgeText}>VERIFIED</Text></View> : null}
            {tasker.onTimeRate != null ? <View style={styles.lightBadge}><Text style={styles.lightBadgeText}>ON-TIME {Math.round(Number(tasker.onTimeRate) > 1 ? Number(tasker.onTimeRate) : Number(tasker.onTimeRate) * 100)}%</Text></View> : null}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Trust snapshot</Text>
        <View style={styles.trustCard}>
          <View style={styles.trustCell}><Text style={styles.trustLabel}>Response</Text><Text style={styles.trustValue}>{tasker.avgResponseMin != null ? `${tasker.avgResponseMin} min` : '—'}</Text></View>
          <View style={styles.trustCell}><Text style={styles.trustLabel}>Cancellation</Text><Text style={styles.trustValue}>{formatPercent(tasker.cancellationRate)}</Text></View>
          <View style={styles.trustCell}><Text style={styles.trustLabel}>Repeat clients</Text><Text style={styles.trustValue}>{formatPercent(tasker.repeatClientRate)}</Text></View>
          <View style={styles.trustCell}><Text style={styles.trustLabel}>Identity</Text><Text style={styles.trustValue}>{tasker.isVerified || tasker.identityStatus === 'VERIFIED' ? 'Verified' : tasker.identityStatus || 'Pending'}</Text></View>
        </View>

        <Text style={styles.sectionTitle}>Recent customer feedback</Text>
        <View style={styles.feedbackCard}>
          {featuredReview ? (
            <>
              <Text style={styles.stars}>{'★'.repeat(Math.max(1, Math.min(5, Number(featuredReview.rating || 5))))}</Text>
              <Text style={styles.feedbackText}>“{featuredReview.comment || 'Completed the job professionally.'}”</Text>
              <Text style={styles.feedbackMeta}>{featuredReview.serviceName || job?.name || specialty}{featuredReview.createdAt ? ` · ${new Date(featuredReview.createdAt).toLocaleDateString()}` : ''}</Text>
            </>
          ) : (
            <>
              <Text style={styles.feedbackText}>No written feedback yet.</Text>
              <Text style={styles.feedbackMeta}>{jobs} completed jobs on MaintainEX</Text>
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>Quote</Text>
        <View style={styles.quoteCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.quoteService} numberOfLines={1}>{job?.name || 'Selected service'}</Text>
            <Text style={styles.quotePrice}>{price}</Text>
          </View>
          <Text style={styles.arrival}>{tasker.distanceMinutes ? `Arrival ${tasker.distanceMinutes} min` : tasker.isOnline ? 'Available now' : 'Request availability'}</Text>
        </View>

        <TouchableOpacity style={styles.messageRow} onPress={() => message(false)} disabled={startingChat} activeOpacity={0.72}>
          <ChatCircleText size={17} color={v3.colors.ink} />
          <Text style={styles.messageText}>{startingChat ? 'Opening chat…' : 'Message professional'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.requestQuoteRow} onPress={() => message(true)} disabled={startingChat} activeOpacity={0.72}>
          <Text style={styles.requestQuoteText}>Request a detailed quote</Text>
        </TouchableOpacity>

        <View style={{ height: 108 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.primaryButton} onPress={book} activeOpacity={0.82}>
          <Text style={styles.primaryButtonText}>{jobId ? 'Book this tasker' : 'Choose a service first'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  header: { height: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 36, height: 36, alignItems: 'flex-start', justifyContent: 'center' },
  headerButtonRight: { width: 36, height: 36, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, marginHorizontal: 8, fontSize: 18, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  scroll: { paddingHorizontal: 18, paddingBottom: 8 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  errorTitle: { fontSize: 18, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  errorBody: { marginTop: 6, fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary, textAlign: 'center' },
  retry: { marginTop: 16, height: 42, paddingHorizontal: 20, borderRadius: 14, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontSize: 10.5, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.paper },

  profileHero: { alignItems: 'center', paddingTop: 8 },
  name: { marginTop: 9, fontSize: 21, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  specialty: { marginTop: 3, fontSize: 10.5, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  ratingRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  ratingText: { fontSize: 10, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  badges: { marginTop: 10, flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  darkBadge: { minHeight: 25, paddingHorizontal: 10, borderRadius: 13, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  darkBadgeText: { fontSize: 8.5, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.paper },
  lightBadge: { minHeight: 25, paddingHorizontal: 10, borderRadius: 13, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  lightBadgeText: { fontSize: 8.5, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },

  sectionTitle: { marginTop: 24, marginBottom: 9, fontSize: 14.5, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  trustCard: { borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden' },
  trustCell: { width: '50%', minHeight: 60, paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderRightWidth: 1, borderColor: v3.colors.line },
  trustLabel: { fontSize: 8.7, fontFamily: 'Outfit_700Bold', color: v3.colors.textSecondary },
  trustValue: { marginTop: 5, fontSize: 12, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  feedbackCard: { borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, padding: 14 },
  stars: { fontSize: 12, color: v3.colors.amber, letterSpacing: 1 },
  feedbackText: { marginTop: 7, fontSize: 9.5, lineHeight: 15, fontFamily: 'Outfit_600SemiBold', color: v3.colors.ink },
  feedbackMeta: { marginTop: 8, fontSize: 8.5, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  quoteCard: { minHeight: 82, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  quoteService: { fontSize: 10, fontFamily: 'Outfit_700Bold', color: v3.colors.ink },
  quotePrice: { marginTop: 8, fontSize: 18, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  arrival: { maxWidth: 100, fontSize: 9.5, fontFamily: 'Outfit_700Bold', color: v3.colors.textSecondary, textAlign: 'right' },
  messageRow: { marginTop: 10, minHeight: 48, borderRadius: 15, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  messageText: { fontSize: 10.5, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  requestQuoteRow: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  requestQuoteText: { fontSize: 9.8, fontFamily: 'Outfit_700Bold', color: v3.colors.textSecondary, textDecorationLine: 'underline' },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 24, backgroundColor: v3.colors.paper, borderTopWidth: 1, borderTopColor: v3.colors.line },
  primaryButton: { height: 54, borderRadius: 17, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 13.5, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.paper },
})
