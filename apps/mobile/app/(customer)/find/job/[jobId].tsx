import { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { CaretRight, CheckCircle, Clock, CurrencyDollar } from 'phosphor-react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { templateJobs } from '../../../../lib/api'
import { v3 } from '../../../../theme/v3/tokens'

import Skeleton from '../../../../components/ui/Skeleton'

export default function ServiceTemplateDetail() {
  const { t } = useTranslation()
  const { jobId } = useLocalSearchParams<{ jobId: string }>()
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    (async () => {
      try {
        const data = await templateJobs.get(jobId!)
        setJob(data)
      } catch (e) {
        console.error('Failed to load job', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [jobId])

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ padding: 18 }}>
          <Skeleton width="40%" height={14} radius={7} />
          <Skeleton width="80%" height={28} radius={8} style={{ marginTop: 12 }} />
          <Skeleton width="100%" height={60} radius={12} style={{ marginTop: 16 }} />
          <Skeleton width="100%" height={100} radius={12} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    )
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t('errors.jobNotFound')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  const avgPrice = Math.round((job.priceMin + job.priceMax) / 2)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ═══ Category Badge ═══ */}
        {job.category && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{job.category.name}</Text>
          </View>
        )}

        {/* ═══ Title ═══ */}
        <Text style={styles.title}>{job.name}</Text>

        {/* ═══ Meta Row ═══ */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Clock size={14} color={v3.colors.textMuted} weight="regular" />
            <Text style={styles.metaLabel}>{job.typicalDurationMinutes} min</Text>
          </View>
          <View style={styles.metaItem}>
            <CurrencyDollar size={14} color={v3.colors.amber} weight="regular" />
            <Text style={styles.metaValue}>LKR {avgPrice.toLocaleString()}</Text>
          </View>
        </View>

        {/* ═══ Description ═══ */}
        {job.description ? (
          <Text style={styles.desc}>{job.description}</Text>
        ) : null}

        {/* ═══ What's Included ═══ */}
        {job.whatIsIncluded && job.whatIsIncluded.length > 0 ? (
          <View style={styles.includedSection}>
            <Text style={styles.sectionTitle}>What's included</Text>
            {job.whatIsIncluded.map((item: string, i: number) => (
              <View key={i} style={styles.includedRow}>
                <CheckCircle size={16} color={v3.colors.success} weight="fill" />
                <Text style={styles.includedText}>{item}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* ═══ Price Range ═══ */}
        <View style={styles.priceSection}>
          <Text style={styles.priceLabel}>Estimated price range</Text>
          <Text style={styles.priceRange}>LKR {job.priceMin.toLocaleString()} — {job.priceMax.toLocaleString()}</Text>
        </View>
      </ScrollView>

      {/* ═══ Bottom CTA ═══ */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => router.push({ pathname: '/(customer)/find/taskers/[jobId]', params: { jobId: jobId! } } as any)}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaText}>Find Tasker</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  scroll: { padding: 18, paddingBottom: 120 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: v3.colors.surfaceGray,
    borderWidth: 1,
    borderColor: v3.colors.line,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: v3.radius.full,
    marginBottom: 12,
  },
  categoryText: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
    color: v3.colors.textSecondary,
  },

  title: {
    fontSize: 26,
    fontFamily: 'Outfit_900Black',
    color: v3.colors.textPrimary,
    marginBottom: 12,
  },

  metaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: v3.colors.surfaceWhite,
    borderWidth: 1,
    borderColor: v3.colors.line,
    borderRadius: v3.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metaLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    color: v3.colors.textMuted,
  },
  metaValue: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.amber,
  },

  desc: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    color: v3.colors.textSecondary,
    lineHeight: 20,
    marginBottom: 18,
  },

  includedSection: {
    backgroundColor: v3.colors.surfaceWhite,
    borderWidth: 1,
    borderColor: v3.colors.line,
    borderRadius: v3.radius.lg,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.textPrimary,
    marginBottom: 12,
  },
  includedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  includedText: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    color: v3.colors.textPrimary,
    flex: 1,
  },

  priceSection: {
    backgroundColor: v3.colors.surfaceWhite,
    borderWidth: 1,
    borderColor: v3.colors.line,
    borderRadius: v3.radius.lg,
    padding: 16,
  },
  priceLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
    color: v3.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  priceRange: {
    fontSize: 17,
    fontFamily: 'Outfit_800ExtraBold',
    color: v3.colors.amber,
  },

  emptyText: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
    color: v3.colors.textMuted,
    textAlign: 'center',
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: v3.colors.paper,
    borderTopWidth: 1,
    borderTopColor: v3.colors.line,
    padding: 18,
    paddingBottom: 36,
  },
  ctaBtn: {
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.full,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.paper,
  },
})
