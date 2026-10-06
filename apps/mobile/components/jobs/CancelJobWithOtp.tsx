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
import { WarningCircle } from 'phosphor-react-native'
import { v2JobActions } from '@/api/v2-jobs'
import { v3 } from '@/theme/v3/tokens'

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
  const [loading, setLoading] = useState(false)

  const confirm = async () => {
    if (reason.trim().length < 3) {
      Alert.alert('Enter a reason', 'Briefly explain why you are cancelling.')
      return
    }

    setLoading(true)
    try {
      const result = await v2JobActions.complete(jobId, 'CANCEL', reason.trim())
      Alert.alert(
        'Job cancelled',
        result.message || 'The job was cancelled before work started.',
        [{ text: 'Done', onPress: onDone }],
      )
    } catch (error: any) {
      Alert.alert('Cancellation failed', error?.message || 'Please try again.')
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
        editable={!loading}
        placeholder="Briefly explain why you are cancelling"
        placeholderTextColor={v3.colors.textPlaceholder}
        multiline
        maxLength={500}
        textAlignVertical="top"
        style={styles.reasonInput}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.disabled]}
        disabled={loading}
        onPress={confirm}
      >
        {loading
          ? <ActivityIndicator size="small" color={v3.colors.paper} />
          : <Text style={styles.buttonText}>Confirm cancellation</Text>}
      </TouchableOpacity>
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
  securityText: { ...v3.typography.caption, color: v3.colors.textSecondary, marginLeft: 8, flex: 1 },
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
})
