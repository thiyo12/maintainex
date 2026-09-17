import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Timer, Star, MapPin, ChatDots } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import { jobs } from '../../../lib/api'
import type { JobPosting } from '../../../lib/types'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'

import AvatarCircle from '../../../components/ui/AvatarCircle'
import PressableScale from '../../../components/ui/PressableScale'
import EmptyState from '../../../components/ui/EmptyState'
import AnimatedEntry from '../../../components/ui/AnimatedEntry'
import Skeleton from '../../../components/ui/Skeleton'

export default function QuotesScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
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
                  <ChatDots size={22} color={colors.amber} weight="fill" />
                </View>
                <View style={styles.summaryInfo}>
                  <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                  {job.location ? (
                    <View style={styles.locRow}>
                      <MapPin size={12} color={colors.muted} weight="fill" />
                      <Text style={styles.locText}>{job.location}</Text>
                    </View>
                  ) : null}
                </View>
                {budget > 0 ? <Text style={styles.budget}>LKR {budget.toLocaleString()}</Text> : null}
              </View>
              <View style={styles.validityRow}>
                <Timer size={15} color={colors.amber} weight="fill" />
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
                          <Star size={13} color={colors.amber} weight="fill" />
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
                        <Timer size={13} color={colors.amber} weight="fill" />
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

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  backPress: { borderRadius: 9999 },
  backBtn: {
    width: 42, height: 42, borderRadius: 9999, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  backChevron: { color: colors.ink, fontSize: 26, lineHeight: 28, fontFamily: fonts.body },
  headerTitle: { fontFamily: fonts.heading, fontSize: 18 },
  countPill: {
    minWidth: 34, height: 34, paddingHorizontal: 10, borderRadius: 9999,
    backgroundColor: colors.amberBg, alignItems: 'center', justifyContent: 'center',
  },
  countText: { color: colors.amber, fontFamily: fonts.bodyMedium, fontSize: 13 },

  list: { flex: 1 },
  listContent: { padding: 12, paddingBottom: 32 },

  summaryCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center' },
  summaryIcon: {
    width: 46, height: 46, borderRadius: 21, backgroundColor: colors.amberBg,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryInfo: { flex: 1, marginLeft: 12 },
  jobTitle: { fontFamily: fonts.bodyMedium, fontSize: 16 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  locText: { fontFamily: fonts.bodyLight, fontSize: 12, color: colors.muted },
  budget: { fontFamily: fonts.bodyMedium, color: colors.amber, fontSize: 16 },
  validityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: colors.border,
  },
  validityText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },

  offerCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  providerRow: { flexDirection: 'row', alignItems: 'center' },
  providerInfo: { flex: 1, marginLeft: 12 },
  providerName: { fontFamily: fonts.bodyMedium, fontSize: 16 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  ratingText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.amber },
  skillText: { fontFamily: fonts.bodyLight, fontSize: 12, color: colors.muted, flexShrink: 1 },
  priceBox: { alignItems: 'flex-end' },
  price: { fontFamily: fonts.bodyMedium, color: colors.amber, fontSize: 20 },
  priceCur: { fontFamily: fonts.bodyLight, fontSize: 12, color: colors.muted },
  message: { fontFamily: fonts.bodyLight, color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 12 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 9999, backgroundColor: '#2E2E2E' },
  metaText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  profileBtnPress: { flex: 1, borderRadius: 9999 },
  profileBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14,
    borderRadius: 9999, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#2E2E2E',
  },
  profileBtnText: { fontFamily: fonts.bodyMedium, color: colors.amber, fontSize: 14 },
  acceptBtnPress: { flex: 1, borderRadius: 9999 },
  acceptBtn: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 9999,
    backgroundColor: colors.amber,
    shadowColor: colors.amber, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  acceptBtnText: { fontFamily: fonts.bodyMedium, color: '#0D0D0D', fontSize: 15 },

  skeletonWrap: { padding: 12, gap: 12 },
})
