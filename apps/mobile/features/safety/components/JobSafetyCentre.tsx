import { useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator, Alert, Linking, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { v2JobActions } from '@/api/v2-jobs'
import { v3 } from '@/theme/v3/tokens'

const REASONS = [
  { id: 'SAFETY_IMMEDIATE_DANGER', nameKey: 'safetyCentre.immediateDangerReason' },
  { id: 'SAFETY_THREAT_OR_HARASSMENT', nameKey: 'safetyCentre.threatReason' },
  { id: 'SAFETY_INJURY', nameKey: 'safetyCentre.injuryReason' },
  { id: 'SAFETY_UNSAFE_WORK', nameKey: 'safetyCentre.unsafeWorkReason' },
  { id: 'SAFETY_IDENTITY_MISMATCH', nameKey: 'safetyCentre.identityReason' },
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
  const router = useRouter()
  const { t } = useTranslation()
  const exited = useRef(false)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<Reason>('SAFETY_UNSAFE_WORK')
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)
  const [reference, setReference] = useState<string | null>(null)
  const [shareConsent, setShareConsent] = useState(false)
  const [share, setShare] = useState<{ id: string; url: string; expiresAt: string } | null>(null)
  const [sharing, setSharing] = useState(false)

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
      Alert.alert(t('safetyCentre.diallerTitle'), t('safetyCentre.diallerBody'))
    }
  }

  const quickExit = () => {
    // Leave the job screen immediately without an Alert or confirmation.
    // Clear local sensitive content, never remove an already-sent staff report.
    exited.current = true
    setOpen(false)
    setDescription('')
    setReference(null)
    setReason('SAFETY_UNSAFE_WORK')
    setShareConsent(false)
    const activeShare = share
    setShare(null)
    if (activeShare) {
      void v2JobActions.revokeTrustedContactShare(jobId, activeShare.id).catch(() => undefined)
    }
    router.replace('/')
  }

  const report = async () => {
    exited.current = false
    const detail = description.trim()
    if (detail.length < 10 || detail.length > 2000) {
      Alert.alert(t('safetyCentre.detailsNeededTitle'), t('safetyCentre.detailsNeededBody'))
      return
    }
    setSending(true)
    try {
      const response = await v2JobActions.reportSafety(jobId, {
        reason, description: detail,
      })
      if (!exited.current) {
        setReference(response.reportId)
        setDescription('')
        setOpen(false)
        Alert.alert(
          t('safetyCentre.recordedTitle'),
          t('safetyCentre.recordedBody'),
        )
      }
    } catch (error: any) {
      if (!exited.current) {
        Alert.alert(t('safetyCentre.reportFailedTitle'), error?.message || t('safetyCentre.reportFailedBody'))
      }
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
        <Text style={styles.headline}>{open ? t('safetyCentre.close') : t('safetyCentre.open')}</Text>
      </TouchableOpacity>
      {reference ? <Text style={styles.note}>{t('safetyCentre.reference', { reference })}</Text> : null}
      {open ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('safetyCentre.quickExit')}
          accessibilityHint={t('safetyCentre.quickExitHint')}
          onPress={quickExit}
          style={styles.quickExit}
        >
          <Text style={styles.quickExitLabel}>{t('safetyCentre.quickExit')}</Text>
        </TouchableOpacity>
      ) : null}
      {open ? (
        <View style={styles.content}>
          <Text style={styles.important}>{t('safetyCentre.immediateDanger')}</Text>
          <Text style={styles.note}>{t('safetyCentre.noDispatch')}</Text>
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
            <Text style={styles.note}>{t('safetyCentre.localNumber')}</Text>
          ) : null}
          <Text style={styles.headline}>{t('safetyCentre.reportTitle')}</Text>
          {REASONS.map(option => (
            <TouchableOpacity
              accessibilityRole="radio"
              accessibilityState={{ selected: option.id === reason }}
              key={option.id}
              onPress={() => setReason(option.id)}
              style={styles.choice}
            >
              <Text style={styles.choiceText}>{option.id === reason ? '●' : '○'} {t(option.nameKey)}</Text>
            </TouchableOpacity>
          ))}
          <TextInput
            accessibilityLabel={t('safetyCentre.detailsLabel')}
            style={styles.input}
            placeholder={t('safetyCentre.detailsPlaceholder')}
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
              <Text style={styles.sendLabel}>{t('safetyCentre.sendReport')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => setOpen(false)} style={styles.dismiss}>
            <Text style={styles.note}>{t('safetyCentre.closeWithoutReporting')}</Text>
          </TouchableOpacity>
          <Text style={styles.note}>{t('safetyCentre.paymentBoundary')}</Text>
          <Text style={styles.headline}>{t('safetyCentre.trustedTitle')}</Text>
          <Text style={styles.note}>{t('safetyCentre.trustedDescription')}</Text>
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: shareConsent }}
            onPress={() => setShareConsent(current => !current)}
            style={styles.choice}
          >
            <Text style={styles.choiceText}>{shareConsent ? '☑' : '☐'} {t('safetyCentre.consent')}</Text>
          </TouchableOpacity>
          {share ? (
            <View style={styles.shareBox}>
              <Text selectable style={styles.note}>{share.url}</Text>
              <Text style={styles.note}>{t('safetyCentre.expires', { date: new Date(share.expiresAt).toLocaleString() })}</Text>
              <TouchableOpacity accessibilityRole="button" style={styles.emergency} onPress={async () => {
                await Clipboard.setStringAsync(share.url)
                Alert.alert(t('safetyCentre.linkCopied'), t('safetyCentre.shareOnly'))
              }}>
                <Text style={styles.emergencyLabel}>{t('safetyCentre.copyLink')}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={styles.dismiss} onPress={async () => {
                try {
                  await v2JobActions.revokeTrustedContactShare(jobId, share.id)
                  setShare(null)
                  setShareConsent(false)
                } catch (error: any) {
                  Alert.alert(t('safetyCentre.revokeFailedTitle'), error?.message || t('safetyCentre.tryAgain'))
                }
              }}>
                <Text style={styles.note}>{t('safetyCentre.revoke')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.send, (!shareConsent || sharing) && { opacity: 0.5 }]}
              disabled={!shareConsent || sharing}
              onPress={async () => {
                setSharing(true)
                try {
                  exited.current = false
                  const response = await v2JobActions.createTrustedContactShare(jobId, 4)
                  if (exited.current) {
                    await v2JobActions.revokeTrustedContactShare(jobId, response.share.id).catch(() => undefined)
                    return
                  }
                  setShare({ id: response.share.id, url: response.url, expiresAt: response.share.expiresAt })
                } catch (error: any) {
                  Alert.alert(t('safetyCentre.linkFailedTitle'), error?.message || t('safetyCentre.tryAgain'))
                } finally {
                  setSharing(false)
                }
              }}
            >
              {sharing ? <ActivityIndicator color={v3.colors.paper} /> : (
                <Text style={styles.sendLabel}>{t('safetyCentre.createLink')}</Text>
              )}
            </TouchableOpacity>
          )}
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
  quickExit: { backgroundColor: v3.colors.line, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8, marginTop: 4 },
  quickExitLabel: { color: v3.colors.ink, fontWeight: '700', textAlign: 'center' },
  shareBox: { gap: 8, padding: 10, borderWidth: 1, borderColor: v3.colors.line, borderRadius: 8 },
})
