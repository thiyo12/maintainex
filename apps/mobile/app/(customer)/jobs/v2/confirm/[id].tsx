import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../../../lib/colors'
import { fonts } from '../../../../../lib/fonts'
import { v2Jobs, v2JobActions } from '../../../../../lib/api-v2'
import Avatar from '../../../../../components/ui/Avatar'

export default function V2ConfirmBookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<any>(null)
  const [escrow, setEscrow] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')

  useEffect(() => { loadData() }, [id])

  const loadData = async () => {
    try {
      const res = await v2Jobs.get(id)
      setJob(res.job)
      setEscrow(res.job.escrow || null)
    } catch (e) {
      Alert.alert('Error', 'Failed to load booking')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const handleDeposit = async () => {
    setActionLoading('escrow')
    try {
      await v2JobActions.depositEscrow(id, job?.budgetAmount || 0)
      Alert.alert('Payment Frozen!', 'Payment is securely held. Share your address with the provider.', [
        { text: 'OK', onPress: () => router.push(`/(customer)/jobs/v2/${id}`) },
      ])
      loadData()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setActionLoading('')
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  const steps = [
    { label: 'Payment frozen', done: escrow !== null && escrow.status !== 'REFUNDED' },
    { label: 'Provider completes job', done: false },
    { label: 'You verify & confirm', done: false },
    { label: 'Payment released to provider', done: false },
  ]

  const acceptedQuote = job?.quotes?.find((q: any) => q.status === 'ACCEPTED')

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Booking</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Provider Info */}
        {acceptedQuote && (
          <View style={styles.providerSection}>
            <Text style={styles.sectionLabel}>Service Provider</Text>
            <View style={styles.providerRow}>
              <Avatar
                name={acceptedQuote.provider?.name || 'Provider'}
                size={52}
                color={acceptedQuote.providerType === 'COMPANY' ? colors.company : colors.amber}
              />
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>{acceptedQuote.provider?.name || 'Provider'}</Text>
                <Text style={styles.providerType}>{acceptedQuote.providerType}</Text>
              </View>
              <Text style={styles.providerPrice}>LKR {acceptedQuote.price.toLocaleString()}</Text>
            </View>
          </View>
        )}

        {/* Job Summary */}
        {job && (
          <View style={styles.jobSection}>
            <Text style={styles.sectionLabel}>Job</Text>
            <Text style={styles.jobTitle}>{job.title}</Text>
          </View>
        )}

        {/* Payment Freeze Card */}
        <View style={styles.freezeCard}>
          <View style={styles.freezeIconWrap}>
            <Text style={styles.freezeIcon}>🔐</Text>
          </View>
          <Text style={styles.freezeLabel}>Amount Frozen</Text>
          <Text style={styles.freezeAmount}>
            LKR {(acceptedQuote?.price || job?.budgetAmount || 0).toLocaleString()}
          </Text>
          <Text style={styles.freezeDesc}>
            Payment is securely held by Maintainex until job completion
          </Text>
          {!escrow && (
            <TouchableOpacity
              style={styles.depositBtn}
              onPress={handleDeposit}
              disabled={actionLoading !== ''}
            >
              {actionLoading === 'escrow' ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Text style={styles.depositBtnText}>Freeze Payment</Text>
              )}
            </TouchableOpacity>
          )}
          {escrow && escrow.status === 'PROTECTED' && (
            <View style={styles.frozenBadge}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.frozenBadgeText}>Payment Frozen</Text>
            </View>
          )}
        </View>

        {/* 4-Step Payment Flow */}
        <View style={styles.stepsSection}>
          <Text style={styles.sectionLabel}>Payment Flow</Text>
          {steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepLeft}>
                <View style={[styles.stepDot, step.done && styles.stepDotDone]}>
                  {step.done ? (
                    <Ionicons name="checkmark" size={14} color={colors.white} />
                  ) : (
                    <Text style={styles.stepNum}>{i + 1}</Text>
                  )}
                </View>
                {i < steps.length - 1 && <View style={[styles.stepLine, step.done && styles.stepLineDone]} />}
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepLabel, step.done && styles.stepLabelDone]}>{step.label}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backText: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.amber },
  headerTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.ink },
  content: { flex: 1, paddingHorizontal: 20 },

  sectionLabel: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  providerSection: { marginTop: 16 },
  providerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 14, padding: 16, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  providerInfo: { flex: 1, marginLeft: 12 },
  providerName: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.ink },
  providerType: { fontSize: 12, fontFamily: fonts.body, color: colors.muted, marginTop: 2 },
  providerPrice: { fontSize: 18, fontFamily: fonts.heading, color: colors.primaryDark },

  jobSection: { marginTop: 16 },
  jobTitle: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.ink },

  freezeCard: { backgroundColor: colors.ink, borderRadius: 20, padding: 24, alignItems: 'center', marginTop: 20 },
  freezeIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.amberBg, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  freezeIcon: { fontSize: 28 },
  freezeLabel: { fontSize: 13, fontFamily: fonts.body, color: colors.muted, marginBottom: 4 },
  freezeAmount: { fontSize: 28, fontFamily: fonts.heading, color: colors.amber, marginBottom: 8 },
  freezeDesc: { fontSize: 12, fontFamily: fonts.bodyLight, color: colors.muted, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  depositBtn: { backgroundColor: colors.amber, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 14, width: '100%', alignItems: 'center' },
  depositBtnText: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.ink },
  frozenBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  frozenBadgeText: { fontSize: 14, fontFamily: fonts.headingBold, color: colors.success },

  stepsSection: { marginTop: 24, marginBottom: 40 },
  stepRow: { flexDirection: 'row', marginBottom: 4 },
  stepLeft: { alignItems: 'center', width: 32, marginRight: 12 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  stepDotDone: { backgroundColor: colors.success },
  stepNum: { fontSize: 12, fontFamily: fonts.headingBold, color: colors.muted },
  stepLine: { width: 2, height: 28, backgroundColor: colors.border },
  stepLineDone: { backgroundColor: colors.success },
  stepContent: { paddingTop: 4, flex: 1 },
  stepLabel: { fontSize: 14, fontFamily: fonts.body, color: colors.muted },
  stepLabelDone: { color: colors.ink, fontFamily: fonts.headingBold },
})
