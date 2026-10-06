import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { CaretLeft, Check, DotsThree } from 'phosphor-react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { templateJobs } from '@/api/jobs'
import { v3 } from '@/theme/v3/tokens'
import Skeleton from '@/components/ui/Skeleton'

const currency = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) ? `LKR ${n.toLocaleString()}` : 'Price on request'
}

export default function ServiceTemplateDetail() {
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
        <View style={styles.header}>
          <View style={styles.headerButton} />
          <Text style={styles.headerTitle}>Service details</Text>
          <View style={styles.headerButtonRight} />
        </View>
        <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
          <Skeleton width={82} height={24} radius={12} />
          <Skeleton width="80%" height={32} radius={10} style={{ marginTop: 12 }} />
          <Skeleton width="100%" height={52} radius={12} style={{ marginTop: 14 }} />
          <Skeleton width="100%" height={110} radius={16} style={{ marginTop: 22 }} />
        </View>
      </SafeAreaView>
    )
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}><CaretLeft size={20} color={v3.colors.ink} weight="bold" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Service details</Text>
          <View style={styles.headerButtonRight} />
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>This service is no longer available.</Text>
          <TouchableOpacity style={styles.outlineButton} onPress={() => router.back()}><Text style={styles.outlineButtonText}>Go back</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const min = Number(job.priceMin || 0)
  const max = Number(job.priceMax || min)
  const avg = Math.round((min + max) / 2)
  const duration = Number(job.typicalDurationMinutes || 0)
  const durationLabel = duration > 0 ? (duration <= 60 ? `${Math.max(15, duration - 15)}–${duration} min` : `${Math.max(1, Math.round(duration / 60) - 1)}–${Math.round(duration / 60)} hr`) : 'Varies by job'
  const included = Array.isArray(job.whatIsIncluded) && job.whatIsIncluded.length > 0
    ? job.whatIsIncluded.slice(0, 5)
    : ['Inspection & diagnosis', 'Standard labour', 'Final function test', 'Work-area clean-up']

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()} hitSlop={10}>
          <CaretLeft size={20} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service details</Text>
        <View style={styles.headerButtonRight}><DotsThree size={17} color={v3.colors.ink} weight="bold" /></View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{String(job.category?.name || job.categoryName || 'SERVICE').toUpperCase()}</Text>
        </View>

        <Text style={styles.title}>{job.name || job.title}</Text>
        <Text style={styles.description}>{job.description || 'Tell us what you need and a trusted professional can confirm the exact scope before work starts.'}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TYPICAL TIME</Text>
            <Text style={styles.statValue}>{durationLabel}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TYPICAL RANGE</Text>
            <Text style={styles.statValue}>{min && max ? `${currency(min).replace('LKR ', 'LKR ')}–${(max / 1000 >= 1 ? `${(max / 1000).toFixed(max % 1000 === 0 ? 0 : 1)}K` : max.toLocaleString())}` : 'Quote required'}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>What’s usually included</Text>
        <View style={styles.includedCard}>
          {included.map((item: string, index: number) => (
            <View key={`${item}-${index}`} style={[styles.includedRow, index < included.length - 1 && styles.includedDivider]}>
              <View style={styles.checkCircle}><Check size={12} color={v3.colors.ink} weight="bold" /></View>
              <Text style={styles.includedText}>{item}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.customCard}
          onPress={() => router.push({ pathname: '/(customer)/jobs/v2/create', params: { title: job.name || job.title, categoryId: job.categoryId || job.category?.id } } as any)}
          activeOpacity={0.75}
        >
          <Text style={styles.customEyebrow}>NEED SOMETHING DIFFERENT?</Text>
          <Text style={styles.customTitle}>Describe the problem in your own words.</Text>
          <Text style={styles.customBody}>MaintainEX can create a custom job instead.</Text>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.priceSummary}>
          <Text style={styles.priceLabel}>Typical from</Text>
          <Text style={styles.priceValue}>{avg ? currency(avg) : 'Quote'}</Text>
        </View>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push({ pathname: '/(customer)/find/taskers/[jobId]', params: { jobId: jobId! } } as any)}
          activeOpacity={0.82}
        >
          <Text style={styles.primaryButtonText}>Find available taskers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push({ pathname: '/(customer)/jobs/v2/create', params: { title: job.name || job.title, categoryId: job.categoryId || job.category?.id } } as any)}
        >
          <Text style={styles.secondaryButtonText}>Post as a custom job instead</Text>
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
  headerTitle: { flex: 1, textAlign: 'center', marginHorizontal: 8, fontSize: 17, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  scroll: { paddingHorizontal: 18, paddingBottom: 10 },
  categoryBadge: { alignSelf: 'flex-start', minHeight: 24, borderRadius: 12, backgroundColor: v3.colors.amberSoft, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  categoryText: { fontSize: 8.3, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.amberDark, letterSpacing: 0.45 },
  title: { marginTop: 12, fontSize: 27, fontFamily: 'Outfit_900Black', color: v3.colors.ink, letterSpacing: -0.25 },
  description: { marginTop: 8, fontSize: 10.2, lineHeight: 16, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  statsRow: { marginTop: 18, flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, height: 74, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, paddingHorizontal: 14, paddingTop: 13 },
  statLabel: { fontSize: 8.2, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.textSecondary, letterSpacing: 0.45 },
  statValue: { marginTop: 10, fontSize: 15.5, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  sectionTitle: { marginTop: 24, marginBottom: 10, fontSize: 13, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  includedCard: { borderRadius: 17, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, overflow: 'hidden' },
  includedRow: { minHeight: 43, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  includedDivider: { borderBottomWidth: 1, borderBottomColor: v3.colors.line },
  checkCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: v3.colors.successSoft, alignItems: 'center', justifyContent: 'center' },
  includedText: { flex: 1, fontSize: 10.5, fontFamily: 'Outfit_700Bold', color: v3.colors.ink },
  customCard: { marginTop: 18, minHeight: 84, borderRadius: 17, backgroundColor: v3.colors.amberSoft, borderWidth: 1, borderColor: '#F5D28D', paddingHorizontal: 14, paddingVertical: 13 },
  customEyebrow: { fontSize: 8.2, fontFamily: 'Outfit_900Black', color: v3.colors.amberDark, letterSpacing: 0.4 },
  customTitle: { marginTop: 8, fontSize: 11.2, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  customBody: { marginTop: 4, fontSize: 8.8, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  center: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, textAlign: 'center', fontFamily: 'Outfit_600SemiBold', color: v3.colors.textMuted },
  outlineButton: { marginTop: 16, minWidth: 120, height: 44, borderRadius: 14, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  outlineButtonText: { fontSize: 11, fontFamily: 'Outfit_700Bold', color: v3.colors.ink },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: v3.colors.paper, borderTopWidth: 1, borderTopColor: v3.colors.line, paddingHorizontal: 18, paddingTop: 11, paddingBottom: 24 },
  priceSummary: { position: 'absolute', left: 18, top: 10 },
  priceLabel: { fontSize: 8.6, fontFamily: 'Outfit_700Bold', color: v3.colors.textSecondary },
  priceValue: { marginTop: 3, fontSize: 17, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  primaryButton: { alignSelf: 'flex-end', minWidth: 174, height: 48, paddingHorizontal: 18, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 12.5, fontFamily: 'Outfit_900Black', color: v3.colors.paper },
  secondaryButton: { height: 34, marginTop: 5, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: 10.7, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink, textDecorationLine: 'underline' },
})
