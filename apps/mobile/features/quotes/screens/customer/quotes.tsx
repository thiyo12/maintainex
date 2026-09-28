import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Timer, Star, MapPin, ChatDots } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import { jobs } from '@/lib/api'
import type { JobPosting } from '@/lib/types'
import { colors, spacing, radius, typography, shadows } from '@/lib/design'

import AvatarCircle from '@/components/ui/AvatarCircle'
import PressableScale from '@/components/ui/PressableScale'
import EmptyState from '@/components/ui/EmptyState'
import AnimatedEntry from '@/components/ui/AnimatedEntry'
import Skeleton from '@/components/ui/Skeleton'

export default function QuotesScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { jobId } = useLocalSearchParams<{ jobId?: string }>()
  const [job, setJob] = useState<JobPosting | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (jobId) {
      jobs.get(jobId as string)
        .then(setJob)
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [jobId])

  const bids = useMemo(() => (job?.bids || []).sort((a: any, b: any) => (b?.amount || 0) - (a?.amount || 0)), [job])
  const budget = job?.budget || 0

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} scaleTo={0.92} style={styles.backPress}>
          <View style={styles.backBtn}>
            <Text style={styles.backChevron}>‹</Text>
          </View>
        </PressableScale>
        <Text style={styles.headerTitle}>{t('quotes.title')}</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{bids.length}</Text>
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
                  <ChatDots size={22} color={colors.accent} weight="fill" />
                </View>
                <View style={styles.summaryInfo}>
                  <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                  {job.location ? (
                    <View style={styles.locRow}>
                      <MapPin size={12} color={colors.textSecondary} weight="fill" />
                      <Text style={styles.locText}>{job.location}</Text>
                    </View>
                  ) : null}
                </View>
                {budget > 0 ? <Text style={styles.budget}>LKR {budget.toLocaleString()}</Text> : null}
              </View>
              <View style={styles.validityRow}>
                <Timer size={15} color={colors.accent} weight="fill" />
                <Text style={styles.validityText}>{t('ui.reviewOffers')}</Text>
              </View>
            </View>
          )}

          {bids.length === 0 ? (
            <EmptyState
              lottieUrl="https://assets6.lottiefiles.com/packages/lf20_myejiggj.json"
              title={t('ui.noOffers')}
              subtitle={t('ui.noOffersSub')}
              ctaText={t('ui.viewJob')}
              onCta={() => router.back()}
              FallbackIcon={ChatDots}
            />
          ) : (
            bids.map((q, i) => {
              const tasker = q.tasker
              const name = tasker?.user?.name || t('quotes.tasker')
              return (
                <AnimatedEntry key={q.id || i} delay={i * 80}>
                  <View style={styles.offerCard}>
                    <View style={styles.providerRow}>
                      <AvatarCircle uri={tasker?.user?.profileImage} name={name} size={52} />
                      <View style={styles.providerInfo}>
                        <Text style={styles.providerName} numberOfLines={1}>{name}</Text>
                        <View style={styles.ratingRow}>
                          <Star size={13} color={colors.accent} weight="fill" />
                          <Text style={styles.ratingText}>{tasker?.rating ? tasker.rating.toFixed(1) : '—'}</Text>
                          <Text style={styles.skillText} numberOfLines={1}>{tasker?.skills?.[0] || ''}</Text>
                        </View>
                      </View>
                      <View style={styles.priceBox}>
                        <Text style={styles.price}>{q.amount?.toLocaleString()}</Text>
                        <Text style={styles.priceCur}>LKR</Text>
                      </View>
                    </View>

                    {q.message ? <Text style={styles.message} numberOfLines={3}>{q.message}</Text> : null}

                    <View style={styles.metaRow}>
                      <View style={styles.metaPill}>
                        <Timer size={13} color={colors.accent} weight="fill" />
                        <Text style={styles.metaText}>{t('ui.estAsQuoted')}</Text>
                      </View>
                    </View>

                    <View style={styles.actions}>
                      <PressableScale
                        onPress={() => tasker?.user?.id ? router.push(`/(customer)/find/tasker-profile/${tasker.user.id}` as any) : undefined}
                        scaleTo={0.97}
                        style={styles.profileBtnPress}
                      >
                        <View style={styles.profileBtn}>
                          <Text style={styles.profileBtnText}>{t('quotes.viewProfile')}</Text>
                        </View>
                      </PressableScale>
                      <PressableScale
                        onPress={() =>
                          router.push(`/(customer)/payment/escrow-confirm?bookingId=${jobId || ''}&quoteId=${q.id}&taskerName=${encodeURIComponent(name || '')}&quotedAmount=${q.amount}&jobTitle=${encodeURIComponent(job?.title || '')}` as any)
                        }
                        scaleTo={0.97}
                        style={styles.acceptBtnPress}
                      >
                        <View style={styles.acceptBtn}>
                          <Text style={styles.acceptBtnText}>{t('quotes.accept')}</Text>
                        </View>
                      </PressableScale>
                    </View>
                  </View>
                </AnimatedEntry>
              )
            })
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

  offerCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  providerRow: { flexDirection: 'row', alignItems: 'center' },
  providerInfo: { flex: 1, marginLeft: spacing.md },
  providerName: { ...typography.body, fontFamily: 'Outfit_600SemiBold', fontSize: 16 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  ratingText: { ...typography.caption, color: colors.accent, fontFamily: 'Outfit_600SemiBold' },
  skillText: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  priceBox: { alignItems: 'flex-end' },
  price: { ...typography.h3, color: colors.accent, fontSize: 20, fontFamily: 'Outfit_700Bold' },
  priceCur: { ...typography.caption, color: colors.textSecondary },
  message: { ...typography.body, color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: spacing.md },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.full, backgroundColor: colors.surfaceHigh },
  metaText: { ...typography.caption, color: colors.textPrimary, fontFamily: 'Outfit_600SemiBold' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  profileBtnPress: { flex: 1, borderRadius: radius.full },
  profileBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceHigh,
  },
  profileBtnText: { ...typography.body, color: colors.accent, fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  acceptBtnPress: { flex: 1, borderRadius: radius.full },
  acceptBtn: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.full,
    backgroundColor: colors.accent,
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  acceptBtnText: { ...typography.body, color: colors.background, fontFamily: 'Outfit_700Bold', fontSize: 15 },

  skeletonWrap: { padding: spacing.md, gap: spacing.md },
})