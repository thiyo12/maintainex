import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useColors } from '../../../../../lib/ThemeContext'
import { v2Jobs, v2Quotes } from '../../../../../lib/api-v2'

export default function V2SubmitQuoteScreen() {
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
  const [providerType, setProviderType] = useState('INDIVIDUAL')

  useEffect(() => { loadJob() }, [id])

  const loadJob = async () => {
    try {
      const res = await v2Jobs.get(id)
      setJob(res.job)
    } catch (e) {
      Alert.alert('Error', 'Failed to load job')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!price || !estimatedCompletionTime) {
      Alert.alert('Error', 'Price and estimated time are required')
      return
    }
    setSubmitting(true)
    try {
      await v2Quotes.submit({
        jobId: id, providerType,
        price: parseFloat(price),
        estimatedCompletionTime, message,
      })
      Alert.alert('Quote Submitted!', 'The customer will review your offer.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  if (!job) return null

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Job Preview */}
        <View style={styles.jobPreview}>
          <View style={styles.previewBadge}><Text style={styles.previewBadgeText}>Open</Text></View>
          <Text style={styles.previewTitle}>{job.title}</Text>
          <Text style={styles.previewDesc} numberOfLines={3}>{job.description}</Text>
          <View style={styles.previewMeta}>
            <Text style={styles.previewBudget}>LKR {job.budgetAmount}</Text>
            <Text style={styles.previewType}>{job.budgetType}</Text>
          </View>
        </View>

        {/* Quote Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Quote</Text>

          <Text style={styles.label}>Provider Type *</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeBtn, providerType === 'INDIVIDUAL' && styles.typeBtnSelected]}
              onPress={() => setProviderType('INDIVIDUAL')}
            >
              <Text style={[styles.typeBtnText, providerType === 'INDIVIDUAL' && styles.typeBtnTextSelected]}>Individual</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, providerType === 'COMPANY' && styles.typeBtnSelected]}
              onPress={() => setProviderType('COMPANY')}
            >
              <Text style={[styles.typeBtnText, providerType === 'COMPANY' && styles.typeBtnTextSelected]}>Company</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Your Price (LKR) *</Text>
          <View style={styles.priceInputRow}>
            <Text style={styles.currencySign}>LKR</Text>
            <TextInput
              style={[styles.input, styles.priceInput]}
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              placeholderTextColor={colors.border}
              keyboardType="numeric"
            />
          </View>

          <Text style={styles.label}>Estimated Completion *</Text>
          <TextInput
            style={styles.input}
            value={estimatedCompletionTime}
            onChangeText={setEstimatedCompletionTime}
            placeholder="e.g. 2 days, 3 hours"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>Message to Customer</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            placeholder="Describe what's included in your quote..."
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
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Text style={styles.submitBtnText}>Submit Quote</Text>
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

  jobPreview: { backgroundColor: colors.amberBg, marginHorizontal: 20, marginTop: 20, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.amberLight },
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
  priceInput: { flex: 1, fontSize: 24, fontWeight: '700' },

  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 15, color: colors.ink, backgroundColor: colors.white },
  textArea: { height: 100, textAlignVertical: 'top' },

  submitBtn: { backgroundColor: colors.amber, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  btnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 18, fontWeight: '800', color: colors.ink },
})
