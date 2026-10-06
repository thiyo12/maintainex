import { useEffect, useMemo, useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CaretRight } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import { v2Jobs } from '@/api/v2-jobs'
import { v3 } from '@/theme/v3/tokens'
import { categoryIcon } from '@/lib/categoryVisuals'

import V3CustomerBottomNav from '@/components/v3/V3CustomerBottomNav'
import StatusBadge from '@/components/ui/StatusBadge'
import Skeleton from '@/components/ui/Skeleton'

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

  const grouped = useMemo(() => ({
    active: jobs.filter((j) => ACTIVE_STATUSES.includes(j.status)),
    completed: jobs.filter((j) => j.status === 'COMPLETED'),
    cancelled: jobs.filter((j) => j.status === 'CANCELLED' || j.status === 'FAILED'),
  }), [jobs])

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.pageTitle}>{t('activity.title')}</Text>

      {/* ═══ Tab Pills ═══ */}
      <View style={styles.pillRow}>
        {tabs.map((tb) => {
          const isActive = tab === tb.id
          return (
            <TouchableOpacity key={tb.id} onPress={() => setTab(tb.id)} activeOpacity={0.7} style={[styles.pill, isActive && styles.pillActive]}>
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{tb.label}</Text>
              <View style={[styles.pillCount, isActive && styles.pillCountActive]}>
                <Text style={[styles.pillCountText, isActive && styles.pillCountTextActive]}>{grouped[tb.id].length}</Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadJobs(true)} tintColor={v3.colors.ink} />}
      >
        {loading ? (
          <View style={styles.list}>
            {[0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={86} radius={16} />)}
          </View>
        ) : current.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No {tab} jobs</Text>
            <Text style={styles.emptySub}>Post a job to get started</Text>
            <TouchableOpacity
              style={styles.emptyCta}
              onPress={() => router.push('/(customer)/jobs/v2/create' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyCtaText}>Post a Job</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {current.map((job, i) => {
              const Icon = categoryIcon(job.categoryId)
              return (
                <TouchableOpacity key={job.id} style={styles.card} onPress={() => openJob(job)} activeOpacity={0.7}>
                  <View style={styles.iconBox}>
                    <Icon size={20} color={v3.colors.ink} weight="fill" />
                  </View>
                  <View style={styles.body}>
                    <Text style={styles.title} numberOfLines={1}>{job.title || 'Untitled job'}</Text>
                    <Text style={styles.date}>{new Date(job.createdAt).toLocaleDateString()}</Text>
                    <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                      <StatusBadge status={job.status} />
                    </View>
                  </View>
                  <CaretRight size={14} color={v3.colors.textMuted} weight="bold" />
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </ScrollView>

      <V3CustomerBottomNav
        activeTab="activity"
        onTabPress={(tab) => {
          if (tab === 'activity') return
          if (tab === 'home') router.push('/(customer)/(tabs)' as any)
          else router.push(`/(customer)/(tabs)/${tab}` as any)
        }}
        onPostJob={() => router.push('/(customer)/jobs/v2/create' as any)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  pageTitle: {
    fontSize: 28,
    fontFamily: 'Outfit_900Black',
    color: v3.colors.textPrimary,
    paddingHorizontal: 18,
    paddingTop: 8,
    marginBottom: 14,
  },

  pillRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: v3.radius.full,
    borderWidth: 1,
    borderColor: v3.colors.line,
    backgroundColor: v3.colors.surfaceWhite,
  },
  pillActive: { backgroundColor: v3.colors.ink, borderColor: v3.colors.ink },
  pillText: { fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textMuted },
  pillTextActive: { color: v3.colors.paper },
  pillCount: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
    backgroundColor: v3.colors.surfaceGray,
    alignItems: 'center', justifyContent: 'center',
  },
  pillCountActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  pillCountText: { fontSize: 11, fontFamily: 'Outfit_700Bold', color: v3.colors.textMuted },
  pillCountTextActive: { color: v3.colors.paper },

  scroll: { paddingBottom: 120, paddingHorizontal: 18 },
  list: { gap: 10 },

  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: v3.colors.surfaceWhite,
    borderWidth: 1, borderColor: v3.colors.line,
    borderRadius: v3.radius.lg, padding: 14,
  },
  iconBox: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: v3.colors.surfaceGray,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  body: { flex: 1, marginRight: 12 },
  title: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: v3.colors.textPrimary },
  date: { fontSize: 11, fontFamily: 'Outfit_500Medium', color: v3.colors.textMuted, marginTop: 2 },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: v3.colors.textPrimary, marginBottom: 4 },
  emptySub: { fontSize: 13, fontFamily: 'Outfit_500Medium', color: v3.colors.textMuted, marginBottom: 20 },
  emptyCta: {
    backgroundColor: v3.colors.ink, paddingHorizontal: 24, paddingVertical: 12, borderRadius: v3.radius.full,
  },
  emptyCtaText: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: v3.colors.paper },
})
