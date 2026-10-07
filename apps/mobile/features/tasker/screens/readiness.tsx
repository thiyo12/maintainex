import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CheckCircle, Briefcase, Lightning, MapPin, Clock, Warning, Check, CaretRight, CaretLeft } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { v3 } from '@/theme/v3/tokens'
import { v2Identity } from '@/api/v2-identity'
import { v2Availability } from '@/api/v2-taskers'
import { v2TaskerProfile } from '@/api/v2-taskers'

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
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><ActivityIndicator size="small" color={v3.colors.ink} /></View>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Warning size={36} color={v3.colors.textMuted} />
          <Text style={styles.errorTitle}>Unable to check readiness</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => { setError(false); setLoading(true); loadReadiness() }}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const stateLabel = (step: ReadinessStep) => {
    if (step.status === 'complete') return 'Complete'
    if (step.status === 'pending') return 'Pending'
    return 'Required'
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.circleButton} onPress={() => router.back()} activeOpacity={0.72}>
            <CaretLeft size={17} color={v3.colors.ink} weight="bold" />
          </TouchableOpacity>
          <Text style={styles.topLabel}>ALMOST READY</Text>
          <View style={styles.circlePlaceholder} />
        </View>

        <Text style={styles.hero}>{allComplete ? 'You’re ready to work' : 'Complete your setup'}</Text>
        <Text style={styles.subtitle}>
          {allComplete
            ? 'Your Tasker account has the core details needed to accept work.'
            : 'Finish the required items below before taking jobs.'}
        </Text>

        <View style={styles.progressCard}>
          <View style={styles.progressTop}>
            <Text style={styles.progressValue}>{completedCount}/{steps.length}</Text>
            <Text style={styles.progressLabel}>READY</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(completedCount / steps.length) * 100}%` }]} />
          </View>
        </View>

        <View style={styles.stepList}>
          {steps.map((step) => {
            const StepIcon = step.status === 'complete' ? Check : step.Icon
            const complete = step.status === 'complete'
            const pending = step.status === 'pending'
            return (
              <TouchableOpacity
                key={step.key}
                style={styles.stepRow}
                activeOpacity={0.72}
                onPress={() => router.push(step.screen as any)}
              >
                <View style={[styles.stepIcon, complete && styles.stepIconDone, pending && styles.stepIconPending]}>
                  <StepIcon
                    size={17}
                    color={complete ? v3.colors.success : pending ? v3.colors.amberDark : v3.colors.ink}
                    weight={complete ? 'bold' : 'regular'}
                  />
                </View>
                <View style={styles.stepCopy}>
                  <Text style={styles.stepTitle}>{t(step.labelKey)}</Text>
                  <Text style={styles.stepSub}>
                    {step.status === 'complete'
                      ? t(step.completeKey)
                      : step.status === 'pending' && step.pendingKey
                        ? t(step.pendingKey)
                        : t(step.missingKey)}
                  </Text>
                </View>
                <View style={[styles.statePill, complete && styles.statePillDone, pending && styles.statePillPending]}>
                  <Text style={[styles.stateText, complete && styles.stateTextDone, pending && styles.stateTextPending]}>{stateLabel(step)}</Text>
                </View>
                <CaretRight size={15} color={v3.colors.textMuted} weight="bold" />
              </TouchableOpacity>
            )
          })}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.78}
          onPress={() => {
            if (allComplete) router.replace('/(tasker)/(tabs)/index' as any)
            else if (firstIncomplete) router.push(firstIncomplete.screen as any)
          }}
        >
          <Text style={styles.primaryButtonText}>{allComplete ? 'Open Tasker Home' : 'Continue setup'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (_colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  center: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingBottom: 34 },
  topBar: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  circleButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  circlePlaceholder: { width: 38, height: 38 },
  topLabel: { fontSize: 9, letterSpacing: 0.8, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  hero: { marginTop: 12, fontSize: 28, lineHeight: 34, fontFamily: fonts.heading, color: v3.colors.ink, letterSpacing: -0.4 },
  subtitle: { marginTop: 7, maxWidth: 320, fontSize: 10.5, lineHeight: 16, fontFamily: fonts.bodySemiBold, color: v3.colors.textSecondary },
  progressCard: { minHeight: 94, marginTop: 24, borderRadius: 18, padding: 16, backgroundColor: v3.colors.ink },
  progressTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  progressValue: { fontSize: 26, fontFamily: fonts.heading, color: v3.colors.paper },
  progressLabel: { fontSize: 8.5, fontFamily: fonts.headingBold, color: v3.colors.amber },
  progressTrack: { height: 6, marginTop: 16, borderRadius: 3, backgroundColor: '#343434', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: v3.colors.success },
  stepList: { marginTop: 20 },
  stepRow: { minHeight: 68, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  stepIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center' },
  stepIconDone: { backgroundColor: v3.colors.successSoft },
  stepIconPending: { backgroundColor: v3.colors.amberSoft },
  stepCopy: { flex: 1, marginLeft: 10, paddingRight: 8 },
  stepTitle: { fontSize: 10.8, fontFamily: fonts.headingBold, color: v3.colors.ink },
  stepSub: { marginTop: 3, fontSize: 8.5, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted },
  statePill: { minHeight: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center' },
  statePillDone: { backgroundColor: v3.colors.successSoft },
  statePillPending: { backgroundColor: v3.colors.amberSoft },
  stateText: { fontSize: 7.8, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  stateTextDone: { color: v3.colors.success },
  stateTextPending: { color: v3.colors.amberDark },
  primaryButton: { minWidth: 132, height: 54, marginTop: 28, paddingHorizontal: 20, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 13, fontFamily: fonts.headingBold, color: v3.colors.paper },
  errorTitle: { marginTop: 12, fontSize: 14, fontFamily: fonts.headingBold, color: v3.colors.ink },
})
