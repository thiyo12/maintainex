import { useEffect, useMemo, useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Timer, Star, CheckCircle, User, XCircle, MapPin, Wrench } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { ReanimatedSwipeable } from 'react-native-gesture-handler/ReanimatedSwipeable'

import { v2Jobs, v2JobActions, v2Match, V2Job, V2Quote } from '@/lib/api-v2'
import { translateJobStatus } from '@/lib/i18n'
import { colors, spacing, radius, typography, shadows } from '@/lib/design'
import { CATEGORY_VISUALS, categoryIcon } from '@/lib/categoryVisuals'

import AvatarCircle from '@/components/ui/AvatarCircle'
import PressableScale from '@/components/ui/PressableScale'
import EmptyState from '@/components/ui/EmptyState'
import AnimatedEntry from '@/components/ui/AnimatedEntry'
import Skeleton from '@/components/ui/Skeleton'

const VALIDITY_MS = 2 * 60 * 60 * 1000

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
  q, bestMatch, loading, onAccept, onViewProfile, onDismiss,
}: {
  q: V2Quote
  bestMatch: boolean
  loading: boolean
  onAccept: () => void
  onViewProfile: () => void
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  const provider = q.provider
  const image = provider?.avatar || provider?.profileImage
  const rating = q.providerRating ?? provider?.rating
  const completed = q.completedJobs ?? provider?.completedJobs
  const visual = CATEGORY_VISUALS.find(v => v.id === provider?.categories?.[0]) || null

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={32}
      overshootRight={false}
      renderRightActions={() => (
        <PressableScale onPress={onDismiss} scaleTo={0.96} style={styles.dismissWrap}>
          <View style={styles.dismissBtn}>
            <XCircle size={22} color={colors.textPrimary} weight="fill" />
            <Text style={styles.dismissText}>{t('ui.dismiss')}</Text>
          </View>
        </PressableScale>
      )}
    >
      <AnimatedEntry delay={q.completedJobs === undefined ? 0 : 0}>
        <View style={styles.quoteCard}>
          {bestMatch ? (
            <View style={styles.bestMatchTag}>
              <CheckCircle size={14} color={colors.background} weight="fill" />
              <Text style={styles.bestMatchText}>{t('ui.bestMatch')}</Text>
            </View>
          ) : null}

          <View style={styles.providerRow}>
            <AvatarCircle uri={image} name={provider?.name || 'Tasker'} size={56} showOnline={!!provider?.isOnline} showVerified={!!provider?.isVerified} verified={!!provider?.isVerified} />
            <View style={styles.providerInfo}>
              <Text style={styles.providerName} numberOfLines={1}>{provider?.name || t('quotes.provider')}</Text>
              <View style={styles.ratingRow}>
                <Star size={14} color={colors.accent} weight="fill" />
                <Text style={styles.ratingText}>{rating ? rating.toFixed(1) : '—'}</Text>
                {completed > 0 ? <Text style={styles.jobsText}>({completed} jobs)</Text> : null}
              </View>
            </View>
            <Text style={styles.price}>{q.price.toLocaleString()}</Text>
            <Text style={styles.priceCur}>LKR</Text>
          </View>

          {q.message ? <Text style={styles.message} numberOfLines={3}>{q.message}</Text> : null}

          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Timer size={14} color={colors.accent} weight="fill" />
              <Text style={styles.metaText}>{q.estimatedCompletionTime || t('quotes.today')}</Text>
            </View>
            <View style={styles.metaPill}>
              <User size={14} color={colors.accent} weight="fill" />
              <Text style={styles.metaText}>{q.providerType === 'COMPANY' ? t('customer.company') : t('ui.independentPro')}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <PressableScale onPress={onViewProfile} scaleTo={0.97} style={styles.profileBtnPress}>
              <View style={styles.profileBtn}>
                <User size={16} color={colors.accent} weight="fill" />
                <Text style={styles.profileBtnText}>{t('quotes.viewProfile')}</Text>
              </View>
            </PressableScale>
            <PressableScale onPress={onAccept} scaleTo={0.97} style={styles.acceptBtnPress} disabled={loading}>
              <View style={styles.acceptBtn}>
                {loading ? <View style={styles.miniSpinner} /> : null}
                <Text style={styles.acceptBtnText}>{loading ? 'Holding…' : t('quotes.accept')}</Text>
              </View>
            </PressableScale>
          </View>
        </View>
      </AnimatedEntry>
    </ReanimatedSwipeable>
  )
}

export default function V2QuotesScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [job, setJob] = useState<V2Job | null>(null)
  const [quotes, setQuotes] = useState<V2Quote[]>([])
  const [topProviderId, setTopProviderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

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

  const sorted = useMemo(
    () => [...liveQuotes].sort((a, b) => (b.providerRating ?? 0) - (a.providerRating ?? 0)),
    [liveQuotes]
  )

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

  const activeVisual = CATEGORY_VISUALS.find(v => v.id === job?.categoryId) || null

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} scaleTo={0.92} style={styles.backPress}>
          <View style={styles.backBtn}>
            <Text style={styles.backChevron}>‹</Text>
          </View>
        </PressableScale>
        <Text style={styles.headerTitle}>Quotes</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{sorted.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.skeletonWrap}>
          <Skeleton width="100%" height={84} radius={20} />
          <Skeleton width="100%" height={150} radius={20} />
          <Skeleton width="100%" height={150} radius={20} />
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {job && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <View style={styles.summaryIcon}>
                  {activeVisual?.lottie ? null : null}
                  {(() => { const I = categoryIcon(job.categoryId); return <I size={22} color={colors.accent} weight="fill" /> })()}
                </View>
                <View style={styles.summaryInfo}>
                  <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                  {job.locationName ? (
                    <View style={styles.locRow}>
                      <MapPin size={12} color={colors.textSecondary} weight="fill" />
                      <Text style={styles.locText}>{job.locationName}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.budget}>LKR {job.budgetAmount?.toLocaleString() ?? 'Not set'}</Text>
              </View>
              <View style={styles.validityRow}>
                <Timer size={15} color={colors.accent} weight="fill" />
                <Text style={styles.validityText}>
                  {countdown === 'EXPIRED'
                    ? t('ui.expired')
                    : countdown === 'LOGOUT' ? '' : t('ui.validCountdown', { time: countdown })}
                </Text>
              </View>
            </View>
          )}

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
              <View style={styles.listHead}>
                <Text style={styles.listTitle}>{t('ui.prosSent', { n: sorted.length })}</Text>
                <Text style={styles.listHint}>{t('ui.swipeHint')}</Text>
              </View>
              {sorted.map((q, i) => (
                <QuoteCardItem
                  key={q.id}
                  q={q}
                  bestMatch={bestQuotes.has(q.id)}
                  loading={actionLoading === q.id}
                  onAccept={() => handleAccept(q.id)}
                  onViewProfile={() => q.providerId ? router.push(`/(customer)/find/tasker-profile/${q.providerId}` as any) : undefined}
                  onDismiss={() => setDismissed(prev => new Set(prev).add(q.id))}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  backPress: { borderRadius: radius.full },
  backBtn: {
    width: 42, height: 42, borderRadius: radius.full, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  backChevron: { color: colors.textPrimary, fontSize: 26, lineHeight: 28, fontFamily: 'Outfit_500Medium' },
  headerTitle: { ...typography.h3, fontSize: 18 },
  countPill: {
    minWidth: 34, height: 34, paddingHorizontal: 10, borderRadius: radius.full,
    backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center',
  },
  countText: { ...typography.caption, color: colors.accent, fontFamily: 'Outfit_700Bold' },

  list: { flex: 1 },
  listContent: { padding: spacing.md, paddingBottom: spacing.xl },

  summaryCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.border, ...shadows.card,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center' },
  summaryIcon: {
    width: 46, height: 46, borderRadius: radius.sm * 1.5, backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryInfo: { flex: 1, marginLeft: spacing.md },
  jobTitle: { ...typography.body, fontFamily: 'Outfit_700Bold', fontSize: 16 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  locText: { ...typography.caption, color: colors.textSecondary },
  budget: { ...typography.body, color: colors.accent, fontFamily: 'Outfit_700Bold', fontSize: 16 },
  validityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.border,
  },
  validityText: { ...typography.caption, color: colors.textSecondary, fontFamily: 'Outfit_600SemiBold' },

  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  listTitle: { ...typography.body, fontFamily: 'Outfit_600SemiBold', fontSize: 15 },
  listHint: { ...typography.caption, color: colors.textMuted },

  quoteCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  bestMatchTag: {
    position: 'absolute', top: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accent, paddingHorizontal: 10, paddingVertical: 4,
    borderBottomLeftRadius: radius.sm,
  },
  bestMatchText: { ...typography.caption, color: colors.background, fontFamily: 'Outfit_700Bold', fontSize: 10, letterSpacing: 0.4 },
  providerRow: { flexDirection: 'row', alignItems: 'center' },
  providerInfo: { flex: 1, marginLeft: spacing.md },
  providerName: { ...typography.body, fontFamily: 'Outfit_600SemiBold', fontSize: 16 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  ratingText: { ...typography.caption, color: colors.accent, fontFamily: 'Outfit_600SemiBold' },
  jobsText: { ...typography.caption, color: colors.textSecondary },
  price: { ...typography.h3, color: colors.accent, fontSize: 22, fontFamily: 'Outfit_700Bold' },
  priceCur: { ...typography.caption, color: colors.textSecondary, position: 'absolute', bottom: 0, right: 1 },
  message: { ...typography.body, color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: spacing.md },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.full, backgroundColor: colors.surfaceHigh },
  metaText: { ...typography.caption, color: colors.textPrimary, fontFamily: 'Outfit_600SemiBold' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  profileBtnPress: { flex: 1, borderRadius: radius.full },
  profileBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 13, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
  },
  profileBtnText: { ...typography.body, color: colors.accent, fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  acceptBtnPress: { flex: 1.4, borderRadius: radius.full },
  acceptBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, paddingVertical: 13, borderRadius: radius.full,
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  acceptBtnText: { ...typography.body, color: colors.background, fontFamily: 'Outfit_700Bold', fontSize: 15 },
  miniSpinner: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.background, borderTopColor: 'transparent' },

  dismissWrap: { width: 100, borderRadius: radius.lg, marginBottom: spacing.md },
  dismissBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.error, borderRadius: radius.lg, marginLeft: spacing.sm,
  },
  dismissText: { ...typography.caption, color: colors.textPrimary, fontFamily: 'Outfit_600SemiBold' },

  swipeHint: { alignItems: 'center', marginTop: spacing.sm },
  swipeHintText: { ...typography.caption, color: colors.textMuted },

  skeletonWrap: { padding: spacing.md, gap: spacing.md },
})