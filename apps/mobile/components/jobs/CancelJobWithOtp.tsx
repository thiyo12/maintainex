import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { ShieldCheck, WarningCircle } from 'phosphor-react-native'
import { v2JobActions } from '../../lib/api-v2'
import { v3 } from '../../theme/v3/tokens'

export default function CancelJobWithOtp({
  jobId,
  onDone,
  initialReason = '',
}: {
  jobId: string
  onDone: () => void
  initialReason?: string
}) {
  const [reason, setReason] = useState(initialReason)
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'reason' | 'code'>('reason')
  const [loading, setLoading] = useState(false)

  const requestCode = async () => {
    setLoading(true)
    try {
      const result = await v2JobActions.requestCancelCode(jobId, reason.trim())
      setStep('code')
      Alert.alert(
        'Cancellation code sent',
        result.testMode
          ? 'Demo mode: use 000000.'
          : 'Enter the 6-digit code sent to your verified mobile number.',
      )
    } catch (error: any) {
      Alert.alert('Cannot cancel job', error?.message || 'Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const confirm = async () => {
    if (!/^\d{6}$/.test(code)) {
      Alert.alert('Enter the code', 'Enter the 6-digit cancellation code.')
      return
    }

    setLoading(true)
    try {
      const result = await v2JobActions.confirmCancel(jobId, code, reason.trim())
      Alert.alert(
        'Job cancelled',
        result.refundAmount > 0
          ? `The protected payment was returned to the customer wallet (LKR ${result.refundAmount.toLocaleString()}).`
          : 'The job was cancelled before work started.',
        [{ text: 'Done', onPress: onDone }],
      )
    } catch (error: any) {
      Alert.alert('Cancellation failed', error?.message || 'Please check the code and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View>
      <View style={styles.warning}>
        <WarningCircle size={22} color={v3.colors.error} weight="fill" />
        <View style={styles.warningCopy}>
          <Text style={styles.warningTitle}>Cancel only before work starts</Text>
          <Text style={styles.warningText}>
            Once the work-start PIN is verified, cancellation is disabled and the dispute process must be used.
          </Text>
        </View>
      </View>

      <Text style={styles.label}>Reason</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        editable={step === 'reason' && !loading}
        placeholder="Briefly explain why you are cancelling"
        placeholderTextColor={v3.colors.textPlaceholder}
        multiline
        maxLength={500}
        textAlignVertical="top"
        style={styles.reasonInput}
      />

      {step === 'code' ? (
        <>
          <View style={styles.securityRow}>
            <ShieldCheck size={18} color={v3.colors.success} weight="fill" />
            <Text style={styles.securityText}>A fresh OTP is required to protect both sides.</Text>
          </View>
          <Text style={styles.label}>6-digit cancellation code</Text>
          <TextInput
            value={code}
            onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor={v3.colors.textPlaceholder}
            style={styles.codeInput}
          />
        </>
      ) : null}

      <TouchableOpacity
        style={[styles.button, loading && styles.disabled]}
        disabled={loading}
        onPress={step === 'reason' ? requestCode : confirm}
      >
        {loading
          ? <ActivityIndicator size="small" color={v3.colors.paper} />
          : <Text style={styles.buttonText}>{step === 'reason' ? 'Send cancellation code' : 'Confirm cancellation'}</Text>}
      </TouchableOpacity>

      {step === 'code' ? (
        <TouchableOpacity style={styles.backButton} onPress={() => { setStep('reason'); setCode('') }} disabled={loading}>
          <Text style={styles.backText}>Change reason / resend</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: v3.colors.errorSoft,
    borderRadius: 18,
    padding: 14,
  },
  warningCopy: { flex: 1, marginLeft: 9 },
  warningTitle: { ...v3.typography.bodyBold, color: v3.colors.ink },
  warningText: { ...v3.typography.caption, color: v3.colors.textSecondary, lineHeight: 17, marginTop: 3 },
  label: { ...v3.typography.captionBold, color: v3.colors.textSecondary, marginTop: 16, marginBottom: 6 },
  reasonInput: {
    minHeight: 110,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: v3.colors.line,
    backgroundColor: v3.colors.paper,
    padding: 14,
    color: v3.colors.ink,
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: v3.colors.successSoft,
    borderRadius: 15,
    padding: 12,
    marginTop: 12,
  },
  securityText: { ...v3.typography.caption, color: v3.colors.textSecondary, marginLeft: 8, flex: 1 },
  codeInput: {
    height: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: v3.colors.line,
    backgroundColor: v3.colors.paper,
    paddingHorizontal: 14,
    color: v3.colors.ink,
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
  },
  button: {
    height: 54,
    borderRadius: 16,
    backgroundColor: v3.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  disabled: { opacity: 0.55 },
  buttonText: { ...v3.typography.bodyLarge, color: v3.colors.paper },
  backButton: { alignItems: 'center', paddingVertical: 14 },
  backText: { ...v3.typography.captionBold, color: v3.colors.textMuted },
})
