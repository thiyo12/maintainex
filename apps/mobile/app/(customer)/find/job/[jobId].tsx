import { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useColors } from '../../../../lib/ThemeContext'
import { templateJobs } from '../../../../lib/api'
import StickyBottomBar from '../../../../components/find/StickyBottomBar'
import SkeletonLoader from '../../../../components/find/SkeletonLoader'
import { useTranslation } from 'react-i18next'

export default function JobDetail() {
  const { t } = useTranslation()
  const colors = useColors()
    const styles = makeStyles(colors)
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

  if (loading) return <View style={styles.container}><SkeletonLoader count={4} height={100} /></View>
  if (!job) return <View style={styles.container}><Text style={{ textAlign: 'center', marginTop: 40 }}>{t('errors.jobNotFound')}</Text></View>

  const avgPrice = Math.round((job.priceMin + job.priceMax) / 2)

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.categoryBadge, { backgroundColor: job.category.colorHex + '20' }]}>
          <Ionicons name={job.category.iconName as any} size={16} color={job.category.colorHex} />
          <Text style={[styles.categoryText, { color: job.category.colorHex }]}>{job.category.name}</Text>
        </View>

        <Text style={styles.title}>{job.name}</Text>
        <Text style={styles.desc}>{job.description}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <Text style={styles.metaLabel}>{t('jobDetail.duration')}</Text>
            <Text style={styles.metaValue}>{job.typicalDurationMinutes} min</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="cash-outline" size={18} color={colors.primary} />
            <Text style={styles.metaLabel}>{t('postJob.budget')}</Text>
            <Text style={styles.metaValue}>Rs {job.priceMin.toLocaleString()} - Rs {job.priceMax.toLocaleString()}</Text>
          </View>
        </View>

        {job.whatIsIncluded && job.whatIsIncluded.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('jobDetail.whatsIncluded')}</Text>
            {job.whatIsIncluded.map((item: string, i: number) => (
              <View key={i} style={styles.includedRow}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.includedText}>{item}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <StickyBottomBar
        price={`Rs ${avgPrice.toLocaleString()}`}
        label={t('postJob.budget')}
        buttonText={t('customer.findTasker')}
        icon="search"
        onPress={() => router.push(`/(customer)/find/taskers/${jobId}`)}
      />
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
    marginBottom: 12,
  },
  categoryText: { fontSize: 12, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  desc: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 16 },
  metaRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  metaItem: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  metaLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  metaValue: { fontSize: 13, fontWeight: '600', color: '#1F2937', marginTop: 2 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 10 },
  includedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  includedText: { fontSize: 14, color: '#374151' },
})
