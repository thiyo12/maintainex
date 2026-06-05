import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, TextInput, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { colors } from '../../lib/colors'
import { v2Identity } from '../../lib/api-v2'

const DOC_TYPES = [
  { key: 'NATIONAL_ID', label: 'National ID Card', icon: 'id-card-outline' },
  { key: 'PASSPORT', label: 'Passport', icon: 'earth-outline' },
  { key: 'DRIVERS_LICENSE', label: "Driver's License", icon: 'car-outline' },
]

export default function IdentityVerificationScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [docType, setDocType] = useState<string | null>(null)
  const [frontUrl, setFrontUrl] = useState('')
  const [backUrl, setBackUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    v2Identity.getStatus().then((data: any) => {
      if (data.identityStatus === 'APPROVED') {
        Alert.alert('Already Verified', 'Your identity has already been verified.')
        router.back()
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleSubmit = async () => {
    if (!docType) {
      Alert.alert('Error', 'Please select a document type')
      return
    }
    if (!frontUrl) {
      Alert.alert('Error', 'Please upload the front of your ID')
      return
    }
    setSubmitting(true)
    try {
      await v2Identity.uploadDocument(docType, 'FRONT', frontUrl)
      if (backUrl) {
        await v2Identity.uploadDocument(docType, 'BACK', backUrl)
      }
      Alert.alert('Submitted', 'Your documents are under review. This usually takes 1-2 business days.')
      router.back()
    } catch (e) {
      Alert.alert('Error', 'Failed to submit documents. Please try again.')
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('verify.title')}</Text>
          <View style={{ width: 24 }} />
        </View>

        <Text style={styles.subtitle}>{t('verify.subtitle')}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Document Type</Text>
          {DOC_TYPES.map((dt) => (
            <TouchableOpacity
              key={dt.key}
              style={[styles.docOption, docType === dt.key && styles.docOptionSelected]}
              onPress={() => setDocType(dt.key)}
              activeOpacity={0.7}
            >
              <Ionicons name={dt.icon as any} size={22} color={docType === dt.key ? colors.amber : colors.muted} />
              <Text style={[styles.docLabel, docType === dt.key && styles.docLabelSelected]}>{dt.label}</Text>
              {docType === dt.key && <Ionicons name="checkmark-circle" size={20} color={colors.amber} />}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upload Front Image URL</Text>
          <TextInput
            style={styles.input}
            value={frontUrl}
            onChangeText={setFrontUrl}
            placeholder="Paste image URL for front of ID..."
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upload Back Image URL</Text>
          <TextInput
            style={styles.input}
            value={backUrl}
            onChangeText={setBackUrl}
            placeholder="Paste image URL for back of ID (optional)..."
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
        </View>

        <Text style={styles.note}>{t('verify.requiredForJobs')}</Text>

        <TouchableOpacity
          style={[styles.submitBtn, (!docType || !frontUrl || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!docType || !frontUrl || submitting}
          activeOpacity={0.7}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>{t('verify.submit')}</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 14, color: colors.muted, paddingHorizontal: 20, marginBottom: 24, lineHeight: 20 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 12 },
  docOption: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
    padding: 16, borderRadius: 12, marginBottom: 8,
    borderWidth: 1.5, borderColor: colors.border,
  },
  docOptionSelected: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  docLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink, marginLeft: 12 },
  docLabelSelected: { color: colors.amberDark },
  input: {
    backgroundColor: colors.white, borderRadius: 12, padding: 16, fontSize: 14, color: colors.ink,
    borderWidth: 1.5, borderColor: colors.border,
  },
  note: { fontSize: 12, color: colors.muted, paddingHorizontal: 20, marginBottom: 16, lineHeight: 18, fontStyle: 'italic' },
  submitBtn: { backgroundColor: colors.amber, marginHorizontal: 20, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: colors.ink },
})
