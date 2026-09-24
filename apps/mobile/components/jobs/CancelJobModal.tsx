import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { WarningCircle } from 'phosphor-react-native'
import { v2JobActions } from '../../lib/api-v2'
import { v3 } from '../../theme/v3/tokens'

type Props = {
  visible: boolean
  jobId: string
  jobTitle?: string
  onClose: () => void
  onCancelled: (refundAmount: number) => void | Promise<void>
}

export default function CancelJobModal({ visible, jobId, jobTitle, onClose, onCancelled }: Props) {
  const [step, setStep] = useState<'reason' | 'otp'>('reason')
  const [reason, setReason] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [testMode, setTestMode] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) {
      setStep('reason')
      setReason('')
      setCode('')
      setTestMode(false)
      setError('')
      setLoading(false)
    }
  }, [visible])

  const requestCode = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await v2JobActions.requestCancellation(
        jobId,
        reason.trim() || 'Provider cancelled before work start',
      )
      setTestMode(!!result.testMode)
      setStep('otp')
    } catch (err: any) {
      setError(err?.message || 'Unable to send cancellation code.')
    } finally {
      setLoading(false)
    }
  }

  const confirm = async () => {
    if (code.length !== 6) {
      setError('Enter the 6-digit verification code.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await v2JobActions.confirmCancellation(
        jobId,
        code,
        reason.trim() || 'Provider cancelled before work start',
      )
      await onCancelled(Number(result.refundAmount || 0))
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Unable to cancel this job.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.icon}>
            <WarningCircle size={28} color={v3.colors.error} weight="fill" />
          </View>
          <Text style={styles.title}>{step === 'reason' ? 'Cancel before work starts' : 'Verify cancellation'}</Text>
          <Text style={styles.subtitle}>
            {step === 'reason'
              ? `Cancel ${jobTitle || 'this job'} only if work has not started. Protected customer funds are refunded automatically.`
              : 'Enter the 6-digit code sent to your verified phone or email.'}
          </Text>

          {step === 'reason' ? (
            <TextInput
              value={reason}
              onChangeText={setReason}
              style={[styles.input, styles.reason]}
              multiline
              textAlignVertical="top"
              maxLength={500}
              placeholder="Reason for cancellation"
              placeholderTextColor={v3.colors.textPlaceholder}
            />
          ) : (
            <>
              <TextInput
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                style={[styles.input, styles.code]}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
                placeholderTextColor={v3.colors.textPlaceholder}
              />
              {testMode ? <Text style={styles.testNote}>Demo test mode is active for this account.</Text> : null}
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.keep} onPress={onClose} disabled={loading}>
              <Text style={styles.keepText}>Keep job</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirm, loading && styles.disabled]}
              onPress={step === 'reason' ? requestCode : confirm}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator size="small" color={v3.colors.paper} />
                : <Text style={styles.confirmText}>{step === 'reason' ? 'Send code' : 'Confirm cancel'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: v3.colors.paper,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: 34,
  },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: v3.colors.line, marginBottom: 18 },
  icon: { width: 52, height: 52, borderRadius: 18, backgroundColor: v3.colors.errorSoft, alignItems: 'center', justifyContent: 'center' },
  title: { ...v3.typography.h5, color: v3.colors.ink, marginTop: 14 },
  subtitle: { ...v3.typography.caption, color: v3.colors.textSecondary, lineHeight: 18, marginTop: 5 },
  input: { marginTop: 16, borderWidth: 1, borderColor: v3.colors.line, backgroundColor: v3.colors.canvas, borderRadius: 15, color: v3.colors.ink, paddingHorizontal: 14 },
  reason: { minHeight: 92, paddingTop: 13, paddingBottom: 13 },
  code: { height: 58, textAlign: 'center', fontSize: 22, letterSpacing: 8 },
  testNote: { ...v3.typography.small, color: v3.colors.textMuted, textAlign: 'center', marginTop: 7 },
  error: { ...v3.typography.caption, color: v3.colors.error, marginTop: 9 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 18 },
  keep: { flex: 1, height: 50, borderRadius: 15, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  keepText: { ...v3.typography.bodyBold, color: v3.colors.ink },
  confirm: { flex: 1.3, height: 50, borderRadius: 15, backgroundColor: v3.colors.error, alignItems: 'center', justifyContent: 'center' },
  confirmText: { ...v3.typography.bodyBold, color: v3.colors.paper },
  disabled: { opacity: 0.55 },
})
