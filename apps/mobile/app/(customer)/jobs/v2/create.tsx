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

const steps = ['Category', 'Details', 'Budget', 'Location', 'Review']

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

  const stepKeys: Step[] = ['category', 'details', 'budget', 'location', 'review']
  const currentStepIndex = stepKeys.indexOf(step)

  useEffect(() => { loadInitialData() }, [])

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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          title, description, categoryId: selectedCategory.id, photos,
          budgetType, budgetAmount: parseFloat(budgetAmount),
          areaId: selectedArea?.id || null, postalCode: postalCode || null,
          preferredDate: preferredDate || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        Alert.alert('Error', data.error || 'Failed to create job')
        return
      }
      Alert.alert('Published!', 'Your job is now live. Providers can start quoting.', [
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
        <ActivityIndicator size="large" color={colors.amber} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step === 'category' ? router.back() : setStep(stepKeys[currentStepIndex - 1])} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post a Job</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Step Progress */}
      <View style={styles.progressRow}>
        {steps.map((s, i) => (
          <View key={s} style={styles.progressItem}>
            <View style={[styles.progressDot, i <= currentStepIndex && styles.progressDotActive]}>
              {i < currentStepIndex ? (
                <Text style={styles.progressCheck}>✓</Text>
              ) : (
                <Text style={[styles.progressNum, i === currentStepIndex && styles.progressNumActive]}>{i + 1}</Text>
              )}
            </View>
            {i < steps.length - 1 && <View style={[styles.progressLine, i < currentStepIndex && styles.progressLineActive]} />}
          </View>
        ))}
      </View>
      <Text style={styles.progressLabel}>{steps[currentStepIndex]}</Text>

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
                  activeOpacity={0.7}
                >
                  <Text style={styles.categoryIcon}>
                    {cat.iconName === 'hammer' ? '🔨' : cat.iconName === 'tools' ? '🔧' : cat.iconName === 'cleaning' ? '🧹' : cat.iconName === 'paint' ? '🎨' : cat.iconName === 'truck' ? '🚚' : cat.iconName === 'wrench' ? '🔧' : '📋'}
                  </Text>
                  <Text style={[styles.categoryName, selectedCategory?.id === cat.id && styles.categoryNameSelected]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.nextBtn, !selectedCategory && styles.btnDisabled]} onPress={() => { if (selectedCategory) setStep('details') }} disabled={!selectedCategory}>
              <Text style={styles.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'details' && (
          <View>
            <Text style={styles.sectionTitle}>Tell us about the job</Text>
            <Text style={styles.sectionSub}>{selectedCategory?.name}</Text>
            <Text style={styles.label}>Job Title *</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Kitchen cleaning needed" placeholderTextColor={colors.muted} />
            <Text style={styles.label}>Description *</Text>
            <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Describe what needs to be done..." placeholderTextColor={colors.muted} multiline numberOfLines={5} />
            <Text style={styles.label}>Photos (optional)</Text>
            <TouchableOpacity style={styles.photoBtn}>
              <Text style={styles.photoBtnText}>+ Add Photos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.nextBtn, (!title || !description) && styles.btnDisabled]} onPress={() => { if (title && description) setStep('budget'); else Alert.alert('Error', 'Title and description required') }}>
              <Text style={styles.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'budget' && (
          <View>
            <Text style={styles.sectionTitle}>Set your budget</Text>
            <Text style={styles.label}>Budget Type *</Text>
            <View style={styles.budgetTypes}>
              {['FIXED', 'HOURLY', 'NEGOTIABLE', 'REQUEST_QUOTES'].map((bt) => (
                <TouchableOpacity key={bt} style={[styles.budgetCard, budgetType === bt && styles.budgetCardSelected]} onPress={() => setBudgetType(bt)} activeOpacity={0.7}>
                  <Text style={[styles.budgetLabel, budgetType === bt && styles.budgetLabelSelected]}>
                    {bt === 'FIXED' ? 'Fixed Price' : bt === 'HOURLY' ? 'Hourly' : bt === 'NEGOTIABLE' ? 'Negotiable' : 'Request Quotes'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {budgetType !== 'REQUEST_QUOTES' && (
              <>
                <Text style={styles.label}>Budget Amount (LKR) *</Text>
                <TextInput style={styles.input} value={budgetAmount} onChangeText={setBudgetAmount} placeholder="e.g. 5000" placeholderTextColor={colors.muted} keyboardType="numeric" />
              </>
            )}
            <Text style={styles.label}>Preferred Date (optional)</Text>
            <TextInput style={styles.input} value={preferredDate} onChangeText={setPreferredDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
            <TouchableOpacity style={[styles.nextBtn, !budgetType && styles.btnDisabled]} onPress={() => { if (budgetType) setStep('location'); else Alert.alert('Error', 'Select budget type') }}>
              <Text style={styles.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'location' && (
          <View>
            <Text style={styles.sectionTitle}>Where is the job?</Text>
            <Text style={styles.label}>Country *</Text>
            <View style={styles.pickerRow}>
              {countries.map((c) => (
                <TouchableOpacity key={c.id} style={[styles.pill, selectedCountry?.id === c.id && styles.pillSelected]} onPress={() => { setSelectedCountry(c); setSelectedState(null); setSelectedCity(null); setSelectedArea(null) }} activeOpacity={0.7}>
                  <Text style={[styles.pillText, selectedCountry?.id === c.id && styles.pillTextSelected]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {selectedCountry && (
              <>
                <Text style={styles.label}>State/Province *</Text>
                <View style={styles.pickerRow}>
                  {selectedCountry.states.map((s) => (
                    <TouchableOpacity key={s.id} style={[styles.pill, selectedState?.id === s.id && styles.pillSelected]} onPress={() => { setSelectedState(s); setSelectedCity(null); setSelectedArea(null) }} activeOpacity={0.7}>
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
                    <TouchableOpacity key={c.id} style={[styles.pill, selectedCity?.id === c.id && styles.pillSelected]} onPress={() => { setSelectedCity(c); setSelectedArea(null) }} activeOpacity={0.7}>
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
                    <TouchableOpacity key={a.id} style={[styles.pill, selectedArea?.id === a.id && styles.pillSelected]} onPress={() => setSelectedArea(a)} activeOpacity={0.7}>
                      <Text style={[styles.pillText, selectedArea?.id === a.id && styles.pillTextSelected]}>{a.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <Text style={styles.label}>Postal Code</Text>
            <TextInput style={styles.input} value={postalCode} onChangeText={setPostalCode} placeholder="e.g. 10000" placeholderTextColor={colors.muted} />
            <TouchableOpacity style={[styles.nextBtn, (!selectedCountry || !selectedState || !selectedCity) && styles.btnDisabled]} onPress={() => { if (selectedCountry && selectedState && selectedCity) setStep('review'); else Alert.alert('Error', 'Select country, state, and city') }}>
              <Text style={styles.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'review' && (
          <View>
            <Text style={styles.sectionTitle}>Review your job</Text>
            <Text style={styles.sectionSub}>Make sure everything looks right</Text>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Category</Text>
              <Text style={styles.reviewValue}>{selectedCategory?.name}</Text>
            </View>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Title</Text>
              <Text style={styles.reviewValue}>{title}</Text>
            </View>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Description</Text>
              <Text style={styles.reviewValue} numberOfLines={3}>{description}</Text>
            </View>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Budget</Text>
              <Text style={styles.reviewValue}>{budgetType} — LKR {budgetAmount}</Text>
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
            <View style={styles.reviewFooter}>
              <TouchableOpacity onPress={() => setStep('location')}><Text style={styles.backLink}>← Edit</Text></TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.btnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.submitBtnText}>Publish Job</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 60 },
  backText: { fontSize: 16, color: colors.amber, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },

  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, marginTop: 12 },
  progressItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  progressDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  progressDotActive: { backgroundColor: colors.amber },
  progressCheck: { fontSize: 14, color: colors.ink, fontWeight: '700' },
  progressNum: { fontSize: 13, fontWeight: '700', color: colors.muted },
  progressNumActive: { color: colors.ink },
  progressLine: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: 4 },
  progressLineActive: { backgroundColor: colors.amber },
  progressLabel: { textAlign: 'center', fontSize: 13, color: colors.amber, fontWeight: '600', marginTop: 8, marginBottom: 4 },

  content: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  sectionSub: { fontSize: 14, color: colors.muted, marginBottom: 20 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: { width: '47%', padding: 20, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', marginBottom: 8, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  categoryCardSelected: { backgroundColor: colors.amberBg, borderWidth: 2, borderColor: colors.amber },
  categoryIcon: { fontSize: 36, marginBottom: 8 },
  categoryName: { fontSize: 14, fontWeight: '600', color: colors.ink, textAlign: 'center' },
  categoryNameSelected: { color: colors.amberDark },

  label: { fontSize: 14, fontWeight: '600', color: colors.ink, marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 15, color: colors.ink, backgroundColor: colors.white },
  textArea: { height: 120, textAlignVertical: 'top' },
  photoBtn: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, borderStyle: 'dashed', padding: 20, alignItems: 'center', backgroundColor: colors.white },
  photoBtnText: { fontSize: 14, color: colors.amber, fontWeight: '600' },

  budgetTypes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  budgetCard: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border },
  budgetCardSelected: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  budgetLabel: { fontSize: 13, fontWeight: '600', color: colors.muted },
  budgetLabelSelected: { color: colors.amberDark },

  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border },
  pillSelected: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  pillText: { fontSize: 13, fontWeight: '500', color: colors.muted },
  pillTextSelected: { color: colors.amberDark, fontWeight: '600' },

  nextBtn: { backgroundColor: colors.amber, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  btnDisabled: { opacity: 0.5 },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: colors.ink },

  reviewCard: { backgroundColor: colors.white, borderRadius: 12, padding: 16, marginBottom: 10, shadowColor: colors.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  reviewLabel: { fontSize: 12, color: colors.muted, fontWeight: '500', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  reviewValue: { fontSize: 15, color: colors.ink, fontWeight: '600' },
  reviewFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  backLink: { fontSize: 15, color: colors.amber, fontWeight: '600' },
  submitBtn: { backgroundColor: colors.amber, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: colors.ink },
})
