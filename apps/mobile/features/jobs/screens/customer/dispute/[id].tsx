import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FileText, Lock, WarningCircle } from 'phosphor-react-native'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { useTranslation } from 'react-i18next'
import { v2JobActions, v2Jobs } from '@/api/v2-jobs'
import type { V2Job } from '@/api/v2-types'
import { useAuth } from '@/features/auth/context/auth'

export default function DisputeScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const { user } = useAuth()
  const [job, setJob] = useState<V2Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [expectation, setExpectation] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [disputeId, setDisputeId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    v2Jobs.get(id as string)
      .then((res) => setJob(res.job))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const handleNext = () => {
    if (step === 0 && !reason) {
      Alert.alert(t('common.error'), t('errors.selectReason'))
      return
    }
    if (step === 1 && !description.trim()) {
      Alert.alert(t('common.error'), t('errors.describeIssue'))
      return
    }
    if (step < 2) setStep(step + 1)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const resolutionContext = expectation.trim()
        ? `${description.trim()}\n\nRequested resolution: ${expectation.trim()}`
        : description.trim()
      const res = await v2JobActions.dispute(id as string, reason, resolutionContext)
      setDisputeId(res.disputeId || (id as string))
      setSubmitted(true)
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || t('common.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const reasonLabels = t('dispute.reasons', { returnObjects: true }) as string[]
  const disputeReasons = [
    ...reasonLabels.map((label, i) => ({ key: ['incomplete', 'quality', 'damage', 'price', 'behavior', 'other'][i], label })),
    { key: 'SAFETY_IMMEDIATE_DANGER', label: 'Immediate danger or threat' },
    { key: 'SAFETY_THREAT_OR_HARASSMENT', label: 'Threats or harassment' },
    { key: 'SAFETY_INJURY', label: 'Injury during the job' },
    { key: 'SAFETY_UNSAFE_WORK', label: 'Unsafe work or hazardous conditions' },
    { key: 'SAFETY_IDENTITY_MISMATCH', label: 'Worker identity does not match profile' },
  ]

  const taskerName = job?.acceptedQuote?.provider?.name || t('dispute.tasker')
  const jobTitle = job?.title || t('dispute.job')
  const escrowAmount = job?.escrow?.totalAmount ?? job?.budgetAmount ?? 0
  const escrowCurrency = job?.escrow?.currency || (job?.countryCode === 'CA' ? 'CAD' : 'LKR')

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

  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successCircle}>
            <FileText size={36} color="#FFFFFF" weight="regular" />
          </View>
          <Text style={styles.successTitle}>{t('dispute.submitted')}</Text>
          <Text style={styles.successSub}>
            {t('dispute.submittedDesc')}
          </Text>
          <View style={styles.ticketBox}>
            <Text style={styles.ticketLabel}>{t('dispute.disputeId')}</Text>
            <Text style={styles.ticketId}>#{disputeId}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
            <Lock size={14} color="#6F6B6B" weight="regular" />
            <Text style={styles.refundNote}>{t('dispute.escrowHeld')}</Text>
          </View>
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => router.replace('/(customer)')}
          >
            <Text style={styles.homeBtnText}>{t('dispute.backToHome')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => step > 0 ? setStep(step - 1) : router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← {t('common.back')}</Text>
      </TouchableOpacity>

      <View style={styles.headerRow}>
        <Text style={styles.heading}>{t('dispute.title')}</Text>
        <Text style={styles.stepIndicator}>{t('dispute.step', { n: step + 1 })}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {step === 0 ? (
          <View>
            <Text style={styles.sectionLabel}>{t('dispute.whatWentWrong')}</Text>
            <Text style={styles.sectionSub}>{t('dispute.selectReason')}</Text>
            {disputeReasons.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[styles.reasonCard, reason === r.key && styles.reasonCardActive]}
                onPress={() => setReason(r.key)}
              >
                <View style={[styles.radio, reason === r.key && styles.radioActive]}>
                  {reason === r.key ? <View style={styles.radioInner} /> : null}
                </View>
                <Text style={[styles.reasonLabel, reason === r.key && styles.reasonLabelActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : step === 1 ? (
          <View>
            <Text style={styles.sectionLabel}>{t('dispute.describeIssue')}</Text>
            <Text style={styles.sectionSub}>{t('dispute.describeIssueDesc')}</Text>
            <Text style={styles.fieldLabel}>{t('dispute.description')}</Text>
            <TextInput
              style={styles.textArea}
              value={description}
              onChangeText={setDescription}
              placeholder={t('dispute.descriptionPlaceholder')}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <Text style={styles.fieldLabel}>{t('dispute.fairResolution')}</Text>
            <TextInput
              style={styles.textArea}
              value={expectation}
              onChangeText={setExpectation}
              placeholder={t('dispute.resolutionPlaceholder')}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        ) : (
          <View>
            <Text style={styles.sectionLabel}>{t('dispute.reviewDispute')}</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('dispute.job')}</Text>
                <Text style={styles.summaryValue}>{jobTitle}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('dispute.tasker')}</Text>
                <Text style={styles.summaryValue}>{taskerName}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('dispute.reason')}</Text>
                <Text style={styles.summaryValue}>
                  {disputeReasons.find((r) => r.key === reason)?.label}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('dispute.escrowAmount')}</Text>
                <Text style={styles.summaryPrice}>{escrowCurrency} {escrowAmount.toLocaleString()}</Text>
              </View>
            </View>
            <View style={styles.descriptionBox}>
                <Text style={styles.descLabel}>{t('dispute.description')}</Text>
                <Text style={styles.descText}>{description}</Text>
              </View>
              {expectation ? (
                <View style={styles.descriptionBox}>
                  <Text style={styles.descLabel}>{t('dispute.expectedResolution')}</Text>
                <Text style={styles.descText}>{expectation}</Text>
              </View>
            ) : null}
            <View style={styles.warningBox}>
              <WarningCircle size={18} color="#F5A623" weight="fill" />
              <Text style={styles.warningText}>
                {t('dispute.warning')}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.nextBtn, step === 2 && { backgroundColor: '#E11900' }]}
        onPress={step === 2 ? handleSubmit : handleNext}
        disabled={submitting}
      >
        <Text style={styles.nextBtnText}>
          {submitting ? t('dispute.submitting') : step === 0 ? t('dispute.next') : step === 1 ? t('dispute.reviewBtn') : t('dispute.submitBtn')}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  backBtn: { paddingHorizontal: 24, paddingTop: 8 },
  backText: { fontSize: 16, color: '#F5A623', fontFamily: fonts.body },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  heading: { fontSize: 28, fontFamily: fonts.heading, color: '#FFFFFF' },
  stepIndicator: { fontSize: 13, color: '#6F6B6B', fontFamily: fonts.body },
  scroll: { paddingHorizontal: 24 },
  sectionLabel: { fontSize: 18, fontFamily: fonts.bodyMedium, color: '#FFFFFF', marginBottom: 4 },
  sectionSub: { fontSize: 14, color: '#6F6B6B', marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontFamily: fonts.bodyMedium, color: '#FFFFFF', marginTop: 16, marginBottom: 8 },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#2E2E2E',
  },
  reasonCardActive: {
    borderColor: '#E11900',
    backgroundColor: '#E1190015',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#2E2E2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  radioActive: { borderColor: '#E11900' },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E11900',
  },
  reasonLabel: { fontSize: 15, fontFamily: fonts.body, color: '#0D0D0D' },
  reasonLabelActive: { color: '#E11900' },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#2E2E2E',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#0D0D0D',
    textAlignVertical: 'top',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2E2E2E',
  },
  summaryLabel: { fontSize: 14, color: '#6F6B6B' },
  summaryValue: { fontSize: 14, fontFamily: fonts.body, color: '#0D0D0D' },
  summaryPrice: { fontSize: 14, fontFamily: fonts.bodyMedium, color: '#E11900' },
  descriptionBox: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
  },
  descLabel: { fontSize: 13, fontFamily: fonts.bodyMedium, color: '#0D0D0D', marginBottom: 6 },
  descText: { fontSize: 14, color: '#6F6B6B', lineHeight: 20 },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#F5A62315',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    gap: 10,
    marginBottom: 100,
  },
  warningText: { flex: 1, fontSize: 12, color: '#F5A623', lineHeight: 18 },
  nextBtn: {
    backgroundColor: '#E11900',
    marginHorizontal: 24,
    marginBottom: 32,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  nextBtnText: { fontSize: 17, fontFamily: fonts.bodyMedium, color: '#FFFFFF' },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F5A623',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  successTitle: { fontSize: 26, fontFamily: fonts.heading, color: '#FFFFFF', marginBottom: 8 },
  successSub: { fontSize: 15, color: '#6F6B6B', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  ticketBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  ticketLabel: { fontSize: 12, color: '#6F6B6B', marginBottom: 4 },
  ticketId: { fontSize: 16, fontFamily: fonts.bodyMedium, color: '#0D0D0D' },
  refundNote: { fontSize: 13, color: '#6F6B6B', textAlign: 'center' },
  homeBtn: {
    width: '100%',
    backgroundColor: '#F5A623',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  homeBtnText: { fontSize: 17, fontFamily: fonts.bodyMedium, color: '#FFFFFF' },
})
