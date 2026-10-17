import { useState } from 'react'
import {
  ActivityIndicator, Alert, Linking, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { v2JobActions } from '@/api/v2-jobs'
import { v3 } from '@/theme/v3/tokens'

const REASONS = [
  { id: 'SAFETY_IMMEDIATE_DANGER', name: 'Immediate danger' },
  { id: 'SAFETY_THREAT_OR_HARASSMENT', name: 'Threat or harassment' },
  { id: 'SAFETY_INJURY', name: 'Injury' },
  { id: 'SAFETY_UNSAFE_WORK', name: 'Unsafe work conditions' },
  { id: 'SAFETY_IDENTITY_MISMATCH', name: 'Identity mismatch' },
] as const

type Reason = typeof REASONS[number]['id']

/**
 * User-controlled emergency dialling and an independent safety-intake flow.
 * No emergency dispatch, payments, disputes or continual monitoring is implied.
 */
export default function JobSafetyCentre({
  jobId,
  countryCode,
}: {
  jobId: string
  countryCode?: string
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<Reason>('SAFETY_UNSAFE_WORK')
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)
  const [reference, setReference] = useState<string | null>(null)

  const emergencyNumbers = countryCode?.toUpperCase() === 'CA'
    ? [{ number: '911', label: 'Emergency police, fire or ambulance (911)' }]
    : countryCode?.toUpperCase() === 'LK'
      ? [
          { number: '119', label: 'Police emergency (119)' },
          { number: '1990', label: 'Ambulance (1990)' },
        ]
      : []

  const dial = async (number: string) => {
    try {
      // The user's dialler opens; MaintainEX does not place a call itself.
      await Linking.openURL('tel:' + number)
    } catch {
      Alert.alert('Dialler unavailable', 'Call your local emergency services directly.')
    }
  }

  const report = async () => {
    const detail = description.trim()
    if (detail.length < 10 || detail.length > 2000) {
      Alert.alert('Details needed', 'Describe the safety issue in 10–2000 characters.')
      return
    }
    setSending(true)
    try {
      const response = await v2JobActions.reportSafety(jobId, {
        reason, description: detail,
      })
      setReference(response.reportId)
      setDescription('')
      setOpen(false)
      Alert.alert(
        'Report recorded',
        'Staff can review your report. This is not emergency dispatch and does not automatically change a payment.',
      )
    } catch (error: any) {
      Alert.alert('Could not record report', error?.message ||
        'Check your connection. In immediate danger, call emergency services.')
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={styles.panel}>
      <TouchableOpacity
        accessibilityRole="button"
        style={styles.toggle}
        onPress={() => setOpen(current => !current)}
      >
        <Text style={styles.headline}>{open ? 'Close Safety Centre' : 'Safety Centre — report danger or get help'}</Text>
      </TouchableOpacity>
      {reference ? <Text style={styles.note}>Recorded reference: {reference}</Text> : null}
      {open ? (
        <View style={styles.content}>
          <Text style={styles.important}>If you are in immediate danger, leave if safe and call emergency services.</Text>
          <Text style={styles.note}>MaintainEX cannot dispatch responders or guarantee 24/7 monitoring.</Text>
          {emergencyNumbers.map(choice => (
            <TouchableOpacity
              accessibilityRole="button"
              key={choice.number}
              style={styles.emergency}
              onPress={() => dial(choice.number)}
            >
              <Text style={styles.emergencyLabel}>Call {choice.label}</Text>
            </TouchableOpacity>
          ))}
          {emergencyNumbers.length === 0 ? (
            <Text style={styles.note}>Use your phone's emergency dialler for the local emergency number.</Text>
          ) : null}
          <Text style={styles.headline}>Report a safety incident (not a payment dispute)</Text>
          {REASONS.map(option => (
            <TouchableOpacity
              accessibilityRole="radio"
              accessibilityState={{ selected: option.id === reason }}
              key={option.id}
              onPress={() => setReason(option.id)}
              style={styles.choice}
            >
              <Text style={styles.choiceText}>{option.id === reason ? '●' : '○'} {option.name}</Text>
            </TouchableOpacity>
          ))}
          <TextInput
            accessibilityLabel="Safety incident details"
            style={styles.input}
            placeholder="What happened and what help do you need?"
            placeholderTextColor={v3.colors.textMuted}
            multiline
            textAlignVertical="top"
            maxLength={2000}
            value={description}
            onChangeText={setDescription}
          />
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.send, sending && { opacity: 0.5 }]}
            disabled={sending}
            onPress={report}
          >
            {sending ? <ActivityIndicator color={v3.colors.paper} /> : (
              <Text style={styles.sendLabel}>Send safety report</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => setOpen(false)} style={styles.dismiss}>
            <Text style={styles.note}>Close without reporting</Text>
          </TouchableOpacity>
          <Text style={styles.note}>Payment disputes use a separate process. Safety intake does not place escrow on hold.</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { marginHorizontal: 16, marginVertical: 12, padding: 14, backgroundColor: v3.colors.paper, borderColor: v3.colors.line, borderWidth: 1, borderRadius: 12 },
  toggle: { paddingVertical: 12 },
  headline: { color: v3.colors.ink, fontWeight: '700', fontSize: 14 },
  important: { color: v3.colors.ink, fontWeight: '700', fontSize: 15 },
  note: { color: v3.colors.textSecondary, fontSize: 12, lineHeight: 18 },
  content: { gap: 10 },
  emergency: { backgroundColor: '#FFF1E7', padding: 12, borderRadius: 8 },
  emergencyLabel: { color: '#A33100', fontSize: 14, fontWeight: '700' },
  choice: { paddingVertical: 8 },
  choiceText: { color: v3.colors.ink, fontSize: 13 },
  input: { borderColor: v3.colors.line, borderWidth: 1, borderRadius: 8, padding: 12, color: v3.colors.ink, minHeight: 95 },
  send: { backgroundColor: v3.colors.ink, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  sendLabel: { color: v3.colors.paper, fontSize: 14, fontWeight: '700' },
  dismiss: { paddingVertical: 8, alignItems: 'center' },
})
