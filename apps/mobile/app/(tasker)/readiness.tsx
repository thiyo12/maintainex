import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CheckCircle, Briefcase, Lightning, MapPin, Clock, Warning, Check, CaretRight } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../lib/ThemeContext'
import { fonts } from '../../lib/fonts'
import { v2Identity, v2Availability, v2TaskerProfile } from '../../lib/api-v2'

interface ReadinessStep {
  key: string
  labelKey: string
  completeKey: string
  missingKey: string
  pendingKey?: string
  Icon: any
  screen: string
  status: 'complete' | 'pending' | 'missing'
}

export default function TaskerReadinessScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [identityStatus, setIdentityStatus] = useState<string>('NOT_SUBMITTED')
  const [hasProfession, setHasProfession] = useState(false)
  const [hasSkills, setHasSkills] = useState(false)
  const [hasServiceArea, setHasServiceArea] = useState(false)
  const [hasAvailability, setHasAvailability] = useState(false)

  useEffect(() => {
    loadReadiness()
  }, [])

  const loadReadiness = async () => {
    try {
      const [idRes, availRes, profileRes] = await Promise.allSettled([
        v2Identity.getStatus(),
        v2Availability.get(),
        v2TaskerProfile.get(),
      ])

      if (idRes.status === 'fulfilled') {
        setIdentityStatus(idRes.value.identityStatus)
      }

      if (availRes.status === 'fulfilled') {
        const avail = availRes.value as any
        setHasAvailability(avail.isAvailable === true || avail.workDays?.length > 0)
      }

      if (profileRes.status === 'fulfilled' && profileRes.value) {
        const p = profileRes.value as any
        setHasProfession(!!p.professionId || (Array.isArray(p.skills) && p.skills.length > 0))
        setHasSkills(Array.isArray(p.skills) && p.skills.length > 0)
        setHasServiceArea(Array.isArray(p.serviceAreas) && p.serviceAreas.length > 0)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const isVerified = identityStatus === 'VERIFIED' || identityStatus === 'APPROVED'
  const isPending = identityStatus === 'PENDING'

  const steps: ReadinessStep[] = [
    {
      key: 'identity',
      labelKey: 'readiness.identity',
      completeKey: 'readiness.identityComplete',
      missingKey: 'readiness.identityMissing',
      pendingKey: 'readiness.identityPending',
      Icon: CheckCircle,
      screen: '/(tasker)/identity',
      status: isVerified ? 'complete' : isPending ? 'pending' : 'missing',
    },
    {
      key: 'profession',
      labelKey: 'readiness.profession',
      completeKey: 'readiness.professionComplete',
      missingKey: 'readiness.professionMissing',
      Icon: Briefcase,
      screen: '/(tasker)/settings/job-selection',
      status: hasProfession ? 'complete' : 'missing',
    },
    {
      key: 'skills',
      labelKey: 'readiness.skills',
      completeKey: 'readiness.skillsComplete',
      missingKey: 'readiness.skillsMissing',
      Icon: Lightning,
      screen: '/(tasker)/settings/job-selection',
      status: hasSkills ? 'complete' : 'missing',
    },
    {
      key: 'serviceArea',
      labelKey: 'readiness.serviceArea',
      completeKey: 'readiness.serviceAreaComplete',
      missingKey: 'readiness.serviceAreaMissing',
      Icon: MapPin,
      screen: '/(tasker)/settings/service-area',
      status: hasServiceArea ? 'complete' : 'missing',
    },
    {
      key: 'availability',
      labelKey: 'readiness.availability',
      completeKey: 'readiness.availabilityComplete',
      missingKey: 'readiness.availabilityMissing',
      Icon: Clock,
      screen: '/(tasker)/settings/availability',
      status: hasAvailability ? 'complete' : 'missing',
    },
  ]

  const completedCount = steps.filter(s => s.status === 'complete').length
  const allComplete = completedCount === steps.length
  const firstIncomplete = steps.find(s => s.status !== 'complete')

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#F5A623" style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Warning size={48} color="#6F6B6B" weight="regular" />
          <Text style={styles.errorText}>{t('common.error')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setError(false); setLoading(true); loadReadiness() }}>
            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <Text style={styles.heading}>{t('readiness.title')}</Text>
        <Text style={styles.subtitle}>{t('readiness.subtitle')}</Text>

        {/* Progress indicator */}
        <View style={styles.progressCard}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(completedCount / steps.length) * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>{t('readiness.stepOf', { current: completedCount, total: steps.length })}</Text>
        </View>

        {allComplete ? (
          <View style={styles.successCard}>
            <CheckCircle size={48} color="#059669" weight="fill" />
            <Text style={styles.successText}>{t('readiness.allComplete')}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>{t('readiness.notReady')}</Text>
            {steps.map((step) => {
              const StepIcon = step.status === 'complete' ? Check : step.Icon
              return (
                <TouchableOpacity
                  key={step.key}
                  style={[styles.stepCard, step.status === 'complete' && styles.stepCardComplete]}
                  onPress={() => router.push(step.screen as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.stepIcon, step.status === 'complete' && styles.stepIconComplete, step.status === 'pending' && styles.stepIconPending]}>
                    <StepIcon
                      size={20}
                      color={step.status === 'complete' ? '#fff' : step.status === 'pending' ? '#D4900A' : '#6F6B6B'}
                      weight={step.status === 'complete' ? 'fill' : 'regular'}
                    />
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={[styles.stepLabel, step.status === 'complete' && styles.stepLabelComplete]}>
                      {t(step.labelKey)}
                    </Text>
                    <Text style={[styles.stepStatus, step.status === 'complete' && styles.stepStatusComplete]}>
                      {step.status === 'complete'
                        ? t(step.completeKey)
                        : step.status === 'pending' && step.pendingKey
                          ? t(step.pendingKey)
                          : t(step.missingKey)}
                    </Text>
                  </View>
                  <CaretRight size={16} color="#6F6B6B" weight="bold" />
                </TouchableOpacity>
              )
            })}
          </>
        )}

        {firstIncomplete && !allComplete && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push(firstIncomplete.screen as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.primaryBtnText}>{t('readiness.completeSetup')}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  scroll: { paddingHorizontal: 24 },
  heading: { fontSize: 24, fontWeight: '800', color: '#000000', marginTop: 16 },
  subtitle: { fontSize: 14, color: '#6F6B6B', marginTop: 4, marginBottom: 20, lineHeight: 20 },

  progressCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E5E5E5' },
  progressBar: { height: 8, backgroundColor: '#E5E5E5', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: '#F5A623', borderRadius: 4 },
  progressText: { fontSize: 12, color: '#6F6B6B', fontFamily: fonts.bodyMedium },

  successCard: {
    backgroundColor: '#D1FAE5', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#A7F3D0',
  },
  successText: { fontSize: 16, fontWeight: '700', color: '#065F46', marginTop: 12, textAlign: 'center' },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#000000', marginBottom: 12 },

  stepCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14,
    padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#E5E5E5',
  },
  stepCardComplete: { borderColor: '#D1FAE5' },
  stepIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F1F1',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  stepIconComplete: { backgroundColor: '#059669' },
  stepIconPending: { backgroundColor: '#FEF3C7' },
  stepBody: { flex: 1 },
  stepLabel: { fontSize: 14, fontWeight: '700', color: '#000000' },
  stepLabelComplete: { color: '#065F46' },
  stepStatus: { fontSize: 12, color: '#6F6B6B', marginTop: 2 },
  stepStatusComplete: { color: '#059669' },

  primaryBtn: {
    backgroundColor: '#F5A623', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 16,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#000000' },

  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  errorText: { fontSize: 16, fontWeight: '700', color: '#000000', marginTop: 12, textAlign: 'center' },
  retryBtn: {
    backgroundColor: '#F5A623', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32, marginTop: 20,
  },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: '#000000' },
})
