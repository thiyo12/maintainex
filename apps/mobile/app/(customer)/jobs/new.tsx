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