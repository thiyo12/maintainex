import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { jobs } from '../../../lib/api'
import { colors } from '../../../lib/colors'
import ProgressSteps from '../../../components/ui/ProgressSteps'
import CategoryPills from '../../../components/ui/CategoryPills'
import PhotoUploader from '../../../components/ui/PhotoUploader'

export default function PostJobScreen() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<any[]>([])
  const [location, setLocation] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [letQuote, setLetQuote] = useState(false)
  const [urgency, setUrgency] = useState('')
  const [prefer, setPrefer] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const steps = ['Job Details', 'Location & Budget', 'Review']
  const charCount = description.length

  const handleNext = () => {
    if (step === 0 && (!category || !title || !description)) {
      Alert.alert('Error', 'Please fill in all required fields')
      return
    }
    if (step === 1 && !location) {
      Alert.alert('Error', 'Please enter a location')
      return
    }
    if (step < 2) setStep(step + 1)
  }

  const handlePost = async () => {
    setSubmitting(true)
    try {
      const budget = letQuote ? 0 : Math.round((Number(budgetMin) + Number(budgetMax)) / 2)
      const job = await jobs.create({
        title,
        description,
        category,
        budget: String(budget),
        location,
      })
      router.push(`/(customer)/jobs/posted-confirm?jobId=${job.id}`)
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to post job')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => step > 0 ? setStep(step - 1) : router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.heading}>Post a job</Text>
      <ProgressSteps current={step} total={3} labels={steps} />

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {step === 0 ? (
          <View>
            <Text style={styles.stepLabel}>Job details</Text>
            <Text style={styles.sectionLabel}>Category</Text>
            <CategoryPills selected={category} onSelect={setCategory} />
            <Text style={styles.sectionLabel}>Job title</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Fix leaking pipe" />
            <Text style={styles.sectionLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what needs to be done"
              multiline
              numberOfLines={4}
            />
            <Text style={styles.charCount}>{charCount} characters</Text>
            <Text style={styles.sectionLabel}>Add photos</Text>
            <PhotoUploader onPhotosChange={setPhotos} />
          </View>
        ) : step === 1 ? (
          <View>
            <Text style={styles.stepLabel}>Location and budget</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, marginTop: 16 }}>
              <Ionicons name="location-outline" size={16} color={colors.dark} />
              <Text style={styles.sectionLabel}> Job location</Text>
            </View>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Enter location or auto-detect"
            />
            <Text style={styles.sectionLabel}>Budget</Text>
            <View style={styles.budgetRow}>
              {!letQuote ? (
                <>
                  <TextInput
                    style={[styles.input, styles.budgetInput]}
                    value={budgetMin}
                    onChangeText={setBudgetMin}
                    placeholder="Min"
                    keyboardType="numeric"
                  />
                  <Text style={styles.budgetSep}>-</Text>
                  <TextInput
                    style={[styles.input, styles.budgetInput]}
                    value={budgetMax}
                    onChangeText={setBudgetMax}
                    placeholder="Max"
                    keyboardType="numeric"
                  />
                  <Text style={styles.currency}>LKR</Text>
                </>
              ) : null}
            </View>
            <TouchableOpacity style={styles.toggleRow} onPress={() => setLetQuote(!letQuote)}>
              <View style={[styles.toggle, letQuote && styles.toggleActive]}>
                {letQuote ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
              </View>
              <Text style={styles.toggleLabel}>Let them quote instead</Text>
            </TouchableOpacity>
            <Text style={styles.sectionLabel}>Urgency</Text>
            <View style={styles.pillRow}>
              {['Today', 'This week', 'Flexible'].map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.pill, urgency === u && styles.pillActive]}
                  onPress={() => setUrgency(u)}
                >
                  <Text style={[styles.pillText, urgency === u && styles.pillTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.sectionLabel}>Prefer</Text>
            <View style={styles.pillRow}>
              {['Tasker', 'Company', 'Both'].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.pill, prefer === p && styles.pillActive]}
                  onPress={() => setPrefer(p)}
                >
                  <Text style={[styles.pillText, prefer === p && styles.pillTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View>
            <Text style={styles.stepLabel}>Review your job</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Category</Text>
                <Text style={styles.summaryValue}>{category || 'Not set'}</Text>
                <TouchableOpacity><Text style={styles.editLink}>Edit</Text></TouchableOpacity>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Title</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>{title}</Text>
                <TouchableOpacity><Text style={styles.editLink}>Edit</Text></TouchableOpacity>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Description</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>{description}</Text>
                <TouchableOpacity><Text style={styles.editLink}>Edit</Text></TouchableOpacity>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Location</Text>
                <Text style={styles.summaryValue}>{location || 'Not set'}</Text>
                <TouchableOpacity><Text style={styles.editLink}>Edit</Text></TouchableOpacity>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Budget</Text>
                <Text style={styles.summaryValue}>
                  {letQuote ? 'Let them quote' : `LKR ${budgetMin || '0'} - ${budgetMax || '0'}`}
                </Text>
                <TouchableOpacity><Text style={styles.editLink}>Edit</Text></TouchableOpacity>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Urgency</Text>
                <Text style={styles.summaryValue}>{urgency || 'Not set'}</Text>
                <TouchableOpacity><Text style={styles.editLink}>Edit</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.nextBtn, step === 2 && { backgroundColor: colors.primary }]}
        onPress={step === 2 ? handlePost : handleNext}
        disabled={submitting}
      >
        <Text style={styles.nextText}>{submitting ? 'Posting...' : step === 2 ? 'Post job' : 'Next'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingHorizontal: 20 },
  backBtn: { marginTop: 12, marginBottom: 8 },
  backText: { fontSize: 15, color: '#6B7280', fontWeight: '500' },
  heading: { fontSize: 24, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  scroll: { flex: 1 },
  stepLabel: { fontSize: 13, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1F2937', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#9CA3AF', textAlign: 'right', marginTop: -8, marginBottom: 8 },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  budgetInput: { flex: 1, textAlign: 'center' },
  budgetSep: { fontSize: 16, color: '#9CA3AF' },
  currency: { fontSize: 14, fontWeight: '600', color: '#374151', marginLeft: 4 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  toggle: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  toggleActive: { backgroundColor: '#059669', borderColor: '#059669' },
  toggleLabel: { fontSize: 14, color: '#374151' },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  pillActive: { borderColor: '#F59E0B', backgroundColor: '#FEF3C7' },
  pillText: { fontSize: 13, color: '#374151' },
  pillTextActive: { color: '#92400E', fontWeight: '600' },
  summaryCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  summaryLabel: { fontSize: 13, color: '#9CA3AF', width: 80 },
  summaryValue: { flex: 1, fontSize: 14, color: '#1F2937' },
  editLink: { fontSize: 13, color: '#3B82F6', fontWeight: '500' },
  nextBtn: { backgroundColor: '#059669', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  nextText: { fontSize: 16, fontWeight: '700', color: '#fff' },
})