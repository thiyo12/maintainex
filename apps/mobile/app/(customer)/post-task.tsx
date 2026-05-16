import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Picker } from '@react-native-picker/picker'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

const DISTRICTS = [
  'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya',
  'Galle', 'Matara', 'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar',
  'Vavuniya', 'Mullaitivu', 'Batticaloa', 'Ampara', 'Trincomalee',
  'Kurunegala', 'Puttalam', 'Anuradhapura', 'Polonnaruwa',
  'Badulla', 'Monaragala', 'Ratnapura', 'Kegalle'
]

export default function PostTaskScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [budget, setBudget] = useState('')
  const [district, setDistrict] = useState('')
  const [urgency, setUrgency] = useState('medium')
  const [address, setAddress] = useState('')
  const [budgetType, setBudgetType] = useState('fixed')

  const handleSubmit = async () => {
    if (!title || title.length < 3) {
      Alert.alert('Error', 'Title must be at least 3 characters')
      return
    }
    if (!description || description.length < 10) {
      Alert.alert('Error', 'Description must be at least 10 characters')
      return
    }
    if (!district) {
      Alert.alert('Error', 'Please select a district')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          budget: budget ? parseFloat(budget) : null,
          budgetType,
          urgency,
          district,
          province: district,
          address: address || null,
          isRemote: false,
          isFlexibleDate: true,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        Alert.alert('Error', data.error || 'Failed to create task')
        return
      }

      Alert.alert(
        'Task Submitted!',
        'Our team will review your task and publish it shortly.',
        [{ text: 'OK', onPress: () => router.replace('/(customer)') }]
      )
    } catch {
      Alert.alert('Error', 'Failed to submit task')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post a Task</Text>
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
          <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
          <View style={[styles.stepDot, step >= 3 && styles.stepDotActive]} />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {step === 1 && (
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Task Details</Text>

            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Need help assembling furniture"
              maxLength={100}
            />
            <Text style={styles.charCount}>{title.length}/100</Text>

            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what you need help with..."
              multiline
              numberOfLines={5}
              maxLength={2000}
            />
            <Text style={styles.charCount}>{description.length}/2000</Text>
          </View>
        )}

        {step === 2 && (
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Location & Budget</Text>

            <Text style={styles.label}>District *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={district}
                onValueChange={setDistrict}
                style={styles.picker}
              >
                <Picker.Item label="Select District" value="" />
                {DISTRICTS.map((d) => (
                  <Picker.Item key={d} label={d} value={d} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Address (Optional)</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="123 Main Street"
            />

            <Text style={styles.label}>Budget (LKR)</Text>
            <TextInput
              style={styles.input}
              value={budget}
              onChangeText={setBudget}
              placeholder="0"
              keyboardType="numeric"
            />

            <Text style={styles.label}>Urgency</Text>
            <View style={styles.urgencyRow}>
              {(['low', 'medium', 'high', 'urgent'] as const).map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[
                    styles.urgencyBtn,
                    urgency === u && styles.urgencyBtnActive,
                    urgency === u && getUrgencyColor(u),
                  ]}
                  onPress={() => setUrgency(u)}
                >
                  <Text style={[styles.urgencyText, urgency === u && { color: '#FFF' }]}>
                    {u.charAt(0).toUpperCase() + u.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Review</Text>
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>{title}</Text>
              <Text style={styles.summaryDesc}>{description}</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>District</Text>
                <Text style={styles.summaryValue}>{district}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Budget</Text>
                <Text style={styles.summaryValue}>{budget ? `LKR ${parseFloat(budget).toLocaleString()}` : 'Negotiable'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Urgency</Text>
                <Text style={styles.summaryValue}>{urgency}</Text>
              </View>
            </View>
            <Text style={styles.note}>
              Your task will be reviewed by our team before publishing. This usually takes a few hours.
            </Text>
          </View>
        )}

        {/* Navigation */}
        <View style={styles.navRow}>
          {step > 1 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)}>
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, loading && styles.nextBtnDisabled]}
            onPress={() => step < 3 ? setStep(step + 1) : handleSubmit()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.nextBtnText}>{step < 3 ? 'Continue' : 'Submit Task'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

function getUrgencyColor(urgency: string) {
  const colors: Record<string, object> = {
    low: { backgroundColor: '#9CA3AF' },
    medium: { backgroundColor: '#3B82F6' },
    high: { backgroundColor: '#F97316' },
    urgent: { backgroundColor: '#EF4444' },
  }
  return colors[urgency]
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { padding: 16, paddingTop: 50, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backText: { fontSize: 14, color: '#6B7280' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginTop: 8 },
  stepIndicator: { flexDirection: 'row', gap: 8, marginTop: 12 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' },
  stepDotActive: { backgroundColor: '#4F46E5' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  form: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 16 },
  textArea: { height: 120, textAlignVertical: 'top' },
  charCount: { fontSize: 12, color: '#9CA3AF', marginTop: -12, marginBottom: 16 },
  pickerContainer: { borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 12, marginBottom: 16 },
  picker: { height: 50 },
  urgencyRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  urgencyBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center' },
  urgencyBtnActive: {},
  urgencyText: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  summary: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, gap: 12 },
  summaryTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  summaryDesc: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 12 },
  summaryLabel: { fontSize: 14, color: '#6B7280' },
  summaryValue: { fontSize: 14, fontWeight: '500', color: '#111827' },
  note: { fontSize: 13, color: '#92400E', backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, marginTop: 16 },
  navRow: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 40 },
  backBtn: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#E5E7EB', alignItems: 'center' },
  backBtnText: { fontSize: 16, fontWeight: '500', color: '#374151' },
  nextBtn: { flex: 2, padding: 16, borderRadius: 12, backgroundColor: '#4F46E5', alignItems: 'center' },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
})
