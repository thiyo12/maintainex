import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../../../lib/colors'
import { getAuthToken } from '../../../../lib/api'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'

interface Category { id: string; name: string; iconName: string }
interface Area { id: string; name: string }
interface City { id: string; name: string; areas: Area[] }
interface State { id: string; name: string; cities: City[] }
interface Country { id: string; name: string; code: string; states: State[] }

type Step = 'category' | 'details' | 'budget' | 'location' | 'review'

export default function CreateJobScreen() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('category')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [categories, setCategories] = useState<Category[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<string[]>([])

  const [budgetType, setBudgetType] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')

  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null)
  const [selectedState, setSelectedState] = useState<State | null>(null)
  const [selectedCity, setSelectedCity] = useState<City | null>(null)
  const [selectedArea, setSelectedArea] = useState<Area | null>(null)
  const [postalCode, setPostalCode] = useState('')
  const [preferredDate, setPreferredDate] = useState('')

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      const token = await getAuthToken()
      const headers: any = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const [catRes, locRes] = await Promise.all([
        fetch(`${API_URL}/api/mobile/job-categories`, { headers }),
        fetch(`${API_URL}/api/mobile/v2/locations`, { headers }),
      ])

      if (catRes.ok) {
        const data = await catRes.json()
        setCategories(data.filter((c: any) => c.isActive !== false))
      }
      if (locRes.ok) {
        const data = await locRes.json()
        setCountries(data.countries || [])
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedCategory || !title || !description || !budgetType || !budgetAmount) {
      Alert.alert('Error', 'Please fill in all required fields')
      return
    }

    setSubmitting(true)
    try {
      const token = await getAuthToken()
      const res = await fetch(`${API_URL}/api/mobile/v2/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          categoryId: selectedCategory.id,
          photos,
          budgetType,
          budgetAmount: parseFloat(budgetAmount),
          areaId: selectedArea?.id || null,
          postalCode: postalCode || null,
          preferredDate: preferredDate || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        Alert.alert('Error', data.error || 'Failed to create job')
        return
      }

      Alert.alert('Success', 'Job published successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (err) {
      Alert.alert('Error', 'Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    )
  }

  const stepIndicator = ['Category', 'Details', 'Budget', 'Location', 'Review']
  const stepKeys: Step[] = ['category', 'details', 'budget', 'location', 'review']
  const currentStepIndex = stepKeys.indexOf(step)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post a Job</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Step Indicator */}
      <View style={styles.stepsRow}>
        {stepIndicator.map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View style={[styles.stepDot, i <= currentStepIndex && styles.stepDotActive]}>
              <Text style={[styles.stepDotText, i <= currentStepIndex && styles.stepDotTextActive]}>
                {i + 1}
              </Text>
            </View>
            <Text style={[styles.stepLabel, i <= currentStepIndex && styles.stepLabelActive]}>
              {s}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {step === 'category' && (
          <View>
            <Text style={styles.sectionTitle}>What do you need done?</Text>
            <Text style={styles.sectionSub}>Choose a category</Text>
            <View style={styles.categoryGrid}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryCard, selectedCategory?.id === cat.id && styles.categoryCardSelected]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.categoryIcon]}>{cat.iconName === 'hammer' ? '🔨' : cat.iconName === 'tools' ? '🔧' : cat.iconName === 'cleaning' ? '🧹' : cat.iconName === 'paint' ? '🎨' : cat.iconName === 'truck' ? '🚚' : cat.iconName === 'wrench' ? '🔧' : '📋'}</Text>
                  <Text style={[styles.categoryName, selectedCategory?.id === cat.id && styles.categoryNameSelected]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.nextBtn} onPress={() => { if (selectedCategory) setStep('details') }}>
              <Text style={styles.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'details' && (
          <View>
            <Text style={styles.sectionTitle}>Tell us about the job</Text>
            <Text style={styles.sectionSub}>{selectedCategory?.name}</Text>

            <Text style={styles.label}>Job Title *</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Kitchen cleaning needed" placeholderTextColor="#999" />

            <Text style={styles.label}>Description *</Text>
            <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Describe what needs to be done..." placeholderTextColor="#999" multiline numberOfLines={5} />

            <Text style={styles.label}>Photos (optional)</Text>
            <TouchableOpacity style={styles.photoBtn}>
              <Text style={styles.photoBtnText}>+ Add Photos</Text>
            </TouchableOpacity>

            <View style={styles.navRow}>
              <TouchableOpacity onPress={() => setStep('category')}><Text style={styles.backLink}>← Back</Text></TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={() => { if (title && description) setStep('budget'); else Alert.alert('Error', 'Title and description required') }}>
                <Text style={styles.nextBtnText}>Next →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 'budget' && (
          <View>
            <Text style={styles.sectionTitle}>Set your budget</Text>

            <Text style={styles.label}>Budget Type *</Text>
            <View style={styles.budgetTypes}>
              {['FIXED', 'HOURLY', 'NEGOTIABLE', 'REQUEST_QUOTES'].map((bt) => (
                <TouchableOpacity key={bt} style={[styles.budgetCard, budgetType === bt && styles.budgetCardSelected]} onPress={() => setBudgetType(bt)}>
                  <Text style={[styles.budgetLabel, budgetType === bt && styles.budgetLabelSelected]}>
                    {bt === 'FIXED' ? 'Fixed Price' : bt === 'HOURLY' ? 'Hourly' : bt === 'NEGOTIABLE' ? 'Negotiable' : 'Request Quotes'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {budgetType !== 'REQUEST_QUOTES' && (
              <>
                <Text style={styles.label}>Budget Amount *</Text>
                <TextInput style={styles.input} value={budgetAmount} onChangeText={setBudgetAmount} placeholder="e.g. 5000" placeholderTextColor="#999" keyboardType="numeric" />
              </>
            )}

            <Text style={styles.label}>Preferred Date (optional)</Text>
            <TextInput style={styles.input} value={preferredDate} onChangeText={setPreferredDate} placeholder="YYYY-MM-DD" placeholderTextColor="#999" />

            <View style={styles.navRow}>
              <TouchableOpacity onPress={() => setStep('details')}><Text style={styles.backLink}>← Back</Text></TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={() => { if (budgetType) setStep('location'); else Alert.alert('Error', 'Select budget type') }}>
                <Text style={styles.nextBtnText}>Next →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 'location' && (
          <View>
            <Text style={styles.sectionTitle}>Where is the job?</Text>

            <Text style={styles.label}>Country *</Text>
            <View style={styles.pickerRow}>
              {countries.map((c) => (
                <TouchableOpacity key={c.id} style={[styles.pill, selectedCountry?.id === c.id && styles.pillSelected]} onPress={() => { setSelectedCountry(c); setSelectedState(null); setSelectedCity(null); setSelectedArea(null) }}>
                  <Text style={[styles.pillText, selectedCountry?.id === c.id && styles.pillTextSelected]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedCountry && (
              <>
                <Text style={styles.label}>State/Province *</Text>
                <View style={styles.pickerRow}>
                  {selectedCountry.states.map((s) => (
                    <TouchableOpacity key={s.id} style={[styles.pill, selectedState?.id === s.id && styles.pillSelected]} onPress={() => { setSelectedState(s); setSelectedCity(null); setSelectedArea(null) }}>
                      <Text style={[styles.pillText, selectedState?.id === s.id && styles.pillTextSelected]}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {selectedState && (
              <>
                <Text style={styles.label}>City *</Text>
                <View style={styles.pickerRow}>
                  {selectedState.cities.map((c) => (
                    <TouchableOpacity key={c.id} style={[styles.pill, selectedCity?.id === c.id && styles.pillSelected]} onPress={() => { setSelectedCity(c); setSelectedArea(null) }}>
                      <Text style={[styles.pillText, selectedCity?.id === c.id && styles.pillTextSelected]}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {selectedCity && selectedCity.areas.length > 0 && (
              <>
                <Text style={styles.label}>Area *</Text>
                <View style={styles.pickerRow}>
                  {selectedCity.areas.map((a) => (
                    <TouchableOpacity key={a.id} style={[styles.pill, selectedArea?.id === a.id && styles.pillSelected]} onPress={() => setSelectedArea(a)}>
                      <Text style={[styles.pillText, selectedArea?.id === a.id && styles.pillTextSelected]}>{a.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.label}>Postal Code</Text>
            <TextInput style={styles.input} value={postalCode} onChangeText={setPostalCode} placeholder="e.g. 10000" placeholderTextColor="#999" />

            <View style={styles.navRow}>
              <TouchableOpacity onPress={() => setStep('budget')}><Text style={styles.backLink}>← Back</Text></TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={() => { if (selectedCountry && selectedState && selectedCity) setStep('review'); else Alert.alert('Error', 'Select country, state, and city') }}>
                <Text style={styles.nextBtnText}>Next →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 'review' && (
          <View>
            <Text style={styles.sectionTitle}>Review your job</Text>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Category</Text>
              <Text style={styles.reviewValue}>{selectedCategory?.name}</Text>
            </View>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Title</Text>
              <Text style={styles.reviewValue}>{title}</Text>
            </View>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Budget</Text>
              <Text style={styles.reviewValue}>{budgetType} — {budgetAmount}</Text>
            </View>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Location</Text>
              <Text style={styles.reviewValue}>{selectedArea?.name || selectedCity?.name}, {selectedState?.name}, {selectedCountry?.name}</Text>
            </View>
            {preferredDate ? (
              <View style={styles.reviewCard}>
                <Text style={styles.reviewLabel}>Preferred Date</Text>
                <Text style={styles.reviewValue}>{preferredDate}</Text>
              </View>
            ) : null}

            <View style={styles.navRow}>
              <TouchableOpacity onPress={() => setStep('location')}><Text style={styles.backLink}>← Back</Text></TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Publish Job</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  backBtn: { width: 60 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  stepsRow: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  stepItem: { alignItems: 'center', width: 64 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e5e5e5', justifyContent: 'center', alignItems: 'center' },
  stepDotActive: { backgroundColor: colors.primary },
  stepDotText: { fontSize: 13, fontWeight: '700', color: '#999' },
  stepDotTextActive: { color: '#1a1a1a' },
  stepLabel: { fontSize: 11, color: '#999', marginTop: 4, textAlign: 'center' },
  stepLabelActive: { color: '#1a1a1a', fontWeight: '600' },
  content: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  sectionSub: { fontSize: 14, color: '#666', marginBottom: 20 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: { width: '47%', padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e5e5', alignItems: 'center', marginBottom: 8 },
  categoryCardSelected: { borderColor: colors.primary, backgroundColor: '#FFF8E1' },
  categoryIcon: { fontSize: 32, marginBottom: 8 },
  categoryName: { fontSize: 14, fontWeight: '600', color: '#333', textAlign: 'center' },
  categoryNameSelected: { color: colors.primary },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 10, padding: 14, fontSize: 15, color: '#333', backgroundColor: '#fafafa' },
  textArea: { height: 120, textAlignVertical: 'top' },
  photoBtn: { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 10, borderStyle: 'dashed', padding: 20, alignItems: 'center', backgroundColor: '#fafafa' },
  photoBtnText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  budgetTypes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  budgetCard: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#e0e0e0' },
  budgetCardSelected: { borderColor: colors.primary, backgroundColor: '#FFF8E1' },
  budgetLabel: { fontSize: 13, fontWeight: '600', color: '#666' },
  budgetLabelSelected: { color: colors.primary },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e0e0e0', backgroundColor: '#fafafa' },
  pillSelected: { borderColor: colors.primary, backgroundColor: '#FFF8E1' },
  pillText: { fontSize: 13, fontWeight: '500', color: '#666' },
  pillTextSelected: { color: colors.primary, fontWeight: '600' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  nextBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  nextBtnText: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  backLink: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  reviewCard: { backgroundColor: '#f9f9f9', borderRadius: 10, padding: 14, marginBottom: 8 },
  reviewLabel: { fontSize: 12, color: '#999', fontWeight: '500', marginBottom: 2 },
  reviewValue: { fontSize: 15, color: '#1a1a1a', fontWeight: '600' },
  submitBtn: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
})
