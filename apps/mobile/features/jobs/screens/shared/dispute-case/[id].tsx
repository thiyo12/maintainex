import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, FileText, WarningCircle } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { disputes } from '@/api/disputes'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'

type DisputeCase = Awaited<ReturnType<typeof disputes.get>>

export default function DisputeCaseScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { id: routeId } = useLocalSearchParams<{ id: string }>()
  const id = Array.isArray(routeId) ? routeId[0] : routeId
  const [caseFile, setCaseFile] = useState<DisputeCase | null>(null)
  const [appealText, setAppealText] = useState('')
  const [evidenceText, setEvidenceText] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const requestKey = useRef<string | null>(null)

  const loadCase = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const result = await disputes.get(id)
      setCaseFile(result)
    } catch {
      setError(t('dispute.caseLoadError'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => { void loadCase() }, [loadCase])

  const submitAppeal = async () => {
    if (!id || !caseFile || appealText.trim().length < 10 || appealText.trim().length > 2000) return
    setSubmitting(true)
    requestKey.current ||= `appeal-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`
    try {
      await disputes.appeal(id, { appeal: appealText.trim(), idempotencyKey: requestKey.current })
      requestKey.current = null
      setAppealText('')
      await loadCase()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('dispute.appealError'))
    } finally {
      setSubmitting(false)
    }
  }

  const submitEvidence = async () => {
    if (!id || !caseFile || evidenceText.trim().length < 1 || evidenceText.trim().length > 4000) return
    setSubmitting(true)
    requestKey.current ||= `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`
    try {
      await disputes.addEvidence(id, evidenceText.trim(), requestKey.current)
      requestKey.current = null
      setEvidenceText('')
      await loadCase()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('dispute.evidenceError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <ArrowLeft size={20} color={colors.textPrimary} />
        <Text style={styles.backText}>{t('common.back')}</Text>
      </TouchableOpacity>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.amber} size="large" /></View>
      ) : error && !caseFile ? (
        <View style={styles.center}>
          <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => { void loadCase() }} style={styles.secondaryButton}>
            <Text style={styles.buttonText}>{t('dispute.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : caseFile ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.titleRow}>
            <FileText size={24} color={colors.amber} />
            <Text style={styles.title}>{t('dispute.caseTitle')}</Text>
          </View>
          <Text style={styles.jobTitle}>{caseFile.job.title}</Text>
          <View style={styles.statusCard}>
            <Text style={styles.label}>{t('dispute.caseStatus')}</Text>
            <Text style={styles.status}>{caseFile.status.replaceAll('_', ' ')}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>{t('dispute.reason')}</Text>
            <Text style={styles.body}>{caseFile.reason}</Text>
            <Text style={[styles.label, styles.spaced]}>{t('dispute.description')}</Text>
            <Text style={styles.body}>{caseFile.description || t('dispute.noDescription')}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('dispute.evidenceTitle')}</Text>
            <Text style={styles.muted}>{t('dispute.evidencePrivacy')}</Text>
            {caseFile.evidence.map(item => (
              <View key={item.id} style={styles.historyItem}>
                <Text style={styles.status}>{item.participantType}</Text>
                <Text style={styles.body}>{item.description}</Text>
                <Text style={styles.muted}>{new Date(item.createdAt).toLocaleString()}</Text>
              </View>
            ))}
            <TextInput
              accessibilityLabel={t('dispute.evidenceTitle')}
              value={evidenceText}
              onChangeText={value => { setEvidenceText(value.slice(0, 4000)); setError('') }}
              placeholder={t('dispute.evidencePlaceholder')}
              placeholderTextColor={colors.muted}
              multiline
              maxLength={4000}
              textAlignVertical="top"
              style={styles.input}
            />
            {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity
              accessibilityRole="button"
              disabled={submitting || !evidenceText.trim()}
              onPress={() => { void submitEvidence() }}
              style={[styles.primaryButton, (submitting || !evidenceText.trim()) && styles.disabledButton]}
            >
              {submitting ? <ActivityIndicator color="#111" /> : <Text style={styles.buttonText}>{t('dispute.submitEvidence')}</Text>}
            </TouchableOpacity>
          </View>

          {caseFile.caseHistory.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('dispute.caseHistory')}</Text>
              {caseFile.caseHistory.map(event => (
                <View key={event.id} style={styles.historyItem}>
                  <Text style={styles.status}>{event.action.replaceAll('_', ' ')}</Text>
                  <Text style={styles.muted}>{new Date(event.createdAt).toLocaleString()}</Text>
                  {event.appeal && <Text style={styles.body}>{event.appeal}</Text>}
                  {event.resolution && <Text style={styles.body}>{event.resolution}</Text>}
                </View>
              ))}
            </View>
          )}

          {caseFile.status === 'RESOLVED' ? (
            <View style={styles.card}>
              <View style={styles.warningRow}>
                <WarningCircle size={19} color={colors.amber} />
                <Text style={styles.warning}>{t('dispute.appealFinancialNote')}</Text>
              </View>
              <Text style={styles.label}>{t('dispute.appealPrompt')}</Text>
              <TextInput
                accessibilityLabel={t('dispute.appealPrompt')}
                value={appealText}
                onChangeText={value => { setAppealText(value.slice(0, 2000)); setError('') }}
                placeholder={t('dispute.appealPlaceholder')}
                placeholderTextColor={colors.muted}
                multiline
                maxLength={2000}
                textAlignVertical="top"
                style={styles.input}
              />
              <Text style={styles.muted}>{appealText.trim().length}/2000</Text>
              {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
              <TouchableOpacity
                accessibilityRole="button"
                disabled={submitting || appealText.trim().length < 10}
                onPress={() => { void submitAppeal() }}
                style={[styles.primaryButton, (submitting || appealText.trim().length < 10) && styles.disabledButton]}
              >
                {submitting ? <ActivityIndicator color="#111" /> : <Text style={styles.buttonText}>{t('dispute.submitAppeal')}</Text>}
              </TouchableOpacity>
            </View>
          ) : null}
          {error && caseFile.status !== 'RESOLVED' ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  )
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 36, gap: 14 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
    backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 18 },
    backText: { color: colors.textPrimary, fontFamily: fonts.bodyMedium, fontSize: 15 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 24 },
    jobTitle: { color: colors.textSecond, fontFamily: fonts.bodyMedium, fontSize: 16 },
    statusCard: { borderColor: colors.border, borderWidth: 1, backgroundColor: colors.surface, padding: 15, borderRadius: 14 },
    card: { borderColor: colors.border, borderWidth: 1, backgroundColor: colors.surface, padding: 16, borderRadius: 14, gap: 8 },
    label: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12, textTransform: 'uppercase' },
    status: { color: colors.amber, fontFamily: fonts.bodyMedium, fontSize: 15 },
    body: { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
    muted: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
    sectionTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 17 },
    spaced: { marginTop: 8 },
    historyItem: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 4 },
    warningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    warning: { color: colors.textSecond, flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
    input: { minHeight: 120, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 12, color: colors.textPrimary, fontFamily: fonts.body, fontSize: 15 },
    primaryButton: { backgroundColor: colors.amber, borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    secondaryButton: { borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12 },
    disabledButton: { opacity: 0.45 },
    buttonText: { color: '#111111', fontFamily: fonts.bodyMedium, fontSize: 15 },
    errorText: { color: colors.error, textAlign: 'center', fontFamily: fonts.body, fontSize: 14 },
  })
}
