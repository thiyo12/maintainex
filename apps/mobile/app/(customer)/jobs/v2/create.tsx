import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, Animated,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MapPin, Clipboard, Wallet, Question, CheckCircle, ArrowRight, MapPinArea, Buildings, House, Users, User, Building, Briefcase, Camera, CaretLeft, X, Coin, CoinVertical, Diamond, Package, Lightning, Key, PawPrint, Chisel, Drop, Leaf, Desktop, Bug, Truck, Car, Wrench, PaintBrush, Snowflake, Sparkle } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../../lib/ThemeContext'
import { fonts } from '../../../../lib/fonts'
import { getAuthToken } from '../../../../lib/api'
import { matchCategory } from '../../../../lib/aiMatch'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'

interface Category { id: string; name: string; iconName: string }
interface Area { id: string; name: string }

const FALLBACK_CATEGORIES: Category[] = [
  { id: 'cleaning', name: 'Cleaning', iconName: 'Drop' },
  { id: 'electrical', name: 'Electrical', iconName: 'Lightning' },
  { id: 'plumbing', name: 'Plumbing', iconName: 'Wrench' },
  { id: 'painting', name: 'Painting', iconName: 'PaintBrush' },
  { id: 'ac', name: 'AC Service', iconName: 'Snowflake' },
  { id: 'moving', name: 'Moving', iconName: 'Truck' },
  { id: 'gardening', name: 'Gardening', iconName: 'Leaf' },
  { id: 'carpentry', name: 'Carpentry', iconName: 'Chisel' },
  { id: 'digital', name: 'Digital Services', iconName: 'Desktop' },
  { id: 'pest', name: 'Pest Control', iconName: 'Bug' },
  { id: 'renovation', name: 'Renovation', iconName: 'Buildings' },
  { id: 'automotive', name: 'Automotive', iconName: 'Car' },
  { id: 'repairs', name: 'Repairs', iconName: 'Wrench' },
  { id: 'other', name: 'Other', iconName: 'Briefcase' },
]
interface City { id: string; name: string; areas: Area[] }
interface State { id: string; name: string; cities: City[] }
interface Country { id: string; name: string; code: string; states: State[] }

const providerTypes = ['FREELANCER', 'COMPANY', 'BOTH']

const taskQuestions = [
  { key: 'rooms', icon: Buildings, label: 'How many rooms?', visible: ['cleaning', 'painting', 'ac'] },
  { key: 'materials', icon: Package, label: 'Do you have materials?', visible: ['plumbing', 'electrical', 'painting'] },
  { key: 'urgency', icon: Lightning, label: 'How urgent is this?', visible: ['plumbing', 'electrical', 'ac'] },
  { key: 'access', icon: Key, label: 'Access instructions', visible: ['cleaning', 'plumbing', 'electrical', 'ac', 'painting'] },
  { key: 'floor', icon: Buildings, label: 'Which floor?', visible: ['moving', 'cleaning'] },
  { key: 'pets', icon: PawPrint, label: 'Any pets at home?', visible: ['cleaning', 'painting', 'plumbing'] },
]

function useSlideIn(delay = 0) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 6, tension: 80, delay, useNativeDriver: true }).start()
  }, [])
  return anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] })
}

function getCatIcon(name: string) {
  const map: Record<string, any> = {
    cleaning: Drop, electrical: Lightning, plumbing: Wrench, painting: PaintBrush,
    ac: Snowflake, moving: Truck, gardening: Leaf, carpentry: Chisel,
    digital: Desktop, pest: Bug, renovation: Buildings, automotive: Car,
  }
  for (const [k, v] of Object.entries(map)) {
    if (name.toLowerCase().includes(k)) return v
  }
  return Wrench
}

export default function CreateJobScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { t } = useTranslation()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])

  const [countries, setCountries] = useState<Country[]>([])
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null)
  const [selectedState, setSelectedState] = useState<State | null>(null)
  const [selectedCity, setSelectedCity] = useState<City | null>(null)
  const [selectedArea, setSelectedArea] = useState<Area | null>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const [selectedTier, setSelectedTier] = useState('')
  const [providerType, setProviderType] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const [aiQuery, setAiQuery] = useState('')
  const [aiMatchResult, setAiMatchResult] = useState<ReturnType<typeof matchCategory>>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const catsRef = useRef(categories)
  catsRef.current = categories

  const handleAiChange = useCallback((text: string) => {
    setAiQuery(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const result = matchCategory(text)
      setAiMatchResult(result)
      if (result && result.confidence > 90) {
        const match = catsRef.current.find(c => c.name === result.categoryName)
        if (match) setSelectedCategory(match)
      }
    }, 300)
  }, [])

  const filteredCategories = aiQuery.trim()
    ? categories.filter(c => c.name.toLowerCase().includes(aiQuery.toLowerCase()))
    : categories

  const slideAnim = useSlideIn()

  const budgetTiers = [
    { key: 'SMALL', icon: Coin, label: 'Small Job', range: '~ LKR 3,000', amount: 3000 },
    { key: 'MEDIUM', icon: CoinVertical, label: 'Medium Job', range: '~ LKR 8,000', amount: 8000 },
    { key: 'LARGE', icon: Diamond, label: 'Large Job', range: '~ LKR 15,000+', amount: 15000 },
  ]

  const stepMeta = [
    { icon: MapPin, title: 'Where do you need help?', sub: 'Set your location so we can find nearby providers' },
    { icon: Clipboard, title: 'What needs to be done?', sub: 'Choose a category and describe your task' },
    { icon: Wallet, title: 'What\'s your budget?', sub: 'Pick a range that works for you' },
    { icon: Question, title: 'A few details', sub: 'Help providers understand your needs' },
    { icon: CheckCircle, title: 'Review & Post', sub: 'Everything look good?' },
  ]

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
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
        const list = Array.isArray(data) ? data : data.categories || data.data || []
        setCategories(list.length > 0 ? list : FALLBACK_CATEGORIES)
      } else {
        setCategories(FALLBACK_CATEGORIES)
      }
      if (locRes.ok) { const data = await locRes.json(); setCountries(data.countries || []) }
    } catch {
      setCategories(FALLBACK_CATEGORIES)
    } finally { setLoading(false) }
  }

  const handleSubmit = async () => {
    if (!selectedCategory || !title || !description || !selectedTier || !selectedCountry || !selectedState || !selectedCity) {
      Alert.alert('Missing fields', 'Please complete all required fields.'); return
    }
    setSubmitting(true)
    try {
      const budget = budgetTiers.find(t => t.key === selectedTier)!
      const token = await getAuthToken()
      const res = await fetch(`${API_URL}/api/mobile/v2/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title, description: description + (Object.keys(answers).length ? `\n\n---\n${Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join('\n')}` : ''),
          categoryId: selectedCategory.id, budgetType: 'FIXED', budgetAmount: budget.amount,
          providerType: providerType || null, areaId: selectedArea?.id || null, postalCode: null, preferredDate: null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { Alert.alert(t('common.error'), data.error || t('postJob.failed')); return }
      Alert.alert('Job Posted!', 'We\'ll notify you when providers start quoting.', [{ text: 'Great!', onPress: () => router.back() }])
    } catch { Alert.alert(t('common.error'), t('postJob.networkError'))
    } finally { setSubmitting(false) }
  }

  if (loading) {
    return <SafeAreaView style={styles.container}><ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} /></SafeAreaView>
  }

  const StepIcon = stepMeta[step].icon

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 0 ? setStep(step - 1) : router.back()} style={styles.backBtn}>
          {step > 0 ? <CaretLeft size={20} color={colors.ink} weight="bold" /> : <X size={20} color={colors.ink} weight="regular" />}
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Post a Job</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.progressRow}>
        {stepMeta.map((_, i) => (
          <View key={i} style={styles.progressWrap}>
            <View style={[styles.progressDot, i === step && styles.progressDotActive, i < step && styles.progressDotDone]}>
              <Text style={styles.progressDotText}>{i < step ? '✓' : i === step ? '●' : '○'}</Text>
            </View>
            {i < stepMeta.length - 1 && <View style={[styles.progressLine, i < step && styles.progressLineDone]} />}
          </View>
        ))}
      </View>

      <Animated.ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}
        style={{ transform: [{ translateY: slideAnim }] }}>
        <StepIcon size={32} color={colors.amber} weight="fill" style={{ marginBottom: 12 }} />
        <Text style={[styles.sectionTitle, { color: colors.ink }]}>{stepMeta[step].title}</Text>
        <Text style={[styles.sectionSub, { color: colors.muted }]}>{stepMeta[step].sub}</Text>

        {step === 0 && (
          <View style={styles.stepContent}>
            <Text style={styles.label}>Country</Text>
            <View style={styles.pillsWrap}>
              {countries.map((c) => (
                <TouchableOpacity key={c.id} style={[styles.pill, selectedCountry?.id === c.id && styles.pillActive]}
                  onPress={() => { setSelectedCountry(c); setSelectedState(null); setSelectedCity(null); setSelectedArea(null) }}>
                  <Text style={[styles.pillText, selectedCountry?.id === c.id && styles.pillTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {selectedCountry && <> 
              <Text style={styles.label}>State / Province</Text>
              <View style={styles.pillsWrap}>{selectedCountry.states.map((s) => (
                <TouchableOpacity key={s.id} style={[styles.pill, selectedState?.id === s.id && styles.pillActive]}
                  onPress={() => { setSelectedState(s); setSelectedCity(null); setSelectedArea(null) }}>
                  <Text style={[styles.pillText, selectedState?.id === s.id && styles.pillTextActive]}>{s.name}</Text>
                </TouchableOpacity>
              ))}</View>
            </>}
            {selectedState && <>
              <Text style={styles.label}>City</Text>
              <View style={styles.pillsWrap}>{selectedState.cities.map((c) => (
                <TouchableOpacity key={c.id} style={[styles.pill, selectedCity?.id === c.id && styles.pillActive]}
                  onPress={() => { setSelectedCity(c); setSelectedArea(null) }}>
                  <Text style={[styles.pillText, selectedCity?.id === c.id && styles.pillTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}</View>
            </>}
            {selectedCity?.areas.length > 0 && <>
              <Text style={styles.label}>Area</Text>
              <View style={styles.pillsWrap}>{selectedCity.areas.map((a) => (
                <TouchableOpacity key={a.id} style={[styles.pill, selectedArea?.id === a.id && styles.pillActive]}
                  onPress={() => setSelectedArea(a)}>
                  <Text style={[styles.pillText, selectedArea?.id === a.id && styles.pillTextActive]}>{a.name}</Text>
                </TouchableOpacity>
              ))}</View>
            </>}
            <TouchableOpacity style={[styles.nextBtn, (!selectedCountry || !selectedState || !selectedCity) && styles.btnDisabled]}
              onPress={() => { if (selectedCountry && selectedState && selectedCity) setStep(1) }}>
              <ArrowRight size={18} color="#111827" weight="bold" />
              <Text style={styles.btnText}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 1 && (
          <View style={styles.stepContent}>
            {/* AI Search */}
            <View style={[styles.aiSearchWrap, { backgroundColor: colors.white, borderColor: colors.border }]}>
              <Sparkle size={18} color={colors.amber} weight="fill" style={{ marginLeft: 14 }} />
              <TextInput
                style={[styles.aiSearchInput, { color: colors.ink }]}
                value={aiQuery}
                onChangeText={handleAiChange}
                placeholder="What do you need? e.g. fix my sink..."
                placeholderTextColor={colors.muted}
              />
              {aiQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setAiQuery(''); setAiMatchResult(null) }} style={{ paddingRight: 14 }}>
                  <X size={16} color={colors.muted} weight="bold" />
                </TouchableOpacity>
              )}
            </View>
            {aiMatchResult && (
              <TouchableOpacity style={[styles.aiSuggestion, { backgroundColor: colors.amberBg, borderColor: colors.amber }]}
                onPress={() => {
                  const match = categories.find(c => c.name === aiMatchResult.categoryName)
                  if (match) setSelectedCategory(match)
                }}>
                <Sparkle size={16} color={colors.amberDark} weight="fill" />
                <Text style={[styles.aiSuggestionText, { color: colors.amberDark }]}>
                  Did you mean <Text style={{ fontFamily: fonts.headingBold }}>{aiMatchResult.categoryName}</Text>? ({(aiMatchResult.confidence)}% match)
                </Text>
              </TouchableOpacity>
            )}
            <Text style={styles.label}>Category {aiQuery.trim() ? `(${filteredCategories.length})` : ''}</Text>
            {filteredCategories.length === 0 ? (
              <View style={[styles.emptyCats, { backgroundColor: colors.white, borderColor: colors.border }]}>
                <Text style={[styles.emptyCatsText, { color: colors.muted }]}>No categories match "{aiQuery}"</Text>
              </View>
            ) : (
            <View style={styles.catGrid}>
              {filteredCategories.map((cat) => {
                const CatIcon = getCatIcon(cat.name)
                return (
                <TouchableOpacity key={cat.id} style={[styles.catCard, { backgroundColor: colors.white, borderColor: colors.border }, selectedCategory?.id === cat.id && styles.catCardActive]}
                  onPress={() => setSelectedCategory(cat)}>
                  <CatIcon size={32} color={selectedCategory?.id === cat.id ? colors.amberDark : colors.muted} weight="fill" style={{ marginBottom: 8 }} />
                  <Text style={[styles.catName, { color: colors.ink }, selectedCategory?.id === cat.id && { color: colors.amberDark }]}>{cat.name}</Text>
                </TouchableOpacity>
                )
              })}
            </View>
            )}
            <Text style={styles.label}>Title</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.white, borderColor: colors.border }]}>
              <TextInput style={[styles.input, { color: colors.ink }]} value={title} onChangeText={setTitle}
                placeholder="e.g. Fix leaking kitchen pipe" placeholderTextColor={colors.muted} />
            </View>
            <Text style={styles.label}>Description</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.white, borderColor: colors.border }]}>
              <TextInput style={[styles.input, styles.textArea, { color: colors.ink }]}
                value={description} onChangeText={(t) => setDescription(t.slice(0, 2000))}
                placeholder="Describe your task..." placeholderTextColor={colors.muted} multiline numberOfLines={4} />
            </View>
            <Text style={[styles.charHint, { color: colors.muted }]}>{description.length}/2000</Text>
            <TouchableOpacity style={[styles.nextBtn, (!selectedCategory || !title || !description) && styles.btnDisabled]}
              onPress={() => { if (selectedCategory && title && description) setStep(2) }}>
              <ArrowRight size={18} color="#111827" weight="bold" />
              <Text style={styles.btnText}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContent}>
            {budgetTiers.map((tier) => (
              <TouchableOpacity key={tier.key} style={[styles.budgetCard, { backgroundColor: colors.white, borderColor: colors.border }, selectedTier === tier.key && styles.budgetCardActive]}
                onPress={() => setSelectedTier(tier.key)}>
                <tier.icon size={24} color={colors.amberDark} weight="fill" style={{ marginRight: 14 }} />
                <View style={styles.budgetInfo}>
                  <Text style={[styles.budgetLabel, { color: colors.ink }]}>{tier.label}</Text>
                  <Text style={[styles.budgetRange, { color: colors.muted }]}>{tier.range}</Text>
                </View>
                <View style={[styles.budgetCheck, selectedTier === tier.key && { backgroundColor: colors.amber }]}>
                  {selectedTier === tier.key && <CheckCircle size={16} color="#111827" weight="fill" />}
                </View>
              </TouchableOpacity>
            ))}
            <Text style={styles.label}>Provider preference</Text>
            <View style={styles.providerRow}>
              {providerTypes.map((p) => (
                <TouchableOpacity key={p} style={[styles.providerChip, { backgroundColor: colors.white, borderColor: colors.border }, providerType === p && styles.providerChipActive]}
                  onPress={() => setProviderType(p)}>
                  {p === 'FREELANCER' ? <User size={16} color={providerType === p ? colors.amberDark : colors.muted} weight="fill" /> :
                   p === 'COMPANY' ? <Buildings size={16} color={providerType === p ? colors.amberDark : colors.muted} weight="fill" /> :
                   <Users size={16} color={providerType === p ? colors.amberDark : colors.muted} weight="fill" />}
                  <Text style={[styles.providerText, { color: providerType === p ? colors.amberDark : colors.muted }]}>
                    {p === 'FREELANCER' ? 'Freelancer' : p === 'COMPANY' ? 'Company' : 'Both'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.nextBtn, !selectedTier && styles.btnDisabled]}
              onPress={() => { if (selectedTier) setStep(3) }}>
              <ArrowRight size={18} color="#111827" weight="bold" />
              <Text style={styles.btnText}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContent}>
            <TouchableOpacity style={[styles.photoCard, { backgroundColor: colors.white, borderColor: colors.border }]}
              onPress={() => { if (photos.length > 0) setPhotos([]); else setPhotos(['dummy']) }}>
              <Camera size={22} color={colors.muted} weight="regular" />
              <Text style={[styles.photoText, { color: colors.muted }]}>
                {photos.length > 0 ? `${photos.length} photo(s) added` : 'Add photos (optional)'}
              </Text>
            </TouchableOpacity>
            {taskQuestions.filter(q => !selectedCategory || q.visible.some(v => selectedCategory.name.toLowerCase().includes(v))).map((q) => {
              const QIcon = q.icon
              return (
              <View key={q.key} style={[styles.questionCard, { backgroundColor: colors.white, borderColor: colors.border }]}>
                <QIcon size={20} color={colors.amberDark} weight="fill" style={{ marginRight: 12 }} />
                <View style={styles.questionInputWrap}>
                  <Text style={[styles.questionLabel, { color: colors.ink }]}>{q.label}</Text>
                  <TextInput style={[styles.questionInput, { color: colors.ink }]} value={answers[q.key] || ''}
                    onChangeText={(t) => setAnswers(prev => ({ ...prev, [q.key]: t }))}
                    placeholder="Type your answer..." placeholderTextColor={colors.muted} />
                </View>
              </View>
              )
            })}
            <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(4)}>
              <ArrowRight size={18} color="#111827" weight="bold" />
              <Text style={styles.btnText}>Review</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContent}>
            <View style={[styles.reviewCard, { backgroundColor: colors.white, borderColor: colors.border }]}>
              {[
                { icon: MapPin, label: 'Location', value: selectedArea?.name || selectedCity?.name + ', ' + selectedState?.name },
                { icon: Clipboard, label: 'Category', value: selectedCategory?.name },
                { icon: Clipboard, label: 'Title', value: title },
                { icon: Wallet, label: 'Budget', value: budgetTiers.find(t => t.key === selectedTier)?.label + ' ' + budgetTiers.find(t => t.key === selectedTier)?.range },
                { icon: Users, label: 'Provider', value: providerType || 'Any' },
              ].map((item, i) => {
                const RIcon = item.icon
                return (
                <View key={i} style={[styles.reviewItem, i < 4 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <RIcon size={18} color={colors.amberDark} weight="fill" />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={[styles.reviewItemLabel, { color: colors.muted }]}>{item.label}</Text>
                    <Text style={[styles.reviewItemValue, { color: colors.ink }]}>{item.value}</Text>
                  </View>
                </View>
                )
              })}
            </View>
            <TouchableOpacity style={[styles.submitBtn, submitting && styles.btnDisabled]}
              onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#111827" /> : <>
                <CheckCircle size={20} color="#111827" weight="fill" />
                <Text style={styles.submitText}>Post Job</Text>
              </>}
            </TouchableOpacity>
          </View>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { width: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: fonts.headingBold },
  scroll: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 24, fontFamily: fonts.heading, marginBottom: 4 },
  sectionSub: { fontSize: 14, fontFamily: fonts.body, marginBottom: 24, lineHeight: 20 },
  label: { fontSize: 14, fontFamily: fonts.bodyMedium, marginBottom: 8, marginTop: 16, color: colors.ink },
  stepContent: {},

  progressRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 20 },
  progressWrap: { flexDirection: 'row', alignItems: 'center' },
  progressDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  progressDotActive: { borderColor: colors.amber, backgroundColor: colors.amber },
  progressDotDone: { borderColor: colors.success, backgroundColor: colors.success },
  progressDotText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#fff' },
  progressLine: { width: 32, height: 2, backgroundColor: colors.border, marginHorizontal: 4 },
  progressLineDone: { backgroundColor: colors.success },

  pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 100, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border },
  pillActive: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  pillText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.muted },
  pillTextActive: { color: colors.amberDark },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catCard: { width: '47%', padding: 18, borderRadius: 20, alignItems: 'center', marginBottom: 8, borderWidth: 1.5 },
  catCardActive: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  catName: { fontSize: 13, fontFamily: fonts.bodyMedium, textAlign: 'center' },
  emptyCats: { borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1.5, borderStyle: 'dashed' },
  emptyCatsText: { fontSize: 13, fontFamily: fonts.body, textAlign: 'center' },

  aiSearchWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1.5, marginBottom: 4 },
  aiSearchInput: { flex: 1, padding: 14, fontSize: 14, fontFamily: fonts.body },
  aiSuggestion: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, borderWidth: 1.5, marginBottom: 8 },
  aiSuggestionText: { fontSize: 12, fontFamily: fonts.bodyMedium, flex: 1 },

  inputWrap: { borderRadius: 18, borderWidth: 1.5, overflow: 'hidden' },
  input: { padding: 16, fontSize: 15, fontFamily: fonts.body },
  textArea: { height: 120, textAlignVertical: 'top' },
  charHint: { textAlign: 'right', fontSize: 12, fontFamily: fonts.body, marginTop: 4 },

  budgetCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20, borderWidth: 1.5, marginBottom: 10 },
  budgetCardActive: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  budgetInfo: { flex: 1 },
  budgetLabel: { fontSize: 16, fontFamily: fonts.bodyMedium, marginBottom: 2 },
  budgetRange: { fontSize: 13, fontFamily: fonts.body },
  budgetCheck: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.amber, justifyContent: 'center', alignItems: 'center' },

  providerRow: { flexDirection: 'row', gap: 8 },
  providerChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 100, borderWidth: 1.5 },
  providerChipActive: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  providerText: { fontSize: 13, fontFamily: fonts.bodyMedium },

  photoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', marginBottom: 16 },
  photoText: { fontSize: 14, fontFamily: fonts.bodyMedium },
  questionCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1.5, marginBottom: 10 },
  questionInputWrap: { flex: 1 },
  questionLabel: { fontSize: 13, fontFamily: fonts.bodyMedium, marginBottom: 2 },
  questionInput: { fontSize: 14, fontFamily: fonts.body, padding: 0 },

  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.amber, paddingVertical: 16, borderRadius: 100, marginTop: 28 },
  btnText: { fontSize: 17, fontFamily: fonts.bodySemiBold, color: '#111827' },
  btnDisabled: { opacity: 0.4 },

  reviewCard: { borderRadius: 20, padding: 4, borderWidth: 1.5, overflow: 'hidden' },
  reviewItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14 },
  reviewItemLabel: { fontSize: 11, fontFamily: fonts.body, textTransform: 'uppercase', letterSpacing: 0.5 },
  reviewItemValue: { fontSize: 15, fontFamily: fonts.bodyMedium, marginTop: 1 },

  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.amber, paddingVertical: 18, borderRadius: 100, marginTop: 20 },
  submitText: { fontSize: 17, fontFamily: fonts.bodySemiBold, color: '#111827' },
})
