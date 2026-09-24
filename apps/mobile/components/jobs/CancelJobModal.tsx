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
import { WarningCircle, X } from 'phosphor-react-native'
import { v2JobActions } from '../../lib/api-v2'
import { v3 } from '../../theme/v3/tokens'

export default function CancelJobModal({
  visible,
  onClose,
  jobId,
  mode,
  onSuccess,
}: {
  visible: boolean
  onClose: () => void
  jobId: string
  mode: 'CUSTOMER' | 'PROVIDER'
  onSuccess?: () => void
}) {
  const [reason, setReason] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const provider = mode === 'PROVIDER'

  useEffect(() => {
    if (visible) {
      setReason('')
      setPin('')
    }
  }, [visible])

  const submit = async () => {
    if (provider && pin.length !== 6) return
    setLoading(true)
    try {
      await v2JobActions.cancel(jobId, {
        reason: reason.trim() || undefined,
        pin: provider ? pin : undefined,
      })
      onClose()
      onSuccess?.()
    } catch (error: any) {
      const message = error?.message || 'Could not cancel the job.'
      if (message.includes('WORK_ALREADY_STARTED') || message.includes('work has already started')) {
        setReason('Work has already started. Open a dispute instead.')
      } else {
        setReason(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.warning}><WarningCircle size={22} color={v3.colors.error} weight="fill" /></View>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Cancel before work starts</Text>
              <Text style={styles.subtitle}>
                {provider
                  ? 'Ask the customer for the current 6-digit job PIN. This proves they know about the provider cancellation.'
                  : 'If protected payment is already funded, MaintainEX refunds it through the canonical escrow flow.'}
              </Text>
            </View>
            <TouchableOpacity style={styles.close} onPress={onClose}><X size={17} color={v3.colors.textMuted} /></TouchableOpacity>
          </View>

          {provider ? (
            <>
              <Text style={styles.label}>Customer job PIN</Text>
              <TextInput
                style={styles.pin}
                value={pin}
                onChangeText={value => setPin(value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                placeholderTextColor={v3.colors.textPlaceholder}
                keyboardType="number-pad"
                maxLength={6}
              />
            </>
          ) : null}

          <Text style={styles.label}>Reason (optional)</Text>
          <TextInput
            style={styles.reason}
            value={reason}
            onChangeText={setReason}
            placeholder="Why are you cancelling?"
            placeholderTextColor={v3.colors.textPlaceholder}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />

          <View style={styles.note}>
            <Text style={styles.noteText}>Once work has started with the work-start PIN, normal cancellation is disabled. Use Dispute for problems after that point.</Text>
          </View>

          <TouchableOpacity
            style={[styles.cancel, (loading || (provider && pin.length !== 6)) && styles.disabled]}
            disabled={loading || (provider && pin.length !== 6)}
            onPress={submit}
          >
            {loading ? <ActivityIndicator color={v3.colors.paper} /> : <Text style={styles.cancelText}>Confirm cancellation</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { backgroundColor: v3.colors.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 34 },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: v3.colors.line, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  warning: { width: 42, height: 42, borderRadius: 14, backgroundColor: v3.colors.errorSoft, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, marginLeft: 10, marginRight: 8 },
  title: { ...v3.typography.title, color: v3.colors.ink },
  subtitle: { ...v3.typography.caption, color: v3.colors.textSecondary, lineHeight: 17, marginTop: 3 },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center' },
  label: { ...v3.typography.captionBold, color: v3.colors.textSecondary, marginTop: 16, marginBottom: 6 },
  pin: { height: 56, borderRadius: 16, borderWidth: 1, borderColor: v3.colors.line, backgroundColor: v3.colors.canvas, paddingHorizontal: 16, fontFamily: 'Outfit_800ExtraBold', fontSize: 22, letterSpacing: 7, color: v3.colors.ink },
  reason: { minHeight: 90, borderRadius: 16, borderWidth: 1, borderColor: v3.colors.line, backgroundColor: v3.colors.canvas, padding: 13, fontFamily: 'Outfit_500Medium', fontSize: 13, color: v3.colors.ink },
  note: { backgroundColor: v3.colors.amberSoft, borderRadius: 14, padding: 11, marginTop: 12 },
  noteText: { ...v3.typography.small, color: v3.colors.amberDark, lineHeight: 15 },
  cancel: { height: 52, borderRadius: 16, backgroundColor: v3.colors.error, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  disabled: { opacity: 0.45 },
  cancelText: { ...v3.typography.bodyBold, color: v3.colors.paper },
})
