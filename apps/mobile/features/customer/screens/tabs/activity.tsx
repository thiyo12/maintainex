import { useEffect, useMemo, useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeInUp } from 'react-native-reanimated'
import { CaretRight, Plus } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import { v2Jobs } from '@/lib/api-v2'
import { translateJobStatus } from '@/lib/i18n'
import { colors, spacing, radius, typography } from '@/lib/design'
import { categoryIcon } from '@/lib/categoryVisuals'

import PressableScale from '@/components/ui/PressableScale'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'

const TRACKABLE = ['QUOTE_ACCEPTED', 'PENDING_PAYMENT', 'ESCROW_DEPOSITED', 'IN_PROGRESS', 'EN_ROUTE', 'ARRIVED', 'WORKING']
const ACTIVE_STATUSES = ['OPEN', 'QUOTE_ACCEPTED', 'PENDING_PAYMENT', 'ESCROW_DEPOSITED', 'IN_PROGRESS', 'EN_ROUTE', 'ARRIVED', 'WORKING', 'REVIEW']

type Tab = 'active' | 'completed' | 'cancelled'

export default function ActivityScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const [jobs, setJobs] = useState<any[]>([])
  const [tab, setTab] = useState<Tab>('active')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadJobs = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      const res = await v2Jobs.list()
      setJobs(res.jobs || [])
    } catch {
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  const grouped = useMemo(() => {
    return {
      active: jobs.filter((j) => ACTIVE_STATUSES.includes(j.status)),
      completed: jobs.filter((j) => j.status === 'COMPLETED'),
      cancelled: jobs.filter((j) => j.status === 'CANCELLED' || j.status === 'FAILED'),
    }
  }, [jobs])

  const current = grouped[tab]

  const tabs: { id: Tab; label: string }[] = [
    { id: 'active', label: t('activity.active') },
    { id: 'completed', label: t('activity.completed') },
    { id: 'cancelled', label: t('activity.cancelled') },
  ]

  const openJob = (job: any) => {
    if (TRACKABLE.includes(job.status)) router.push(`/(customer)/tracking/${job.id}` as any)
    else router.push(`/(customer)/jobs/v2/${job.id}` as any)
  }

  const emptyCopy = {
    active: {
      title: t('activity.emptyActive'),
      subtitle: t('activity.emptyActiveSub'),
      icon: 'general' as string,
    },
    completed: {
      title: t('activity.emptyCompleted'),
      subtitle: t('activity.emptyCompletedSub'),
      icon: 'general' as string,
    },
    cancelled: {
      title: t('activity.emptyCancelled'),
      subtitle: t('activity.emptyCancelledSub'),
      icon: 'general' as string,
    },
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.pageTitle}>{t('activity.title')}</Text>

      <View style={styles.pillRow}>
        {tabs.map((tb) => {
          const isActive = tab === tb.id
          return (
            <PressableScale key={tb.id} onPress={() => setTab(tb.id)} scaleTo={0.95} style={styles.pillPress}>
              <View style={[styles.pill, isActive && styles.pillActive]}>
                <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{tb.label}</Text>
                <View style={[styles.pillCount, isActive && styles.pillCountActive]}>
                  <Text style={[styles.pillCountText, isActive && styles.pillCountTextActive]}>{grouped[tb.id].length}</Text>
                </View>
              </View>
            </PressableScale>
          )
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadJobs(true)} tintColor={colors.accent} />}
      >
        {loading ? (
          <View style={styles.list}>
            {[0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={96} radius={16} />)}
          </View>
        ) : current.length === 0 ? (
          <EmptyState
            title={emptyCopy[tab].title}
            subtitle={emptyCopy[tab].subtitle}
            ctaText={t('activity.postJob')}
            onCta={() => router.push('/(customer)/jobs/v2/create' as any)}
            FallbackIcon={categoryIcon(emptyCopy[tab].icon)}
          />
        ) : (
          <View style={styles.list}>
            {current.map((job, i) => {
              const Icon = categoryIcon(job.categoryId)
              const completed = job.status === 'COMPLETED'
              return (
                <Animated.View key={job.id} entering={FadeInUp.delay(i * 60).springify().damping(20).stiffness(300)}>
                  <PressableScale onPress={() => openJob(job)} scaleTo={0.98} style={styles.cardPress}>
                    <LinearGradient colors={[colors.surface, colors.surfaceHigh]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
                      <View style={styles.iconBox}>
                        <Icon size={22} color={colors.accent} weight="fill" />
                      </View>
                      <View style={styles.body}>
                        <Text style={styles.title} numberOfLines={1}>{job.title || t('home.untitledJob')}</Text>
                        <Text style={styles.date}>{new Date(job.createdAt).toLocaleDateString()}</Text>
                        <View style={[styles.badgeWrap, completed && { marginBottom: 2 }]}>
                          <StatusBadge status={job.status} />
                        </View>
                        {completed ? (
                          <PressableScale onPress={() => router.push(`/(customer)/jobs/review/${job.id}` as any)} scaleTo={0.95} style={styles.reviewPress} >
                            <View style={styles.reviewBtn}>
                              <Text style={styles.reviewText}>{t('activity.leaveReview')}</Text>
                              <CaretRight size={12} color={colors.accent} weight="bold" />
                            </View>
                          </PressableScale>
                        ) : null}
                      </View>
                      <CaretRight size={16} color={colors.textMuted} weight="bold" style={styles.chevron} />
                    </LinearGradient>
                  </PressableScale>
                </Animated.View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  pageTitle: { ...typography.h1, letterSpacing: -0.5, paddingHorizontal: spacing.md, paddingTop: spacing.sm, marginBottom: spacing.md },

  pillRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  pillPress: { flex: 1, borderRadius: radius.full },
  pill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { ...typography.caption, color: colors.textSecondary, fontFamily: 'Outfit_600SemiBold' },
  pillTextActive: { color: colors.background },
  pillCount: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  pillCountActive: { backgroundColor: 'rgba(11,12,18,0.2)' },
  pillCountText: { fontSize: 11, fontFamily: 'Outfit_700Bold', color: colors.textSecondary },
  pillCountTextActive: { color: colors.background },

  scroll: { paddingBottom: spacing.xxl, paddingHorizontal: spacing.md },
  list: { gap: spacing.sm },

  cardPress: { borderRadius: radius.md },
  card: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, position: 'relative',
  },
  iconBox: {
    width: 46, height: 46, borderRadius: radius.sm * 1.5,
    backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, marginLeft: spacing.md, marginRight: spacing.md },
  title: { ...typography.body, fontFamily: 'Outfit_600SemiBold', fontSize: 15 },
  date: { ...typography.caption, color: colors.textSecondary, marginTop: 2, marginBottom: 6 },
  badgeWrap: { alignSelf: 'flex-start' },
  reviewPress: { alignSelf: 'flex-start', marginTop: 8 },
  reviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accentSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
  reviewText: { ...typography.caption, color: colors.accent, fontFamily: 'Outfit_700Bold' },
  chevron: { marginLeft: 'auto' },
})