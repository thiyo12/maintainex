import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../../../../lib/colors'
import { v2Jobs, v2Quotes } from '../../../../../lib/api-v2'

export default function V2SubmitQuoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [price, setPrice] = useState('')
  const [estimatedCompletionTime, setEstimatedCompletionTime] = useState('')
  const [message, setMessage] = useState('')
  const [providerType, setProviderType] = useState('INDIVIDUAL')

  useEffect(() => {
    loadJob()
  }, [id])

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
        jobId: id,
        providerType,
        price: parseFloat(price),
        estimatedCompletionTime,
        message,
      })
      Alert.alert('Success', 'Quote submitted!', [
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
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  if (!job) return null

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.jobPreview}>
          <Text style={styles.previewTitle}>{job.title}</Text>
          <Text style={styles.previewDesc} numberOfLines={3}>{job.description}</Text>
          <Text style={styles.previewBudget}>Budget: {job.budgetType} — LKR {job.budgetAmount}</Text>
        </View>

        <Text style={styles.sectionTitle}>Your Quote</Text>

        <Text style={styles.label}>Provider Type *</Text>
        <View style={styles.providerTypes}>
          <TouchableOpacity
            style={[styles.typePill, providerType === 'INDIVIDUAL' && styles.typePillSelected]}
            onPress={() => setProviderType('INDIVIDUAL')}
          >
            <Text style={[styles.typePillText, providerType === 'INDIVIDUAL' && styles.typePillTextSelected]}>
              Individual
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typePill, providerType === 'COMPANY' && styles.typePillSelected]}
            onPress={() => setProviderType('COMPANY')}
          >
            <Text style={[styles.typePillText, providerType === 'COMPANY' && styles.typePillTextSelected]}>
              Company
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Your Price (LKR) *</Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          placeholder="e.g. 5000"
          placeholderTextColor="#999"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Estimated Completion Time *</Text>
        <TextInput
          style={styles.input}
          value={estimatedCompletionTime}
          onChangeText={setEstimatedCompletionTime}
          placeholder="e.g. 2 days"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Message to Customer</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={message}
          onChangeText={setMessage}
          placeholder="Describe what's included in your quote..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={4}
        />

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#1a1a1a" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Quote</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 20 },
  jobPreview: { backgroundColor: '#FFF8E1', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#FFE082' },
  previewTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  previewDesc: { fontSize: 13, color: '#666', marginBottom: 8 },
  previewBudget: { fontSize: 14, fontWeight: '600', color: colors.primary },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 10, padding: 14, fontSize: 15, color: '#333', backgroundColor: '#fafafa' },
  textArea: { height: 100, textAlignVertical: 'top' },
  providerTypes: { flexDirection: 'row', gap: 12 },
  typePill: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: '#e0e0e0' },
  typePillSelected: { borderColor: colors.primary, backgroundColor: '#FFF8E1' },
  typePillText: { fontSize: 14, fontWeight: '600', color: '#666' },
  typePillTextSelected: { color: colors.primary },
  submitBtn: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
})
