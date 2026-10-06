import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CheckCircle, Camera, Sparkle, Lock } from 'phosphor-react-native'
import { fonts } from '@/lib/fonts'
import { useTranslation } from 'react-i18next'
import { jobs } from '@/api/jobs'
import { v2Jobs, v2JobActions } from '@/api/v2-jobs'
import { JobPosting } from '@/lib/types'
import { v3 } from '@/theme/v3/tokens'

export default function JobCompleteScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const [job, setJob] = useState<JobPosting | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [isV2, setIsV2] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    v2Jobs.get(id)
      .then((res) => {
        // V3 compatibility mapping: the V2 payload carries provider display
        // fields beyond the current typed summary; keep them dynamic here.
        const v2 = res.job as any
        const provider = v2.acceptedQuote?.provider
        setIsV2(true)
        setJob({
          id: v2.id,
          customerId: v2.customerId,
          title: v2.title,
          description: v2.description,
          category: v2.categoryName || v2.categoryId,
          budget: v2.budgetAmount ?? 0,
          location: v2.locationName || '',
          status: (v2.status as JobPosting['status']) || 'IN_PROGRESS',
          scheduledDate: v2.preferredDate || undefined,
          createdAt: v2.createdAt,
          customer: v2.customer || ({ id: v2.customerId, name: 'Customer' } as any),
          bids: [],
          assignedTasker: provider ? {
            id: provider.id || v2.acceptedQuote?.providerId || 'provider',
            userId: provider.id || v2.acceptedQuote?.providerId || 'provider',
            rating: v2.acceptedQuote?.providerRating || 0,
            completedJobs: v2.acceptedQuote?.completedJobs || 0,
            hourlyRate: 0,
            user: provider,
            bio: provider.bio || '',
            skills: provider.skills || [],
            serviceAreas: provider.serviceAreas || [],
            isVerified: !!provider.isVerified,
            isOnline: !!provider.isOnline,
            profileImage: provider.profileImage,
            createdAt: provider.createdAt || v2.createdAt,
          } : undefined,
        })
      })
      .catch(() => {
        jobs.get(id)
          .then(setJob)
          .catch((e) => setError(e.message))
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleComplete = async () => {
    if (!id) return
    setCompleting(true)
    setError(null)
    try {
      if (isV2) await v2JobActions.complete(id, 'APPROVE_COMPLETION')
      else await jobs.complete(id)
      setConfirmed(true)
    } catch (e: any) {
      setError(e.message || 'Unable to complete the job')
    } finally {
      setCompleting(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={v3.colors.ink} style={{ flex: 1 }} />
      </SafeAreaView>
    )
  }

  if (error && !job) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    )
  }

  const taskerName = job?.assignedTasker?.user?.name || t('jobComplete.tasker')
  const taskerInfo = job?.assignedTasker?.skills?.length ? job.assignedTasker.skills.join(', ') : ''
  const taskerDisplay = taskerInfo ? `${taskerName} • ${taskerInfo}` : taskerName
  const formattedDate = job?.scheduledDate
    ? new Date(job.scheduledDate).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : ''

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.successIcon}>
            <CheckCircle size={44} color={v3.colors.success} weight="fill" />
          </View>
          <Text style={styles.heading}>{t('jobComplete.jobInReview')}</Text>
          <Text style={styles.subtitle}>{t('jobComplete.jobInReviewDesc')}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.sumTitle}>{job?.title || t('home.untitledJob')}</Text>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>{t('jobComplete.tasker')}</Text>
            <Text style={styles.sumValue}>{taskerDisplay}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>{t('jobComplete.location')}</Text>
            <Text style={styles.sumValue}>{job?.location || '—'}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>{t('jobComplete.date')}</Text>
            <Text style={styles.sumValue}>{formattedDate || '—'}</Text>
          </View>
          <View style={[styles.sumRow, styles.lastRow]}>
            <Text style={styles.sumLabel}>{t('jobComplete.quoted')}</Text>
            <Text style={styles.sumPrice}>LKR {(job?.budget || 0).toLocaleString()}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('jobComplete.completionPhotos')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
          {[1, 2, 3].map((_, i) => (
            <View key={i} style={styles.photoThumb}>
              <Camera size={28} color={v3.colors.textMuted} />
              <Text style={styles.photoLabel}>{t('jobComplete.photo', { n: i + 1 })}</Text>
            </View>
          ))}
        </ScrollView>

        {confirmed ? (
          <View style={styles.confirmedBox}>
            <Sparkle size={28} color={v3.colors.success} weight="fill" />
            <Text style={styles.confirmedText}>{t('jobComplete.completedTitle')}</Text>
            <Text style={styles.confirmedSub}>
              {t('jobComplete.completedDesc', { amount: ((job?.budget || 0) * 1.05).toLocaleString() })}
            </Text>
          </View>
        ) : null}

        {error ? <Text style={styles.inlineError}>{error}</Text> : null}

        {!confirmed ? (
          <View style={styles.actionSection}>
            <Text style={styles.actionTitle}>{t('jobComplete.everythingDone')}</Text>
            <TouchableOpacity
              style={[styles.confirmBtn, completing && styles.disabled]}
              onPress={handleComplete}
              disabled={completing}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmBtnText}>
                {completing ? t('jobComplete.completing') : t('jobComplete.yesComplete')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.issueBtn}
              onPress={() => id && router.push(`/(customer)/jobs/dispute/${id}` as any)}
            >
              <Text style={styles.issueBtnText}>{t('jobComplete.reportIssue')}</Text>
            </TouchableOpacity>
            <View style={styles.escrowRow}>
              <Lock size={14} color={v3.colors.textMuted} />
              <Text style={styles.escrowNote}>{t('jobComplete.escrowHeld')}</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => id && router.push(`/(customer)/jobs/receipt/${id}` as any)}
          >
            <Text style={styles.nextBtnText}>{t('jobComplete.continueReceipt')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  scroll: { paddingHorizontal: 18, paddingBottom: 40 },
  errorWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: v3.colors.error, textAlign: 'center', fontFamily: fonts.body },
  header: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22 },
  successIcon: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: v3.colors.successSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  heading: { fontSize: 25, fontFamily: fonts.heading, color: v3.colors.textPrimary, marginBottom: 7, textAlign: 'center' },
  subtitle: { fontSize: 12, fontFamily: fonts.body, color: v3.colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  summaryCard: { backgroundColor: v3.colors.paper, padding: 16, borderRadius: v3.radius.lg, borderWidth: 1, borderColor: v3.colors.line, marginBottom: 20 },
  sumTitle: { fontSize: 17, fontFamily: fonts.headingBold, color: v3.colors.textPrimary, marginBottom: 12 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: v3.colors.line },
  lastRow: { borderBottomWidth: 0 },
  sumLabel: { fontSize: 12, fontFamily: fonts.body, color: v3.colors.textMuted },
  sumValue: { flex: 1, fontSize: 12, fontFamily: fonts.bodyMedium, color: v3.colors.textPrimary, textAlign: 'right' },
  sumPrice: { fontSize: 13, fontFamily: fonts.headingBold, color: v3.colors.amberDark },
  sectionTitle: { fontSize: 14, fontFamily: fonts.headingBold, color: v3.colors.textPrimary, marginBottom: 10 },
  photoRow: { gap: 10, paddingBottom: 20 },
  photoThumb: { width: 100, height: 100, borderRadius: 16, backgroundColor: v3.colors.surfaceGray, justifyContent: 'center', alignItems: 'center' },
  photoLabel: { fontSize: 10, color: v3.colors.textMuted, fontFamily: fonts.body, marginTop: 5 },
  confirmedBox: { backgroundColor: v3.colors.successSoft, padding: 18, borderRadius: v3.radius.lg, alignItems: 'center', marginBottom: 18 },
  confirmedText: { fontSize: 16, fontFamily: fonts.headingBold, color: v3.colors.success, marginTop: 8, marginBottom: 4 },
  confirmedSub: { fontSize: 12, fontFamily: fonts.body, color: v3.colors.textSecondary, textAlign: 'center' },
  inlineError: { color: v3.colors.error, fontFamily: fonts.body, textAlign: 'center', marginBottom: 12 },
  actionSection: { alignItems: 'center', paddingBottom: 20 },
  actionTitle: { fontSize: 14, fontFamily: fonts.bodyMedium, color: v3.colors.textPrimary, marginBottom: 14 },
  confirmBtn: { width: '100%', backgroundColor: v3.colors.ink, paddingVertical: 16, borderRadius: v3.radius.lg, alignItems: 'center', marginBottom: 10 },
  disabled: { opacity: 0.55 },
  confirmBtnText: { fontSize: 15, fontFamily: fonts.headingBold, color: v3.colors.paper },
  issueBtn: { width: '100%', backgroundColor: v3.colors.paper, paddingVertical: 15, borderRadius: v3.radius.lg, alignItems: 'center', borderWidth: 1, borderColor: v3.colors.error, marginBottom: 14 },
  issueBtnText: { fontSize: 14, fontFamily: fonts.bodySemiBold, color: v3.colors.error },
  escrowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  escrowNote: { fontSize: 11, fontFamily: fonts.body, color: v3.colors.textMuted, textAlign: 'center' },
  nextBtn: { backgroundColor: v3.colors.ink, paddingVertical: 16, borderRadius: v3.radius.lg, alignItems: 'center', marginTop: 2 },
  nextBtnText: { fontSize: 15, fontFamily: fonts.headingBold, color: v3.colors.paper },
})
