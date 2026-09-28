import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { v2Jobs } from '@/api/v2-jobs'
import { v2Quotes } from '@/api/v2-quotes'
import { v2Identity } from '@/api/v2-identity'
import { colors, spacing, radius, typography } from '@/lib/design'

export default function V2SubmitQuoteScreen() {
  const { t } = useTranslation()
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [identity, setIdentity] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [price, setPrice] = useState('')
  const [estimatedCompletionTime, setEstimatedCompletionTime] = useState('')
  const [message, setMessage] = useState('')
  const [existingQuote, setExistingQuote] = useState<any>(null)

  useEffect(() => { load() }, [id])

  const load = async () => {
    try {
      const [jobRes, idRes, quoteRes] = await Promise.allSettled([
        v2Jobs.get(id),
        v2Identity.getStatus(),
        v2Quotes.list(id),
      ])
      if (jobRes.status === 'fulfilled') {
        const j = jobRes.value.job
        setJob(j)
        const smart = j.smartBooking
        if (smart?.estimatedPriceMin != null && smart?.estimatedPriceMax != null) {
          const mid = Math.round((smart.estimatedPriceMin + smart.estimatedPriceMax) / 2)
          setPrice(String(mid))
        }
      }
      else {
        Alert.alert(t('common.error'), t('errors.jobNotFound'))
        router.back()
        return
      }
      if (idRes.status === 'fulfilled') setIdentity(idRes.value.identityStatus)
      if (quoteRes.status === 'fulfilled') {
        const pending = (quoteRes.value.quotes || [])
          .filter((q: any) => q.status === 'PENDING')
          .sort((a: any, b: any) => (b.revisionNumber || 1) - (a.revisionNumber || 1))[0]
        if (pending) {
          setExistingQuote(pending)
          setPrice(String(pending.price))
          setEstimatedCompletionTime(pending.estimatedCompletionTime || '')
          setMessage(pending.message || '')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const isVerified = identity === 'VERIFIED' || identity === 'APPROVED'

  const handleSubmit = async () => {
    if (!price || !estimatedCompletionTime) {
      Alert.alert(t('common.error'), t('errors.fillAllFields'))
      return
    }
    setSubmitting(true)
    try {
      if (existingQuote) {
        await v2Quotes.revise(existingQuote.id, {
          price: parseFloat(price),
          estimatedCompletionTime,
          message,
          revisionReason: 'Provider revised quote after customer negotiation',
        })
      } else {
        await v2Quotes.submit({
          jobId: id,
          providerType: 'INDIVIDUAL',
          price: parseFloat(price),
          estimatedCompletionTime,
          message,
        })
      }
      Alert.alert(existingQuote ? 'Quote revised!' : 'Quote sent!', 'Customer has been notified.', [
        { text: t('common.ok'), onPress: () => router.back() },
      ])
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  if (!job) return null

  const currencyCode = job.countryCode === 'CA' ? 'CAD' : 'LKR'

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Job Preview */}
        <View style={styles.jobPreview}>
          <View style={styles.previewBadge}><Text style={styles.previewBadgeText}>{t('jobs.status.open')}</Text></View>
          <Text style={styles.previewTitle}>{job.title}</Text>
          <Text style={styles.previewDesc} numberOfLines={3}>{job.description}</Text>
          <View style={styles.previewMeta}>
            <Text style={styles.previewBudget}>{currencyCode} {job.budgetAmount?.toLocaleString() ?? 'Not set'}</Text>
            <Text style={styles.previewType}>{job.budgetType}</Text>
          </View>
        </View>

        {job.smartBooking ? (
          <View style={styles.smartCard}>
            <View style={styles.smartHeader}>
              <Ionicons name="flash-outline" size={18} color={colors.accent} />
              <Text style={styles.smartHeaderText}>Smart booking details</Text>
            </View>
            {job.smartBooking.categoryName ? (
              <View style={styles.smartRow}>
                <Text style={styles.smartLabel}>Service</Text>
                <Text style={styles.smartValue}>{job.smartBooking.categoryName}</Text>
              </View>
            ) : null}
            {job.smartBooking.answers && typeof job.smartBooking.answers === 'object' ? (
              Object.entries(job.smartBooking.answers).map(([k, v]: [string, any]) => {
                const picks = Array.isArray(v) ? v : [v]
                if (picks.length === 0 || picks[0] == null || picks[0] === '') return null
                return (
                  <View key={k} style={styles.smartRow}>
                    <Text style={styles.smartLabel}>{k.replace(/_/g, ' ')}</Text>
                    <Text style={styles.smartValue}>{picks.join(', ')}</Text>
                  </View>
                )
              })
            ) : null}
            {job.smartBooking.timeSlot ? (
              <View style={styles.smartRow}>
                <Text style={styles.smartLabel}>Time slot</Text>
                <Text style={styles.smartValue}>{job.smartBooking.timeSlot}</Text>
              </View>
            ) : null}
            {job.smartBooking.estimatedPriceMin != null ? (
              <View style={styles.smartRow}>
                <Text style={styles.smartLabel}>Est. budget</Text>
                <Text style={styles.smartValue}>{currencyCode} {job.smartBooking.estimatedPriceMin.toLocaleString()} – {job.smartBooking.estimatedPriceMax?.toLocaleString?.() ?? ''}</Text>
              </View>
            ) : null}
            <View style={styles.smartRow}>
              <Text style={styles.smartLabel}>Requested</Text>
              <Text style={styles.smartValue}>
                {job.notifiedCount || 0} taskers notified via instant blast
              </Text>
            </View>
          </View>
        ) : null}

        {!isVerified ? (
          /* ═══ KYC gate ═══ */
          <View style={styles.gateCard}>
            {identity === null ? (
              <ActivityIndicator size="large" color={colors.accent} />
            ) : (
              <>
                <View style={styles.gateIconWrap}>
                  <Ionicons name="shield-checkmark-outline" size={26} color={colors.accent} />
                </View>
                <View style={styles.gateBadge}><Text style={styles.gateBadgeText}>{t('verify.gateBadge')}</Text></View>
                <Text style={styles.gateTitle}>
                  {identity === 'PENDING'
                    ? t('verify.status.pending')
                    : identity === 'REJECTED'
                      ? t('verify.status.rejected')
                      : t('verify.gateNotSubmittedTitle')}
                </Text>
                <Text style={styles.gateDesc}>
                  {identity === 'PENDING'
                    ? t('verify.gatePendingDesc')
                    : identity === 'REJECTED'
                      ? t('verify.gateRejectedDesc')
                      : t('verify.gateNotSubmittedDesc')}
                </Text>
                {identity !== 'PENDING' && (
                  <TouchableOpacity style={styles.gateBtn} onPress={() => router.push('/(tasker)/identity')}>
                    <Text style={styles.gateBtnText}>
                      {identity === 'REJECTED' ? t('verify.gateRejectButton') : t('verify.gateButton')}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        ) : (
          /* ═══ Quote Form ═══ */
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('quotes.yourQuote')}</Text>

            <Text style={styles.label}>{existingQuote ? 'Revise your quote' : 'Your quote'}</Text>
            <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>
              {existingQuote ? 'Update the price or timing agreed in chat. The previous quote will be superseded.' : 'Submit this quote as your individual provider profile.'}
            </Text>

            <Text style={styles.label}>{t('quotes.price')} ({currencyCode}) *</Text>
            <View style={styles.priceInputRow}>
              <Text style={styles.currencySign}>{currencyCode}</Text>
              <TextInput
                style={[styles.input, styles.priceInput]}
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>

            <Text style={styles.label}>{t('quotes.estimatedTime')} *</Text>
            <TextInput
              style={styles.input}
              value={estimatedCompletionTime}
              onChangeText={setEstimatedCompletionTime}
              placeholder={t('quotes.estimatedTime')}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>{t('quotes.message')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={message}
              onChangeText={setMessage}
              placeholder="Hi, I can help with this. I'll bring all materials."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.submitBtnText}>{existingQuote ? 'Revise Quote' : t('tasker.submitQuote')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },

  jobPreview: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewBadge: { alignSelf: 'flex-start', backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.sm, marginBottom: 10 },
  previewBadgeText: { fontSize: 11, fontWeight: '700', color: colors.background },
  previewTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  previewDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  previewMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewBudget: { fontSize: 18, fontWeight: '800', color: colors.accent },
  previewType: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  smartCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smartHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  smartHeaderText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  smartRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  smartLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'capitalize' },
  smartValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, flexShrink: 1, textAlign: 'right', marginLeft: 12 },

  gateCard: {
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  gateIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gateBadge: {
    alignSelf: 'center',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginBottom: 10,
  },
  gateBadgeText: { fontSize: 11, fontWeight: '700', color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.5 },
  gateTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  gateDesc: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginTop: 8, marginBottom: 18 },
  gateBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  gateBtnText: { fontSize: 15, fontWeight: '800', color: colors.background },

  section: { padding: spacing.lg },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 16 },

  typeRow: { flexDirection: 'row', gap: 12 },
  typeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  typeBtnSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  typeBtnTextSelected: { color: colors.accent },

  priceInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currencySign: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  priceInput: { flex: 1, fontSize: 24, fontWeight: '700' },

  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  textArea: { height: 100, textAlignVertical: 'top' },

  submitBtn: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: radius.md, alignItems: 'center', marginTop: 24 },
  btnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 18, fontWeight: '800', color: colors.background },
})