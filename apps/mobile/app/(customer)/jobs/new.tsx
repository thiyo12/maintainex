import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { jobs as jobsApi, categories as categoriesApi } from '../../../lib/api'
import { Category } from '../../../lib/types'
import { useEffect } from 'react'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  background: '#F9FAFB',
  white: '#FFFFFF',
}

const DISTRICTS = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle',
  'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle',
  'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara', 'Monaragala',
  'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura',
  'Trincomalee', 'Vavuniya',
]

export default function NewJobScreen() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [budget, setBudget] = useState('')
  const [location, setLocation] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => {})
  }, [])

  const handleSubmit = async () => {
    if (!title || !description || !category || !budget || !location) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }
    setSubmitting(true)
    try {
      await jobsApi.create({
        title, description, category, budget: parseInt(budget), location,
      })
      Alert.alert('Success', 'Job posted successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to post job')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Post a Job</Text>
      <Text style={styles.subtitle}>Find a tasker for your task</Text>

      <Text style={styles.label}>Job Title *</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Fix leaking pipe" />

      <Text style={styles.label}>Description *</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the job in detail..."
        multiline numberOfLines={4}
      />

      <Text style={styles.label}>Category *</Text>
      <View style={styles.pickerRow}>
        {categories.map(c => (
          <TouchableOpacity
            key={c.id}
            style={[styles.pickerOption, category === c.slug && styles.pickerActive]}
            onPress={() => setCategory(c.slug)}
          >
            <Text style={[styles.pickerText, category === c.slug && styles.pickerTextActive]}>
              {c.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Budget (LKR) *</Text>
      <TextInput
        style={styles.input}
        value={budget}
        onChangeText={setBudget}
        placeholder="e.g. 5000"
        keyboardType="number-pad"
      />

      <Text style={styles.label}>Location / District *</Text>
      <View style={styles.pickerRow}>
        {DISTRICTS.map(d => (
          <TouchableOpacity
            key={d}
            style={[styles.pickerOptionSmall, location === d && styles.pickerActive]}
            onPress={() => setLocation(d)}
          >
            <Text style={[styles.pickerText, location === d && styles.pickerTextActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={colors.dark} />
        ) : (
          <Text style={styles.buttonText}>Post Job</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: colors.dark, marginBottom: 8 },
  subtitle: { fontSize: 15, color: colors.gray, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: colors.dark, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lightGray,
    borderRadius: 12, padding: 14, fontSize: 15, color: colors.dark,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerOption: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lightGray,
  },
  pickerOptionSmall: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lightGray,
  },
  pickerActive: { borderColor: colors.primary, backgroundColor: '#FFFBEB' },
  pickerText: { fontSize: 13, color: colors.dark, fontWeight: '500' },
  pickerTextActive: { color: colors.primary },
  button: {
    backgroundColor: colors.primary, paddingVertical: 18, borderRadius: 14,
    alignItems: 'center', marginTop: 32,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 18, fontWeight: '700', color: colors.dark },
})
