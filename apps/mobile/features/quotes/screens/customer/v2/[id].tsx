import { useEffect, useMemo, useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Timer, Star, CheckCircle, User, XCircle, Wrench, ChatCircleDots } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'

import { v2Jobs, v2JobActions, v2Match } from '@/api/v2-jobs'
import { V2Job } from '@/api/v2-types'
import { V2Quote } from '@/api/v2-types'
import { conversations } from '@/api/messaging'
import { translateJobStatus } from '@/lib/i18n'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { CATEGORY_VISUALS, categoryIcon } from '@/lib/categoryVisuals'

import AvatarCircle from '@/components/ui/AvatarCircle'
import PressableScale from '@/components/ui/PressableScale'
import EmptyState from '@/components/ui/EmptyState'
import AnimatedEntry from '@/components/ui/AnimatedEntry'
import Skeleton from '@/components/ui/Skeleton'

const VALIDITY_MS = 2 * 60 * 60 * 1000

type SortKey = 'recommended' | 'lowest' | 'fastest'

function useCountdown(target: number | null) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!target) return
    const iv = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(iv)
  }, [target])
  if (!target) return 'LOGOUT'
  const diff = target - now
  if (diff <= 0) return 'EXPIRED'
  const total = Math.floor(diff / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  return `${h}:${m.toString().padStart(2, '0')}`
}

function QuoteCardItem({
  q, bestMatch, loading, onAccept, onMessage, onViewProfile, onDismiss, colors, styles,
}: {
  q: V2Quote; bestMatch: boolean; loading: boolean; onAccept: () => void;
  onMessage: () => void; onViewProfile: () => void; onDismiss: () => void; colors: any; styles: any
}) {
  const { t } = useTranslation()
  const provider = q.provider
  const image = provider?.avatar || provider?.profileImage
  const rating = q.providerRating ?? provider?.rating
  const completed = q.completedJobs ?? provider?.completedJobs ?? 0

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={32}
      overshootRight={false}
      renderRightActions={() => (
        <PressableScale onPress={onDismiss} scaleTo={0.96} style={styles.dismissWrap}>
          <View style={styles.dismissBtn}>
            <XCircle size={22} color="#FFFFFF" weight="fill" />
            <Text style={styles.dismissText}>{t('ui.dismiss')}</Text>
          </View>
        </PressableScale>
      )}
    >
      <AnimatedEntry delay={0}>
        <View style={styles.quoteCard}>
          {bestMatch ? (
            <View style={styles.bestMatchTag}>
              <CheckCircle size={12} color="#000000" weight="fill" />
              <Text style={styles.bestMatchText}>{t('ui.bestMatch')}</Text>
            </View>
          ) : null}

          <View style={styles.providerRow}>
            <AvatarCircle uri={image} name={provider?.name || 'Tasker'} size={56} showOnline={!!provider?.isOnline} showVerified={!!provider?.isVerified} verified={!!provider?.isVerified} />
            <View style={styles.providerInfo}>
              <Text style={styles.providerName} numberOfLines={1}>{provider?.name || t('quotes.provider')}</Text>
              <View style={styles.ratingRow}>
                <Star size={14} color={colors.amber} weight="fill" />
                <Text style={styles.ratingText}>{rating ? rating.toFixed(1) : '—'}</Text>
                {completed > 0 ? <Text style={styles.jobsText}>({completed} jobs)</Text> : null}
              </View>
            </View>
            <View style={styles.priceWrap}>
              <Text style={styles.priceCur}>LKR</Text>
              <Text style={styles.price}>{q.price.toLocaleString()}</Text>
            </View>
          </View>

          {q.message ? <Text style={styles.message} numberOfLines={3}>{q.message}</Text> : null}

          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Timer size={14} color={colors.amber} weight="fill" />
              <Text style={styles.metaText}>{q.estimatedCompletionTime || t('quotes.today')}</Text>
            </View>
            <View style={styles.metaPill}>
              <User size={14} color={colors.amber} weight="fill" />
              <Text style={styles.metaText}>{q.providerType === 'COMPANY' ? t('customer.company') : t('ui.independentPro')}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.messageBtn} onPress={onMessage} activeOpacity={0.7}>
              <ChatCircleDots size={16} color={colors.ink} weight="bold" />
              <Text style={styles.messageBtnText}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileBtn} onPress={onViewProfile} activeOpacity={0.7}>
              <User size={16} color={colors.amber} weight="fill" />
              <Text style={styles.profileBtnText}>Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.acceptBtn, loading && { opacity: 0.6 }]} onPress={onAccept} disabled={loading} activeOpacity={0.7}>
              {loading ? <View style={styles.miniSpinner} /> : null}
              <Text style={styles.acceptBtnText}>{loading ? 'Holding…' : t('quotes.accept')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AnimatedEntry>
    </ReanimatedSwipeable>
  )
}

export default function V2QuotesScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const colors = useColors()
  const styles = makeStyles(colors)
  const { id } = useLocalSearchParams<{ id: string }>()
  const [job, setJob] = useState<V2Job | null>(null)
  const [quotes, setQuotes] = useState<V2Quote[]>([])
  const [topProviderId, setTopProviderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<SortKey>('recommended')

  const loadData = useCallback(async () => {
    try {
      const [jobRes, matchRes] = await Promise.allSettled([v2Jobs.get(id), v2Match.getProviders(id)])
      if (jobRes.status === 'fulfilled') {
        setJob(jobRes.value.job)
        setQuotes(jobRes.value.job.quotes || [])
      } else {
        throw jobRes.reason
      }
      if (matchRes.status === 'fulfilled') {
        const providers = matchRes.value.providers || []
        setTopProviderId(providers[0]?.providerId || providers[0]?.id || null)
      }
    } catch {
      Alert.alert(t('common.error'), t('errors.generic'))
      router.back()
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadData() }, [loadData])
  useFocusEffect(useCallback(() => { loadData() }, [loadData]))

  const liveQuotes = useMemo(() => quotes.filter(q => !dismissed.has(q.id)), [quotes, dismissed])

  const bestQuotes = useMemo(() => {
    if (!topProviderId) {
      const top = liveQuotes.reduce((a, b) => ((b.providerRating ?? 0) > (a.providerRating ?? 0) ? b : a), liveQuotes[0])
      return new Set(top ? [top.id] : [])
    }
    return new Set(liveQuotes.filter(q => q.providerId === topProviderId).map(q => q.id))
  }, [liveQuotes, topProviderId])

  const expiresAt = useMemo(() => {
    if (liveQuotes.length === 0) return null
    const latest = Math.max(...liveQuotes.map(q => new Date(q.createdAt).getTime()))
    return latest + VALIDITY_MS
  }, [liveQuotes])
  const countdown = useCountdown(expiresAt)

  const sorted = useMemo(() => {
    const list = [...liveQuotes]
    switch (sortBy) {
      case 'lowest': return list.sort((a, b) => a.price - b.price)
      case 'fastest': return list.sort((a, b) => (a.estimatedCompletionTime || '').localeCompare(b.estimatedCompletionTime || ''))
      default: return list.sort((a, b) => (b.providerRating ?? 0) - (a.providerRating ?? 0))
    }
  }, [liveQuotes, sortBy])

  const handleMessage = async (quote: V2Quote) => {
    const participantId = (quote.provider as any)?.chatUserId || (
      quote.providerType === 'INDIVIDUAL' ? quote.providerId : null
    )
    if (!participantId) {
      Alert.alert('Messaging unavailable', 'This provider cannot receive messages right now.')
      return
    }

    try {
      const conversation = await conversations.create({
        participantId,
        jobId: id,
        initialMessage: `Hi, I want to discuss your quote of LKR ${quote.price.toLocaleString()} for this job.`,
      })
      router.push(`/(chat)/${conversation.id}` as any)
    } catch (error: any) {
      Alert.alert('Could not start chat', error?.message || 'Please try again.')
    }
  }

  const handleAccept = async (quoteId: string) => {
    setActionLoading(quoteId)
    try {
      await v2JobActions.selectQuote(id, quoteId)
      Alert.alert(t('quotes.acceptSuccess'), t('quotes.acceptSuccessDesc'), [
        { text: t('common.ok'), onPress: () => router.push(`/(customer)/jobs/v2/${id}` as any) },
      ])
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setActionLoading('')
    }
  }

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'recommended', label: 'Recommended' },
    { key: 'lowest', label: 'Lowest price' },
    { key: 'fastest', label: 'Fastest' },
  ]

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <View style={styles.backCircle}>
            <Text style={styles.backChevron}>‹</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{sorted.length} quotes arrived</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.skeletonWrap}>
          <Skeleton width="100%" height={84} radius={20} />
          <Skeleton width="100%" height={150} radius={20} />
          <Skeleton width="100%" height={150} radius={20} />
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          <Text style={styles.listSubtitle}>Compare price, trust and arrival — no hidden details.</Text>

          <View style={styles.sortRow}>
            {sortOptions.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.sortPill, sortBy === opt.key && styles.sortPillActive]}
                onPress={() => setSortBy(opt.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.sortPillText, sortBy === opt.key && styles.sortPillTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {sorted.length === 0 ? (
            <EmptyState
              lottieUrl="https://assets6.lottiefiles.com/packages/lf20_myejiggj.json"
              title={t('quotes.noQuotes')}
              subtitle={t('ui.noQuotesSub')}
              ctaText={t('ui.viewJob')}
              onCta={() => router.push(`/(customer)/jobs/v2/${id}` as any)}
              FallbackIcon={Wrench}
            />
          ) : (
            <>
              {sorted.map((q) => (
                <QuoteCardItem
                  key={q.id}
                  q={q}
                  bestMatch={bestQuotes.has(q.id)}
                  loading={actionLoading === q.id}
                  onAccept={() => handleAccept(q.id)}
                  onMessage={() => handleMessage(q)}
                  onViewProfile={() => q.providerType === 'INDIVIDUAL' && q.providerId
                    ? router.push(`/(customer)/find/tasker-profile/${q.providerId}` as any)
                    : Alert.alert('Company profile', q.provider?.name || 'Verified MaintainEX company')}
                  onDismiss={() => setDismissed(prev => new Set(prev).add(q.id))}
                  colors={colors}
                  styles={styles}
                />
              ))}
              <View style={styles.swipeHint}>
                <Text style={styles.swipeHintText}>{t('ui.dismissNote')}</Text>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: { borderRadius: 9999 },
  backCircle: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  backChevron: { color: colors.ink, fontSize: 26, lineHeight: 28, fontFamily: 'Outfit_500Medium' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: fonts.heading, color: colors.ink },
  headerRight: { width: 42 },

  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 32 },
  listSubtitle: { fontSize: 12, fontFamily: fonts.body, color: colors.muted, marginBottom: 12, lineHeight: 18 },

  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  sortPill: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  sortPillActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  sortPillText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.muted },
  sortPillTextActive: { color: '#FFFFFF' },

  quoteCard: {
    backgroundColor: colors.surface, borderRadius: 20, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  bestMatchTag: {
    position: 'absolute', top: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.amber, paddingHorizontal: 10, paddingVertical: 4,
    borderBottomLeftRadius: 14,
  },
  bestMatchText: { fontSize: 10, fontFamily: fonts.bodyMedium, color: '#000000', letterSpacing: 0.4 },
  providerRow: { flexDirection: 'row', alignItems: 'center' },
  providerInfo: { flex: 1, marginLeft: 12 },
  providerName: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.ink },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  ratingText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.amber },
  jobsText: { fontSize: 12, fontFamily: fonts.body, color: colors.muted },
  priceWrap: { alignItems: 'flex-end' },
  price: { fontSize: 20, fontFamily: fonts.heading, color: colors.ink, letterSpacing: -0.3 },
  priceCur: { fontSize: 11, fontFamily: fonts.body, color: colors.muted },
  message: { fontSize: 13, fontFamily: fonts.body, color: colors.muted, lineHeight: 20, marginTop: 12 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  metaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 9999, backgroundColor: '#2E2E2E',
  },
  metaText: { fontSize: 11, fontFamily: fonts.bodyMedium, color: colors.ink },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  messageBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  messageBtnText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink },
  profileBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: '#2E2E2E',
  },
  profileBtnText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.amber },
  acceptBtn: {
    flex: 1.25, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.amber, paddingVertical: 14, borderRadius: 16,
    shadowColor: colors.amber, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  acceptBtnText: { fontSize: 15, fontFamily: fonts.bodyMedium, color: '#111827' },
  miniSpinner: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#111827', borderTopColor: 'transparent' },

  dismissWrap: { width: 100, borderRadius: 20, marginBottom: 14 },
  dismissBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#E11900', borderRadius: 20, marginLeft: 8,
  },
  dismissText: { fontSize: 11, fontFamily: fonts.bodyMedium, color: '#FFFFFF' },

  swipeHint: { alignItems: 'center', marginTop: 8 },
  swipeHintText: { fontSize: 11, fontFamily: fonts.body, color: '#6B6B6B' },

  skeletonWrap: { padding: 16, gap: 12 },
})
