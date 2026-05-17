import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import ProgressSteps from '../../../components/ui/ProgressSteps'
import CategoryPills from '../../../components/ui/CategoryPills'
import PhotoUploader from '../../../components/ui/PhotoUploader'

const colors = {
  primary: '#F59E0B',
  purple: '#7C3AED',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  background: '#F9FAFB',
  white: '#FFFFFF',
}

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

  const handlePost = () => {
    router.push('/(customer)/jobs/posted-confirm')
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
            <Text style={styles.sectionLabel}>📍 Job location</Text>
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
                {letQuote ? <Text style={styles.toggleCheck}>✓</Text> : null}
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
        style={[styles.nextBtn, step === 2 && { backgroundColor: colors.purple }]}
        onPress={step === 2 ? handlePost : handleNext}
      >
        <Text style={styles.nextText}>{step === 2 ? 'Post job' : 'Next'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backBtn: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark, paddingHorizontal: 24, marginBottom: 4 },
  scroll: { paddingHorizontal: 24, flex: 1 },
  stepLabel: { fontSize: 14, fontWeight: '600', color: colors.gray, marginBottom: 16, marginTop: 8 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: colors.dark, marginTop: 16, marginBottom: 8 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.dark,
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 12, color: colors.gray, textAlign: 'right', marginTop: 4 },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  budgetInput: { flex: 1 },
  budgetSep: { fontSize: 18, color: colors.gray },
  currency: { fontSize: 15, fontWeight: '700', color: colors.dark },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 },
  toggle: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleCheck: { color: colors.white, fontSize: 12, fontWeight: '700' },
  toggleLabel: { fontSize: 14, color: colors.dark },
  pillRow: { flexDirection: 'row', gap: 10 },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    backgroundColor: colors.white,
  },
  pillActive: { borderColor: colors.primary, backgroundColor: '#FFFBEB' },
  pillText: { fontSize: 14, fontWeight: '600', color: colors.dark },
  pillTextActive: { color: colors.primary },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  summaryLabel: { fontSize: 13, fontWeight: '600', color: colors.gray, width: 80 },
  summaryValue: { flex: 1, fontSize: 14, color: colors.dark },
  editLink: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  nextBtn: {
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  nextText: { fontSize: 17, fontWeight: '700', color: colors.white },
})
