import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useColors } from '../../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { templateJobs } from '../../../lib/api'
import { fonts } from '../../../lib/fonts'
import SkeletonLoader from '../../../components/find/SkeletonLoader'

export default function PostJobConfirmScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { category, name, q, templateJobId } = useLocalSearchParams<{
    category?: string; name?: string; q?: string; templateJobId?: string
  }>()

  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [urgency, setUrgency] = useState<'normal' | 'urgent' | 'asap'>('normal')

  const displayName = name || q || category || ''

  useEffect(() => {
    if (!templateJobId) {
      setLoading(false)
      return
    }
    (async () => {
      try {
        const data = await templateJobs.get(templateJobId!)
        setJob(data)
      } catch {
        // template not found, that's ok
      } finally {
        setLoading(false)
      }
    })()
  }, [templateJobId])

  const handleProceed = () => {
    const params: Record<string, string> = {}
    if (templateJobId && job) {
      params.templateJobId = job.id
      params.title = job.name
    } else {
      if (category) params.categoryId = category
      if (displayName) params.title = displayName
    }
    if (notes.trim()) params.notes = notes.trim()
    if (urgency !== 'normal') params.urgency = urgency
    router.replace({ pathname: '/(customer)/jobs/v2/create', params })
  }

  const urgencyOptions = [
    { key: 'normal' as const, label: t('search.urgencyNormal') || 'Normal', icon: 'calendar-outline', color: colors.muted },
    { key: 'urgent' as const, label: t('search.urgencyUrgent') || 'Urgent (within 24h)', icon: 'flash-outline', color: '#F59E0B' },
    { key: 'asap' as const, label: t('search.urgencyAsap') || 'ASAP (within 2h)', icon: 'rocket-outline', color: '#EF4444' },
  ]

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.ink} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.ink }]}>{t('search.confirmJobDetails')}</Text>
        </View>

        {loading ? (
          <SkeletonLoader count={3} height={80} />
        ) : (
          <>
            <View style={[styles.jobCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.jobHeader}>
                <View style={[styles.jobIcon, { backgroundColor: (job?.category?.colorHex || colors.amber) + '18' }]}>
                  <Ionicons name="briefcase" size={22} color={job?.category?.colorHex || colors.amber} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.jobName, { color: colors.ink }]} numberOfLines={2}>
                    {job?.name || displayName}
                  </Text>
                  {job?.category && (
                    <Text style={[styles.jobCategory, { color: colors.muted }]}>{job.category.name}</Text>
                  )}
                </View>
              </View>

              {job?.description && (
                <Text style={[styles.jobDesc, { color: colors.muted }]}>{job.description}</Text>
              )}

              {job?.whatIsIncluded && job.whatIsIncluded.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('jobDetail.whatsIncluded')}</Text>
                  {job.whatIsIncluded.map((item: string, i: number) => (
                    <View key={i} style={styles.includedRow}>
                      <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                      <Text style={[styles.includedText, { color: colors.ink }]}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}

              {job?.typicalDurationMinutes && (
                <View style={styles.metaRow}>
                  <View style={[styles.metaItem, { backgroundColor: colors.white, borderColor: colors.border }]}>
                    <Ionicons name="time-outline" size={18} color={colors.amber} />
                    <Text style={[styles.metaLabel, { color: colors.muted }]}>{t('jobDetail.duration')}</Text>
                    <Text style={[styles.metaValue, { color: colors.ink }]}>{job.typicalDurationMinutes} min</Text>
                  </View>
                  {job?.priceMin && job?.priceMax && (
                    <View style={[styles.metaItem, { backgroundColor: colors.white, borderColor: colors.border }]}>
                      <Ionicons name="cash-outline" size={18} color={colors.amber} />
                      <Text style={[styles.metaLabel, { color: colors.muted }]}>{t('postJob.budget')}</Text>
                      <Text style={[styles.metaValue, { color: colors.ink }]}>
                        Rs {job.priceMin.toLocaleString()} - {job.priceMax.toLocaleString()}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={[styles.urgencyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.ink }]}>{t('search.howSoon')}</Text>
              {urgencyOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.urgencyRow,
                    { backgroundColor: colors.white, borderColor: colors.border },
                    urgency === opt.key && { borderColor: colors.amber, backgroundColor: colors.amber + '10' },
                  ]}
                  onPress={() => setUrgency(opt.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={opt.icon as any} size={18} color={urgency === opt.key ? colors.amber : colors.muted} />
                  <Text style={[styles.urgencyLabel, { color: urgency === opt.key ? colors.amberDark : colors.ink }]}>
                    {opt.label}
                  </Text>
                  <View style={[
                    styles.radio,
                    { borderColor: colors.border },
                    urgency === opt.key && { borderColor: colors.amber, backgroundColor: colors.amber },
                  ]}>
                    {urgency === opt.key && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.notesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.ink }]}>{t('search.specialRequirements')}</Text>
              <Text style={[styles.notesHint, { color: colors.muted }]}>{t('search.notesHint')}</Text>
              <TextInput
                style={[styles.notesInput, { backgroundColor: colors.white, borderColor: colors.border, color: colors.ink }]}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholder={t('search.notesPlaceholder') || 'e.g., Need someone with experience in tile work...'}
                placeholderTextColor={colors.muted}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: colors.white, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.postBtn, { backgroundColor: colors.amber }]}
          onPress={handleProceed}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-forward" size={20} color="#111827" />
          <Text style={styles.postBtnText}>{t('search.proceedToPost')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontFamily: fonts.headingBold, flex: 1 },
  jobCard: {
    borderRadius: 14, padding: 16, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  jobHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  jobIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  jobName: { fontSize: 16, fontFamily: fonts.headingBold, lineHeight: 22 },
  jobCategory: { fontSize: 12, fontFamily: fonts.body, marginTop: 2 },
  jobDesc: { fontSize: 13, fontFamily: fonts.body, lineHeight: 19, marginBottom: 14 },
  section: { marginTop: 4 },
  sectionTitle: { fontSize: 14, fontFamily: fonts.headingBold, marginBottom: 10 },
  includedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  includedText: { fontSize: 13, fontFamily: fonts.body, flex: 1 },
  metaRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  metaItem: {
    flex: 1, borderRadius: 10, padding: 10, borderWidth: 1,
    alignItems: 'center', gap: 2,
  },
  metaLabel: { fontSize: 10, fontFamily: fonts.body },
  metaValue: { fontSize: 12, fontFamily: fonts.headingBold },
  urgencyCard: {
    borderRadius: 14, padding: 16, borderWidth: 1, marginTop: 12,
  },
  cardTitle: { fontSize: 14, fontFamily: fonts.headingBold, marginBottom: 10 },
  urgencyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8,
  },
  urgencyLabel: { flex: 1, fontSize: 13, fontFamily: fonts.bodyMedium },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  notesCard: {
    borderRadius: 14, padding: 16, borderWidth: 1, marginTop: 12,
  },
  notesHint: { fontSize: 12, fontFamily: fonts.body, marginBottom: 8 },
  notesInput: {
    borderWidth: 1, borderRadius: 10, padding: 12,
    fontSize: 14, fontFamily: fonts.body, minHeight: 100,
  },
  bottomBar: {
    padding: 16, paddingBottom: 32,
    borderTopWidth: 1,
  },
  postBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 3,
  },
  postBtnText: { fontSize: 16, fontFamily: fonts.headingBold, color: '#111827' },
})
