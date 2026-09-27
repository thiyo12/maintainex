import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../../../lib/ThemeContext'
import { fonts } from '../../../../../lib/fonts'
import { v2Jobs, v2Quotes } from '../../../../../lib/api-v2'
import { company } from '../../../../../lib/api'

export default function CompanySubmitQuoteScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [price, setPrice] = useState('')
  const [estimatedCompletionTime, setEstimatedCompletionTime] = useState('')
  const [message, setMessage] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [existingQuote, setExistingQuote] = useState<any>(null)

  useEffect(() => { loadJob() }, [id])

  const loadJob = async () => {
    try {
      const companyProfile = await company.profile.get()
      const [jobRes, quoteRes] = await Promise.all([
        v2Jobs.get(id, 'company'),
        v2Quotes.list(id, companyProfile.id),
      ])
      setJob(jobRes.job)
      setCompanyId(companyProfile.id)

      const pending = (quoteRes.quotes || [])
        .filter((q: any) => q.status === 'PENDING')
        .sort((a: any, b: any) => (b.revisionNumber || 1) - (a.revisionNumber || 1))[0]
      if (pending) {
        setExistingQuote(pending)
        setPrice(String(pending.price))
        setEstimatedCompletionTime(pending.estimatedCompletionTime || '')
        setMessage(pending.message || '')
      }
    } catch (e) {
      Alert.alert(t('common.error'), t('errors.jobNotFound'))
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!price || !estimatedCompletionTime || !companyId) {
      Alert.alert(t('common.error'), !companyId ? 'Company profile is not available.' : t('errors.fillAllFields'))
      return
    }
    setSubmitting(true)
    try {
      if (existingQuote) {
        await v2Quotes.revise(existingQuote.id, {
          price: parseFloat(price),
          estimatedCompletionTime,
          message,
          revisionReason: 'Company revised quote after customer negotiation',
          companyId,
        })
      } else {
        await v2Quotes.submit({
          jobId: id,
          providerType: 'COMPANY',
          companyId,
          price: parseFloat(price),
          estimatedCompletionTime,
          message,
        })
      }
      Alert.alert(
        existingQuote ? 'Quote revised' : t('company.quoteSubmitSuccess'),
        existingQuote ? 'The customer can now accept the updated quote.' : t('company.quoteSubmitDesc'),
        [
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
        <ActivityIndicator size="large" color={colors.companyAccent} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  if (!job) return null

  const currencyCode = job.countryCode === 'CA' ? 'CAD' : 'LKR'

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('quotes.yourQuote')}</Text>
          <View style={{ width: 40 }} />
        </View>

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

        {/* Quote Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('quotes.yourQuote')}</Text>

          <Text style={styles.label}>{existingQuote ? 'Revise company quote' : 'Company quote'}</Text>
          <Text style={{ color: colors.muted, marginBottom: 4 }}>
            {existingQuote ? 'Update the negotiated price or timing. The previous quote will be superseded.' : 'This quote will be submitted under your company profile.'}
          </Text>

          <Text style={styles.label}>{t('quotes.price')} ({currencyCode}) *</Text>
          <View style={styles.priceInputRow}>
            <Text style={styles.currencySign}>{currencyCode}</Text>
            <TextInput
              style={[styles.input, styles.priceInput]}
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              placeholderTextColor={colors.border}
              keyboardType="numeric"
            />
          </View>

          <Text style={styles.label}>{t('quotes.estimatedTime')} *</Text>
          <TextInput
            style={styles.input}
            value={estimatedCompletionTime}
            onChangeText={setEstimatedCompletionTime}
            placeholder={t('quotes.estimatedTime')}
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>{t('quotes.message')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            placeholder={t('quotes.message')}
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={4}
          />

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#0D0D0D" />
            ) : (
              <Text style={styles.submitBtnText}>{existingQuote ? 'Revise Quote' : t('tasker.submitQuote')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  scroll: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },

  jobPreview: { backgroundColor: colors.amberBg, marginHorizontal: 20, marginTop: 8, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.amberLight },
  previewBadge: { alignSelf: 'flex-start', backgroundColor: colors.amber, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, marginBottom: 10 },
  previewBadgeText: { fontSize: 11, fontWeight: '700', color: colors.ink },
  previewTitle: { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  previewDesc: { fontSize: 13, color: colors.ink, opacity: 0.7, lineHeight: 20, marginBottom: 12 },
  previewMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewBudget: { fontSize: 18, fontWeight: '800', color: colors.amberDark },
  previewType: { fontSize: 12, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },

  section: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink, marginBottom: 6, marginTop: 16 },

  typeRow: { flexDirection: 'row', gap: 12 },
  typeBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  typeBtnSelected: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  typeBtnTextSelected: { color: colors.amberDark },

  priceInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currencySign: { fontSize: 18, fontWeight: '700', color: colors.ink },
  priceInput: { flex: 1, fontSize: 24, fontWeight: '700', fontFamily: fonts.bodyMedium },

  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 15, color: colors.ink, backgroundColor: colors.white, fontFamily: fonts.body },
  textArea: { height: 100, textAlignVertical: 'top' },

  submitBtn: { backgroundColor: colors.amber, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  btnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 18, fontWeight: '800', color: '#0D0D0D', fontFamily: fonts.bodyMedium },
})