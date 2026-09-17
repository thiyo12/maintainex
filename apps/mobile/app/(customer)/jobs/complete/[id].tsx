import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Animated } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CheckCircle, Camera, Sparkle, Lock } from 'phosphor-react-native'
import { useColors } from '../../../../lib/ThemeContext'
import { fonts } from '../../../../lib/fonts'
import { useTranslation } from 'react-i18next'
import { jobs } from '../../../../lib/api'
import { v2Jobs, v2JobActions } from '../../../../lib/api-v2'
import { useAuth } from '../../../../lib/auth'
import { JobPosting } from '../../../../lib/types'

export default function JobCompleteScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const { user } = useAuth()
  const [job, setJob] = useState<JobPosting | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [isV2, setIsV2] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    v2Jobs.get(id as string)
      .then((res) => {
        const v2 = res.job
        setIsV2(true)
        setJob({
          id: v2.id,
          title: v2.title,
          description: v2.description,
          category: v2.categoryId,
          budget: v2.budgetAmount ?? null,
          location: v2.locationName || '',
          status: v2.status,
          scheduledDate: v2.preferredDate || undefined,
          createdAt: v2.createdAt,
          customer: v2.customer,
          bids: [],
          assignedTasker: v2.acceptedQuote?.provider ? {
            id: v2.acceptedQuote.provider.id,
            userId: v2.acceptedQuote.provider.id,
            rating: v2.acceptedQuote.providerRating || 0,
            completedJobs: 0,
            hourlyRate: 0,
            user: v2.acceptedQuote.provider,
          } : null,
        } as JobPosting)
      })
      .catch(() => {
        jobs.get(id as string)
          .then(setJob)
          .catch((e) => setError(e.message))
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleComplete = async () => {
    setCompleting(true)
    try {
      if (isV2) {
        await v2JobActions.complete(id as string, 'APPROVE_COMPLETION')
      } else {
        await jobs.complete(id as string)
      }
      setConfirmed(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCompleting(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#F5A623" style={{ flex: 1 }} />
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: '#E11900', textAlign: 'center' }}>{error}</Text>
        </View>
      </SafeAreaView>
    )
  }

  const taskerName = job?.assignedTasker?.user?.name || t('jobComplete.tasker')
  const taskerInfo = job?.assignedTasker?.skills?.length
    ? job.assignedTasker.skills.join(', ')
    : ''
  const taskerDisplay = taskerInfo ? `${taskerName} • ${taskerInfo}` : taskerName
  const formattedDate = job?.scheduledDate
    ? new Date(job.scheduledDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <CheckCircle size={52} color="#06C167" weight="fill" style={{ marginBottom: 12 }} />
          <Text style={styles.heading}>{t('jobComplete.jobInReview')}</Text>
          <Text style={styles.subtitle}>
            {t('jobComplete.jobInReviewDesc')}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.sumTitle}>{job?.title || t('home.untitledJob')}</Text>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>{t('jobComplete.tasker')}</Text>
            <Text style={styles.sumValue}>{taskerDisplay}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>{t('jobComplete.location')}</Text>
            <Text style={styles.sumValue}>{job?.location || ''}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>{t('jobComplete.date')}</Text>
            <Text style={styles.sumValue}>{formattedDate}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>{t('jobComplete.quoted')}</Text>
            <Text style={styles.sumPrice}>LKR {(job?.budget || 0).toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.photosSection}>
          <Text style={styles.photoSectionTitle}>{t('jobComplete.completionPhotos')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
            {[1, 2, 3].map((_, i) => (
              <View key={i} style={styles.photoThumb}>
                <Camera size={32} color="#6F6B6B" weight="regular" />
                <Text style={styles.photoLabel}>{t('jobComplete.photo', { n: i + 1 })}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {confirmed ? (
          <View style={styles.confirmedBox}>
            <Sparkle size={32} color="#06C167" weight="fill" style={{ marginBottom: 8 }} />
            <Text style={styles.confirmedText}>{t('jobComplete.completedTitle')}</Text>
            <Text style={styles.confirmedSub}>
              {t('jobComplete.completedDesc', { amount: ((job?.budget || 0) * 1.05).toLocaleString() })}
            </Text>
          </View>
        ) : null}

        <View style={styles.actionSection}>
          <Text style={styles.actionTitle}>{t('jobComplete.everythingDone')}</Text>
          <TouchableOpacity
            style={[styles.confirmBtn, completing && { opacity: 0.6 }]}
            onPress={handleComplete}
            disabled={completing}
          >
            <Text style={styles.confirmBtnText}>
              {completing ? t('jobComplete.completing') : t('jobComplete.yesComplete')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.issueBtn}
            onPress={() => router.push('/(customer)/jobs/dispute/' + id as any)}
          >
            <Text style={styles.issueBtnText}>{t('jobComplete.reportIssue')}</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
            <Lock size={14} color="#6F6B6B" weight="regular" />
            <Text style={[styles.escrowNote, { marginTop: 0 }]}>{t('jobComplete.escrowHeld')}</Text>
          </View>
        </View>
      </ScrollView>

      {confirmed ? (
        <TouchableOpacity
          style={styles.nextBtn}
            onPress={() => router.push('/(customer)/jobs/receipt/' + id as any)}
        >
          <Text style={styles.nextBtnText}>{t('jobComplete.continueReceipt')}</Text>
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  backBtn: { paddingHorizontal: 24, paddingTop: 8 },
  backText: { fontSize: 16, color: '#F5A623', fontFamily: fonts.body },
  header: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 16, paddingBottom: 20 },
  heading: { fontSize: 24, fontFamily: fonts.heading, color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6F6B6B', textAlign: 'center', lineHeight: 20 },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sumTitle: { fontSize: 17, fontFamily: fonts.bodyMedium, color: '#0D0D0D', marginBottom: 12 },
  sumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2E2E2E',
  },
  sumLabel: { fontSize: 14, color: '#6F6B6B' },
  sumValue: { fontSize: 14, fontFamily: fonts.body, color: '#0D0D0D' },
  sumPrice: { fontSize: 14, fontFamily: fonts.bodyMedium, color: '#F5A623' },
  photosSection: {
    marginHorizontal: 24,
    marginBottom: 16,
  },
  photoSectionTitle: { fontSize: 14, fontFamily: fonts.bodyMedium, color: '#FFFFFF', marginBottom: 10 },
  photoRow: { gap: 10 },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#2E2E2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  photoLabel: { fontSize: 11, color: '#6F6B6B', fontFamily: fonts.bodyLight },
  confirmedBox: {
    backgroundColor: '#06C16720',
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmedText: { fontSize: 16, fontFamily: fonts.bodyMedium, color: '#06C167', marginBottom: 4 },
  confirmedSub: { fontSize: 13, color: '#6F6B6B', textAlign: 'center' },
  actionSection: {
    marginHorizontal: 24,
    paddingBottom: 100,
    alignItems: 'center',
  },
  actionTitle: { fontSize: 15, fontFamily: fonts.body, color: '#FFFFFF', marginBottom: 16 },
  confirmBtn: {
    width: '100%',
    backgroundColor: '#06C167',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmBtnText: { fontSize: 16, fontFamily: fonts.bodyMedium, color: '#FFFFFF' },
  issueBtn: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E11900',
    marginBottom: 16,
  },
  issueBtnText: { fontSize: 16, fontFamily: fonts.body, color: '#E11900' },
  escrowNote: { fontSize: 12, color: '#6F6B6B', textAlign: 'center', lineHeight: 18 },
  nextBtn: {
    backgroundColor: '#F5A623',
    marginHorizontal: 24,
    marginBottom: 32,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  nextBtnText: { fontSize: 17, fontFamily: fonts.bodyMedium, color: '#FFFFFF' },
})
