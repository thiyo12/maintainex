import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../../../lib/colors'
import { jobs, disputes } from '../../../../lib/api'
import { useAuth } from '../../../../lib/auth'
import { JobPosting } from '../../../../lib/types'

const disputeReasons = [
  { key: 'incomplete', label: 'Work not completed' },
  { key: 'quality', label: 'Poor quality of work' },
  { key: 'damage', label: 'Property damage' },
  { key: 'price', label: 'Price disagreement' },
  { key: 'behavior', label: 'Unprofessional behavior' },
  { key: 'other', label: 'Other' },
]

export default function DisputeScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const { user } = useAuth()
  const [job, setJob] = useState<JobPosting | null>(null)
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
    jobs.get(id as string)
      .then(setJob)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const handleNext = () => {
    if (step === 0 && !reason) {
      Alert.alert('Error', 'Please select a reason')
      return
    }
    if (step === 1 && !description.trim()) {
      Alert.alert('Error', 'Please describe the issue')
      return
    }
    if (step < 2) setStep(step + 1)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await disputes.create({ jobId: id as string, reason, description })
      setDisputeId(res.id)
      setSubmitted(true)
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit dispute')
    } finally {
      setSubmitting(false)
    }
  }

  const taskerName = job?.assignedTasker?.user?.name || 'Tasker'
  const jobTitle = job?.title || 'Job'
  const escrowAmount = ((job?.budget || 0) * 1.05)

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: colors.red, textAlign: 'center' }}>{error}</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successCircle}>
            <Text style={styles.successIcon}>📋</Text>
          </View>
          <Text style={styles.successTitle}>Dispute filed</Text>
          <Text style={styles.successSub}>
            We've received your dispute. Our support team will review it within 24-48 hours and contact you via email.
          </Text>
          <View style={styles.ticketBox}>
            <Text style={styles.ticketLabel}>Dispute ID</Text>
            <Text style={styles.ticketId}>#{disputeId}</Text>
          </View>
          <Text style={styles.refundNote}>
            🔒 Funds remain in escrow until the dispute is resolved.
          </Text>
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => router.replace('/(customer)')}
          >
            <Text style={styles.homeBtnText}>Back to home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => step > 0 ? setStep(step - 1) : router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.headerRow}>
        <Text style={styles.heading}>Report an issue</Text>
        <Text style={styles.stepIndicator}>Step {step + 1} of 3</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {step === 0 ? (
          <View>
            <Text style={styles.sectionLabel}>What went wrong?</Text>
            <Text style={styles.sectionSub}>Select the reason for your dispute</Text>
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
            <Text style={styles.sectionLabel}>Describe the issue</Text>
            <Text style={styles.sectionSub}>Please provide details about what happened</Text>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={styles.textArea}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what went wrong in detail..."
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <Text style={styles.fieldLabel}>What would be a fair resolution?</Text>
            <TextInput
              style={styles.textArea}
              value={expectation}
              onChangeText={setExpectation}
              placeholder="e.g. Full refund, partial refund, redo the work..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        ) : (
          <View>
            <Text style={styles.sectionLabel}>Review your dispute</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Job</Text>
                <Text style={styles.summaryValue}>{jobTitle}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tasker</Text>
                <Text style={styles.summaryValue}>{taskerName}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Reason</Text>
                <Text style={styles.summaryValue}>
                  {disputeReasons.find((r) => r.key === reason)?.label}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount in escrow</Text>
                <Text style={styles.summaryPrice}>LKR {escrowAmount.toLocaleString()}</Text>
              </View>
            </View>
            <View style={styles.descriptionBox}>
              <Text style={styles.descLabel}>Description</Text>
              <Text style={styles.descText}>{description}</Text>
            </View>
            {expectation ? (
              <View style={styles.descriptionBox}>
                <Text style={styles.descLabel}>Expected resolution</Text>
                <Text style={styles.descText}>{expectation}</Text>
              </View>
            ) : null}
            <View style={styles.warningBox}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={styles.warningText}>
                False or fraudulent disputes may result in account suspension. Please ensure your claim is accurate.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.nextBtn, step === 2 && { backgroundColor: colors.red }]}
        onPress={step === 2 ? handleSubmit : handleNext}
        disabled={submitting}
      >
        <Text style={styles.nextBtnText}>
          {submitting ? 'Submitting...' : step === 0 ? 'Next' : step === 1 ? 'Review dispute' : 'Submit dispute'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  backBtn: { paddingHorizontal: 24, paddingTop: 8 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark },
  stepIndicator: { fontSize: 13, color: colors.gray, fontWeight: '600' },
  scroll: { paddingHorizontal: 24 },
  sectionLabel: { fontSize: 18, fontWeight: '700', color: colors.dark, marginBottom: 4 },
  sectionSub: { fontSize: 14, color: colors.gray, marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: colors.dark, marginTop: 16, marginBottom: 8 },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
  },
  reasonCardActive: {
    borderColor: colors.red,
    backgroundColor: '#FEF2F2',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  radioActive: { borderColor: colors.red },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.red,
  },
  reasonLabel: { fontSize: 15, fontWeight: '600', color: colors.dark },
  reasonLabelActive: { color: colors.red },
  textArea: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.dark,
    textAlignVertical: 'top',
  },
  summaryCard: {
    backgroundColor: colors.white,
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
    borderBottomColor: colors.lightGray,
  },
  summaryLabel: { fontSize: 14, color: colors.gray },
  summaryValue: { fontSize: 14, fontWeight: '600', color: colors.dark },
  summaryPrice: { fontSize: 14, fontWeight: '700', color: colors.red },
  descriptionBox: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
  },
  descLabel: { fontSize: 13, fontWeight: '700', color: colors.dark, marginBottom: 6 },
  descText: { fontSize: 14, color: colors.gray, lineHeight: 20 },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    gap: 10,
    marginBottom: 100,
  },
  warningIcon: { fontSize: 18 },
  warningText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },
  nextBtn: {
    backgroundColor: colors.red,
    marginHorizontal: 24,
    marginBottom: 32,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  nextBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
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
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  successIcon: { fontSize: 36 },
  successTitle: { fontSize: 26, fontWeight: '800', color: colors.dark, marginBottom: 8 },
  successSub: { fontSize: 15, color: colors.gray, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  ticketBox: {
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  ticketLabel: { fontSize: 12, color: colors.gray, marginBottom: 4 },
  ticketId: { fontSize: 16, fontWeight: '700', color: colors.dark },
  refundNote: { fontSize: 13, color: colors.gray, textAlign: 'center', marginBottom: 32 },
  homeBtn: {
    width: '100%',
    backgroundColor: colors.customerAccent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  homeBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
})
