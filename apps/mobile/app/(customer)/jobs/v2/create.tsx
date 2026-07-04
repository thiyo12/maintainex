import { Component, useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, Animated,
} from 'react-native'

class ErrorBoundary extends Component<{ children: any }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: any) {
    const stack = info?.componentStack || ''
    const lines = stack.split('\n').filter(l => l.trim()).slice(0, 5)
    Alert.alert('Error', (error?.message || String(error)) + '\n\nIn:\n' + lines.join('\n'))
  }
  render() {
    if (this.state.error) return null
    return this.props.children
  }
}
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { MapPin, Clipboard, Wallet, Question, CheckCircle, ArrowRight, MapPinArea, Buildings, House, Users, User, Building, Briefcase, Camera, CaretLeft, X, Coin, CoinVertical, Diamond, Package, Lightning, Key, PawPrint, Hammer, Drop, Leaf, Desktop, Bug, Truck, Car, Wrench, PaintBrush, Snowflake, Sparkle, Trash, Clock, Star, Warning } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { v2Pricing, v2SubTasks, type SubTask } from '../../../../lib/api-v2'
import { useColors } from '../../../../lib/ThemeContext'
import { fonts } from '../../../../lib/fonts'
import { getAuthToken, upload, templateJobs } from '../../../../lib/api'
import { matchCategory } from '../../../../lib/aiMatch'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'

interface Category { id: string; name: string; iconName: string }
interface Area { id: string; name: string }
interface PhotoItem { uri: string; url?: string }

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

const ICON_MAP: Record<string, (props: any) => JSX.Element> = {
  cleaning: Drop, electrical: Lightning, plumbing: Wrench, painting: PaintBrush,
  ac: Snowflake, moving: Truck, gardening: Leaf,   carpentry: Hammer,
  digital: Desktop, pest: Bug, renovation: Buildings, automotive: Car,
}

function getCatIcon(name?: string): (props: any) => JSX.Element {
  if (!name) return Wrench
  for (const [k, v] of Object.entries(ICON_MAP)) {
    if (name.toLowerCase().includes(k)) return v
  }
  return Wrench
}

export default function CreateJobScreen() {
  return (
    <ErrorBoundary>
      <CreateJobScreenInner />
    </ErrorBoundary>
  )
}

function CreateJobScreenInner() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { t } = useTranslation()
  const { templateJobId, title: prefillTitle } = useLocalSearchParams<{ templateJobId?: string; title?: string }>()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [photos, setPhotos] = useState<PhotoItem[]>([])

  const [countries, setCountries] = useState<Country[]>([])
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null)
  const [selectedState, setSelectedState] = useState<State | null>(null)
  const [selectedCity, setSelectedCity] = useState<City | null>(null)
  const [selectedArea, setSelectedArea] = useState<Area | null>(null)
  const [address, setAddress] = useState('')

  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const [selectedTier, setSelectedTier] = useState('')
  const [providerType, setProviderType] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const [urgency, setUrgency] = useState<string>('normal')
  const [estimatedDuration, setEstimatedDuration] = useState<string>('')
  const [workersCount, setWorkersCount] = useState<string>('1')
  const [preferredDate, setPreferredDate] = useState<string>('')
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<string>('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [customDate, setCustomDate] = useState('')
  const [priceEstimate, setPriceEstimate] = useState<any>(null)
  const [pricingLoading, setPricingLoading] = useState(false)
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})
  const [showErrors, setShowErrors] = useState(false)

  const [subTasks, setSubTasks] = useState<SubTask[]>([])
  const [selectedSubTasks, setSelectedSubTasks] = useState<string[]>([])
  const [subTasksLoading, setSubTasksLoading] = useState(false)
  const [expandedSubTask, setExpandedSubTask] = useState<string | null>(null)

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
        const match = catsRef.current.find(c => c.name && c.name === result.categoryName)
        if (match) setSelectedCategory(match)
      }
    }, 300)
  }, [])

  const filteredCategories = aiQuery.trim()
    ? categories.filter(c => c.name && c.name.toLowerCase().includes(aiQuery.toLowerCase()))
    : categories

  const slideAnim = useSlideIn()

  const isLK = selectedCountry?.code !== 'CAN'
  const currencySymbol = isLK ? 'Rs' : 'CAD'

  const getSubTaskPrice = (st: SubTask) => isLK ? st.priceRangeLKR : st.priceRangeCAD
  const toggleSubTask = (id: string) => {
    setSelectedSubTasks(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }
  const selectedSubTaskTotal = subTasks
    .filter(st => selectedSubTasks.includes(st.id))
    .reduce((sum, st) => {
      const p = getSubTaskPrice(st)
      return { min: sum.min + p.min, max: sum.max + p.max }
    }, { min: 0, max: 0 })

  const budgetTiers = [
    { key: 'SMALL', icon: Coin, label: 'Small Job', range: '~ LKR 3,000', amount: 3000 },
    { key: 'MEDIUM', icon: CoinVertical, label: 'Medium Job', range: '~ LKR 8,000', amount: 8000 },
    { key: 'LARGE', icon: Diamond, label: 'Large Job', range: '~ LKR 15,000+', amount: 15000 },
  ]

  const stepMeta = [
    { icon: MapPin, title: 'Where do you need help?', sub: 'Set your location so we can find nearby providers' },
    { icon: Clipboard, title: 'What needs to be done?', sub: 'Choose a category and describe your task' },
    { icon: Wallet, title: 'What\'s your budget?', sub: 'Pick a range that works for you' },
    { icon: Question, title: 'When & Details', sub: 'Pick a date, time, and how many workers' },
    { icon: MapPinArea, title: 'Pricing Preview', sub: 'See estimated cost before posting' },
    { icon: CheckCircle, title: 'Review & Post', sub: 'Everything look good?' },
  ]

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (selectedCategory && subTasks.length === 0) {
      setSubTasksLoading(true)
      v2SubTasks.getByCategory(selectedCategory.id, selectedCategory.name)
        .then(res => setSubTasks(res.subTasks || []))
        .catch(() => setSubTasks([]))
        .finally(() => setSubTasksLoading(false))
    }
  }, [selectedCategory?.id])

  useEffect(() => {
    if (step === 4 && selectedCategory && !priceEstimate && !pricingLoading) {
      fetchPriceEstimate()
    }
  }, [step, selectedCategory])

  const fetchPriceEstimate = async () => {
    if (!selectedCategory || !selectedCountry) return
    setPricingLoading(true)
    try {
      const countryCode = selectedCountry.code === 'CAN' ? 'CA' : 'LK'
      const estimate = await v2Pricing.getEstimate({
        categoryId: selectedCategory.id,
        categoryName: selectedCategory.name,
        description: [description, ...selectedSubTasks.map(sid => subTasks.find(s => s.id === sid)?.name || '')].filter(Boolean).join(', '),
        title,
        areaId: selectedArea?.id,
        cityId: selectedCity?.id,
        countryCode,
        urgency,
        preferredDate: preferredDate || undefined,
        preferredTime: preferredTimeSlot || undefined,
        estimatedDuration: estimatedDuration ? Number(estimatedDuration) : undefined,
        workersCount: workersCount ? Number(workersCount) : undefined,
      })
      setPriceEstimate(estimate)
    } catch {
      Alert.alert('Pricing Error', 'Could not estimate price. You can continue without it.')
    } finally {
      setPricingLoading(false)
    }
  }

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
      if (templateJobId) {
        try {
          const templateData = await templateJobs.get(templateJobId)
          setTitle(templateData.name)
          setDescription(templateData.description || '')
          if (templateData.category) {
            setSelectedCategory(templateData.category as any)
          }
        } catch {
          if (prefillTitle) setTitle(prefillTitle)
        }
      } else if (prefillTitle) {
        setTitle(prefillTitle)
      }
    } catch {
      setCategories(FALLBACK_CATEGORIES)
      if (prefillTitle) setTitle(prefillTitle)
    } finally { setLoading(false) }
  }

  const handleSubmit = async () => {
    if (!selectedCategory || !title || !description || selectedSubTasks.length === 0 || !selectedCountry || !selectedState || !selectedCity) {
      Alert.alert('Missing fields', 'Please complete all required fields.'); return
    }
    setSubmitting(true)
    try {
      const token = await getAuthToken()

      let photoUrls: string[] = []
      for (const p of photos) {
        try {
          const uploaded = await upload.file(p.uri)
          photoUrls.push(uploaded.url)
        } catch {}
      }

      const res = await fetch(`${API_URL}/api/mobile/v2/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title,
          description: [description, address ? `Address: ${address}` : '', Object.keys(answers).length ? `\n---\n${Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join('\n')}` : '', selectedSubTasks.length > 0 ? `\n---\nTasks: ${selectedSubTasks.map(sid => subTasks.find(s => s.id === sid)?.name || sid).join(', ')}` : ''].filter(Boolean).join('\n'),
          categoryId: selectedCategory.id, budgetType: 'FIXED', budgetAmount: selectedSubTaskTotal.max || 5000,
          providerType: providerType || null, areaId: selectedArea?.id || null, postalCode: null,
          preferredDate: preferredDate || null,
          estimatedDuration: estimatedDuration ? Number(estimatedDuration) : null,
          workersCount: workersCount ? Number(workersCount) : 1,
          urgency,
          photos: photoUrls,
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
            <Text style={styles.label}>Country <Text style={styles.requiredDot}>*</Text></Text>
            <View style={[styles.pillsWrap, showErrors && !selectedCountry && { borderColor: '#EF4444', borderWidth: 1, borderRadius: 12, padding: 4 }]}>
              {countries.map((c) => (
                <TouchableOpacity key={c.id} style={[styles.pill, selectedCountry?.id === c.id && styles.pillActive]}
                  onPress={() => { setSelectedCountry(c); setSelectedState(null); setSelectedCity(null); setSelectedArea(null) }}>
                  <Text style={[styles.pillText, selectedCountry?.id === c.id && styles.pillTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {showErrors && !selectedCountry && <Text style={[styles.fieldHint, { color: '#EF4444' }]}>Please select a country</Text>}
            {selectedCountry && <>
              <Text style={styles.label}>State / Province <Text style={styles.requiredDot}>*</Text></Text>
              <View style={[styles.pillsWrap, showErrors && !selectedState && { borderColor: '#EF4444', borderWidth: 1, borderRadius: 12, padding: 4 }]}>{(selectedCountry.states || []).map((s) => (
                <TouchableOpacity key={s.id} style={[styles.pill, selectedState?.id === s.id && styles.pillActive]}
                  onPress={() => { setSelectedState(s); setSelectedCity(null); setSelectedArea(null) }}>
                  <Text style={[styles.pillText, selectedState?.id === s.id && styles.pillTextActive]}>{s.name}</Text>
                </TouchableOpacity>
              ))}</View>
            </>}
            {selectedState && <>
              <Text style={styles.label}>City <Text style={styles.requiredDot}>*</Text></Text>
              <View style={[styles.pillsWrap, showErrors && !selectedCity && { borderColor: '#EF4444', borderWidth: 1, borderRadius: 12, padding: 4 }]}>{(selectedState.cities || []).map((c) => (
                <TouchableOpacity key={c.id} style={[styles.pill, selectedCity?.id === c.id && styles.pillActive]}
                  onPress={() => { setSelectedCity(c); setSelectedArea(null) }}>
                  <Text style={[styles.pillText, selectedCity?.id === c.id && styles.pillTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}</View>
              {showErrors && !selectedCity && <Text style={[styles.fieldHint, { color: '#EF4444' }]}>Please select a city</Text>}
            </>}
            {selectedCity && (selectedCity.areas || []).length > 0 && <>
              <Text style={styles.label}>Area</Text>
              <View style={styles.pillsWrap}>{(selectedCity.areas || []).map((a) => (
                <TouchableOpacity key={a.id} style={[styles.pill, selectedArea?.id === a.id && styles.pillActive]}
                  onPress={() => setSelectedArea(a)}>
                  <Text style={[styles.pillText, selectedArea?.id === a.id && styles.pillTextActive]}>{a.name}</Text>
                </TouchableOpacity>
              ))}</View>
            </>}
            {selectedCity && <>
              <Text style={styles.label}>Street Address <Text style={{ color: colors.muted, fontSize: 12 }}>(optional)</Text></Text>
              <View style={[styles.inputWrap, { backgroundColor: colors.white, borderColor: colors.border }]}>
                <TextInput style={[styles.input, { color: colors.ink }]} value={address} onChangeText={setAddress}
                  placeholder="e.g. 123 Main Street, Unit 4" placeholderTextColor={colors.muted} />
              </View>
            </>}
            <TouchableOpacity style={[styles.nextBtn, (!selectedCountry || !selectedState || !selectedCity) && styles.btnDisabled]}
              onPress={() => {
                const missing: string[] = []
                if (!selectedCountry) missing.push('Country')
                if (!selectedState) missing.push('State')
                if (!selectedCity) missing.push('City')
                if (missing.length > 0) { setShowErrors(true); Alert.alert('Missing fields', `Please select: ${missing.join(', ')}`); return }
                setShowErrors(false); setStep(1)
              }}>
              <ArrowRight size={18} color="#111827" weight="bold" />
              <Text style={styles.btnText}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 1 && (
          <View style={styles.stepContent}>
            {templateJobId && selectedCategory ? (
              <View style={[styles.catInfoCard, { backgroundColor: colors.amberBg, borderColor: colors.amber }]}>
                {(() => {
                  const InfoIcon = getCatIcon(selectedCategory.name)
                  return typeof InfoIcon === 'function' ? <InfoIcon size={28} color={colors.amberDark} weight="fill" /> : null
                })()}
                <Text style={[styles.catInfoName, { color: colors.amberDark }]}>{selectedCategory.name}</Text>
                <TouchableOpacity onPress={() => setSelectedCategory(null)} style={styles.catInfoChange}>
                  <Text style={{ color: colors.amberDark, fontSize: 12, fontFamily: fonts.bodyMedium }}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
              <View style={[styles.aiSearchWrap, { backgroundColor: colors.white, borderColor: colors.border }]}>
                {typeof Sparkle === 'function' && <Sparkle size={18} color={colors.amber} weight="fill" style={{ marginLeft: 14 }} />}
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
              <Text style={styles.label}>Category {aiQuery.trim() ? `(${filteredCategories.length})` : ''}</Text>
              {filteredCategories.length === 0 ? (
                <View style={[styles.emptyCats, { backgroundColor: colors.white, borderColor: colors.border }]}>
                  <Text style={[styles.emptyCatsText, { color: colors.muted }]}>No categories match "{aiQuery}"</Text>
                </View>
              ) : (
              <View style={styles.catGrid}>
                {filteredCategories.filter(c => c && c.id).map((cat) => {
                  const CatIcon = getCatIcon(cat.name)
                  return (
                  <TouchableOpacity key={cat.id} style={[styles.catCard, { backgroundColor: colors.white, borderColor: colors.border }, selectedCategory?.id === cat.id && styles.catCardActive]}
                    onPress={() => setSelectedCategory(cat)}>
                    {typeof CatIcon === 'function' && <CatIcon size={32} color={selectedCategory?.id === cat.id ? colors.amberDark : colors.muted} weight="fill" style={{ marginBottom: 8 }} />}
                    <Text style={[styles.catName, { color: colors.ink, fontFamily: fonts.heading }, selectedCategory?.id === cat.id && { color: colors.amberDark }]}>{cat.name || ''}</Text>
                  </TouchableOpacity>
                  )
                })}
              </View>
              )}
              </>
            )}
            <Text style={styles.label}>Title <Text style={styles.requiredDot}>*</Text></Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.white, borderColor: showErrors && !title ? '#EF4444' : colors.border }]}>
              <TextInput style={[styles.input, { color: colors.ink }]} value={title} onChangeText={setTitle}
                placeholder="e.g. Fix leaking kitchen pipe" placeholderTextColor={colors.muted} />
            </View>
            {showErrors && !title && <Text style={[styles.fieldHint, { color: '#EF4444' }]}>Title is required</Text>}
            <Text style={styles.label}>Description <Text style={styles.requiredDot}>*</Text></Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.white, borderColor: showErrors && !description ? '#EF4444' : colors.border }]}>
              <TextInput style={[styles.input, styles.textArea, { color: colors.ink }]}
                value={description} onChangeText={(t) => setDescription(t.slice(0, 2000))}
                placeholder="Describe your task..." placeholderTextColor={colors.muted} multiline numberOfLines={4} />
            </View>
            {showErrors && !description && <Text style={[styles.fieldHint, { color: '#EF4444' }]}>Description is required</Text>}
            <Text style={[styles.charHint, { color: colors.muted }]}>{description.length}/2000</Text>
            <TouchableOpacity style={[styles.nextBtn, (!selectedCategory || !title || !description) && styles.btnDisabled]}
              onPress={() => {
                const missing: string[] = []
                if (!selectedCategory) missing.push('Category')
                if (!title.trim()) missing.push('Title')
                if (!description.trim()) missing.push('Description')
                if (missing.length > 0) { setShowErrors(true); Alert.alert('Missing fields', `Please fill: ${missing.join(', ')}`); return }
                setShowErrors(false); setStep(2)
              }}>
              <ArrowRight size={18} color="#111827" weight="bold" />
              <Text style={styles.btnText}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={[styles.sectionTitle, { color: colors.ink, fontSize: 18 }]}>
              {selectedCategory?.name || 'Service'} — What do you need?
            </Text>
            <Text style={[styles.sectionSub, { color: colors.muted, marginBottom: 16 }]}>
              Select all tasks that apply. Each shows real-time pricing.
            </Text>

            {subTasksLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                <ActivityIndicator size="large" color={colors.amber} />
                <Text style={{ color: colors.muted, marginTop: 12, fontFamily: fonts.body }}>Loading tasks...</Text>
              </View>
            ) : subTasks.length > 0 ? (
              <>
                {showErrors && selectedSubTasks.length === 0 && (
                  <View style={[styles.selectedDateBadge, { backgroundColor: '#FEF2F2', borderColor: '#EF4444' }]}>
                    <Text style={{ color: '#DC2626', fontSize: 13, fontFamily: fonts.bodyMedium }}>Please select at least one task above</Text>
                  </View>
                )}
                {subTasks.map((st) => {
                  const isSelected = selectedSubTasks.includes(st.id)
                  const isExpanded = expandedSubTask === st.id
                  const price = getSubTaskPrice(st)
                  const difficultyColor = st.difficulty === 'easy' ? '#10B981' : st.difficulty === 'medium' ? '#F59E0B' : '#EF4444'
                  const difficultyLabel = st.difficulty === 'easy' ? 'Standard' : st.difficulty === 'medium' ? 'Skilled' : 'Expert'

                  return (
                    <TouchableOpacity
                      key={st.id}
                      style={[styles.subTaskCard, { backgroundColor: colors.white, borderColor: isSelected ? colors.amber : colors.border }, isSelected && styles.subTaskCardActive]}
                      onPress={() => toggleSubTask(st.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.subTaskHeader}>
                        <View style={styles.subTaskInfo}>
                          <View style={styles.subTaskTitleRow}>
                            <Text style={[styles.subTaskName, { color: colors.ink }]}>{st.name}</Text>
                            {isSelected && <CheckCircle size={18} color={colors.amber} weight="fill" />}
                          </View>
                          <Text style={[styles.subTaskPrice, { color: colors.amberDark }]}>
                            {currencySymbol} {price.min.toLocaleString()} – {currencySymbol} {price.max.toLocaleString()}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={(e) => { e.stopPropagation(); setExpandedSubTask(isExpanded ? null : st.id) }}
                          style={styles.subTaskExpandBtn}
                        >
                          <Text style={{ color: colors.muted, fontSize: 18 }}>{isExpanded ? '−' : '+'}</Text>
                        </TouchableOpacity>
                      </View>

                      {isExpanded && (
                        <View style={styles.subTaskDetails}>
                          <Text style={[styles.subTaskDesc, { color: colors.muted }]}>{st.description}</Text>
                          <View style={styles.subTaskMeta}>
                            <View style={styles.subTaskMetaItem}>
                              <Clock size={14} color={colors.muted} weight="fill" />
                              <Text style={[styles.subTaskMetaText, { color: colors.muted }]}>{st.estimatedTime}</Text>
                            </View>
                            <View style={[styles.difficultyBadge, { backgroundColor: difficultyColor + '20' }]}>
                              <Text style={[styles.difficultyText, { color: difficultyColor }]}>{difficultyLabel}</Text>
                            </View>
                          </View>
                          {st.tips.length > 0 && (
                            <View style={styles.subTaskTips}>
                              <Text style={[styles.tipsTitle, { color: colors.ink }]}>Things to know:</Text>
                              {st.tips.map((tip, i) => (
                                <Text key={i} style={[styles.tipItem, { color: colors.muted }]}>• {tip}</Text>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  )
                })}

                {selectedSubTasks.length > 0 && (
                  <View style={[styles.totalCard, { backgroundColor: colors.amberBg, borderColor: colors.amber }]}>
                    <Text style={[styles.totalLabel, { color: colors.ink }]}>Estimated Total</Text>
                    <Text style={[styles.totalPrice, { color: colors.amberDark }]}>
                      {currencySymbol} {selectedSubTaskTotal.min.toLocaleString()} – {currencySymbol} {selectedSubTaskTotal.max.toLocaleString()}
                    </Text>
                    <Text style={[styles.totalNote, { color: colors.muted }]}>
                      {selectedSubTasks.length} task{selectedSubTasks.length > 1 ? 's' : ''} selected • Final price set by provider
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={[styles.emptyCats, { backgroundColor: colors.white, borderColor: colors.border }]}>
                <Text style={[styles.emptyCatsText, { color: colors.muted }]}>No specific tasks found. Describe your job in the title.</Text>
              </View>
            )}

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

            {selectedSubTasks.length > 0 && (
              <View style={[styles.tipCard, { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' }]}>
                <Text style={[styles.tipCardText, { color: '#1E40AF' }]}>
                  💡 You can select multiple tasks. Providers will quote based on what you need.
                </Text>
              </View>
            )}

            <TouchableOpacity style={[styles.nextBtn, selectedSubTasks.length === 0 && styles.btnDisabled]}
              onPress={() => {
                if (selectedSubTasks.length === 0) { setShowErrors(true); Alert.alert('Missing tasks', 'Please select at least one task from the list above.'); return }
                setShowErrors(false); setStep(3)
              }}>
              <ArrowRight size={18} color="#111827" weight="bold" />
              <Text style={styles.btnText}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContent}>
            <View style={styles.photoRow}>
              {photos.map((p, i) => (
                <View key={i} style={[styles.photoThumb, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={styles.photoIcon}>📷</Text>
                  <TouchableOpacity style={styles.photoRemove} onPress={() => setPhotos(photos.filter((_, j) => j !== i))}>
                    <Trash size={12} color="#fff" weight="fill" />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 5 && (
                <TouchableOpacity style={[styles.photoAdd, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={async () => {
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8,
                    })
                    if (!result.canceled && result.assets[0]) {
                      setPhotos(prev => [...prev, { uri: result.assets[0].uri }])
                    }
                  }}>
                  <Camera size={22} color={colors.muted} weight="regular" />
                  <Text style={[styles.photoAddText, { color: colors.muted }]}>Add</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.label}>Urgency</Text>
            <View style={styles.urgencyRow}>
              {[
                { key: 'normal', label: 'Normal', emoji: '📅' },
                { key: 'urgent', label: 'Urgent', emoji: '⚡' },
                { key: 'emergency', label: 'Emergency', emoji: '🚨' },
              ].map((u) => (
                <TouchableOpacity key={u.key} style={[styles.urgencyChip, { backgroundColor: colors.white, borderColor: colors.border }, urgency === u.key && styles.urgencyChipActive]}
                  onPress={() => setUrgency(u.key)}>
                  <Text style={{ fontSize: 16 }}>{u.emoji}</Text>
                  <Text style={[styles.urgencyText, { color: urgency === u.key ? colors.amberDark : colors.muted }]}>
                    {u.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>When do you need this done?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { key: 'today', label: 'Today', date: new Date() },
                  { key: 'tomorrow', label: 'Tomorrow', date: new Date(Date.now() + 86400000) },
                  { key: 'weekend', label: 'This Weekend', date: (() => { const d = new Date(); d.setDate(d.getDate() + (6 - d.getDay() + 7) % 7 || 7); return d })() },
                  { key: 'nextweek', label: 'Next Week', date: (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d })() },
                ].map((opt) => {
                  const dateStr = opt.date.toISOString().split('T')[0]
                  const isActive = preferredDate === dateStr
                  return (
                    <TouchableOpacity key={opt.key}
                      style={[styles.dateChip, { backgroundColor: colors.white, borderColor: colors.border }, isActive && styles.dateChipActive]}
                      onPress={() => setPreferredDate(isActive ? '' : dateStr)}>
                      <Text style={[styles.dateChipLabel, { color: isActive ? colors.amberDark : colors.ink }]}>{opt.label}</Text>
                      <Text style={[styles.dateChipDate, { color: isActive ? colors.amberDark : colors.muted }]}>
                        {opt.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
                <TouchableOpacity
                  style={[styles.dateChip, { backgroundColor: colors.white, borderColor: colors.border }, preferredDate && !['today','tomorrow','weekend','nextweek'].includes(preferredDate) && styles.dateChipActive]}
                  onPress={() => setShowDatePicker(!showDatePicker)}>
                  <Text style={[styles.dateChipLabel, { color: colors.ink }]}>📅 Pick a Date</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            {showDatePicker && (
              <View style={[styles.datePickerModal, { backgroundColor: colors.white, borderColor: colors.border }]}>
                <Text style={[styles.datePickerTitle, { color: colors.ink }]}>Select a date</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {['01','02','03','04','05','06','07'].map(day => {
                    const d = new Date()
                    d.setDate(d.getDate() + parseInt(day))
                    const dateStr = d.toISOString().split('T')[0]
                    const isActive = preferredDate === dateStr
                    return (
                      <TouchableOpacity key={day}
                        style={[styles.dateModalDay, { backgroundColor: isActive ? colors.amber : colors.surface, borderColor: isActive ? colors.amber : colors.border }]}
                        onPress={() => { setPreferredDate(dateStr); setShowDatePicker(false) }}>
                        <Text style={[styles.dateModalDayName, { color: isActive ? '#111827' : colors.muted }]}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</Text>
                        <Text style={[styles.dateModalDayNum, { color: isActive ? '#111827' : colors.ink }]}>{d.getDate()}</Text>
                        <Text style={[styles.dateModalDayMonth, { color: isActive ? '#111827' : colors.muted }]}>{d.toLocaleDateString('en-US', { month: 'short' })}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.datePickerClose}>
                  <Text style={{ color: colors.amberDark, fontFamily: fonts.bodySemiBold }}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
            {preferredDate && (
              <View style={[styles.selectedDateBadge, { backgroundColor: colors.amberBg, borderColor: colors.amber }]}>
                <Text style={[styles.selectedDateText, { color: colors.amberDark }]}>
                  📅 {new Date(preferredDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  <Text onPress={() => setPreferredDate('')} style={{ color: colors.muted }}>  ✕</Text>
                </Text>
              </View>
            )}

            <Text style={styles.label}>Preferred Time</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['Morning (8–12)', 'Afternoon (12–5)', 'Evening (5–9)', 'Any Time'].map((slot) => {
                  const isActive = preferredTimeSlot === slot
                  return (
                    <TouchableOpacity key={slot}
                      style={[styles.timeChip, { backgroundColor: colors.white, borderColor: colors.border }, isActive && styles.timeChipActive]}
                      onPress={() => setPreferredTimeSlot(isActive ? '' : slot)}>
                      <Text style={[styles.timeChipText, { color: isActive ? colors.amberDark : colors.muted }]}>{slot}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </ScrollView>

            <Text style={styles.label}>Estimated Duration</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { value: '0.5', label: '30 min', icon: '⚡' },
                  { value: '1', label: '1 hour', icon: '🕐' },
                  { value: '1.5', label: '1.5 hrs', icon: '🕐' },
                  { value: '2', label: '2 hours', icon: '🕑' },
                  { value: '3', label: '3 hours', icon: '🕒' },
                  { value: '4', label: '4 hours', icon: '🕓' },
                  { value: '6', label: '6 hours', icon: '🕕' },
                  { value: '8', label: 'Full Day', icon: '☀️' },
                ].map((opt) => {
                  const isActive = estimatedDuration === opt.value
                  return (
                    <TouchableOpacity key={opt.value}
                      style={[styles.durationChip, { backgroundColor: colors.white, borderColor: colors.border }, isActive && styles.durationChipActive]}
                      onPress={() => setEstimatedDuration(isActive ? '' : opt.value)}>
                      <Text style={{ fontSize: 18 }}>{opt.icon}</Text>
                      <Text style={[styles.durationChipText, { color: isActive ? colors.amberDark : colors.muted }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  )
                })}
                <TouchableOpacity
                  style={[styles.durationChip, { backgroundColor: colors.white, borderColor: colors.border }]}
                  onPress={() => {
                    Alert.prompt?.('Custom Duration', 'Enter hours:', (val) => { if (val) setEstimatedDuration(val) }, 'plain-text', '', 'decimal-pad')
                  }}>
                  <Text style={{ fontSize: 18 }}>✏️</Text>
                  <Text style={[styles.durationChipText, { color: colors.muted }]}>Custom</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            {estimatedDuration && (
              <View style={[styles.selectedDateBadge, { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' }]}>
                <Text style={{ color: '#1E40AF', fontSize: 13, fontFamily: fonts.bodyMedium }}>
                  ⏱️ {estimatedDuration} hour{estimatedDuration !== '1' ? 's' : ''} estimated
                </Text>
              </View>
            )}

            <Text style={styles.label}>Number of Workers</Text>
            <View style={styles.workersRow}>
              {[
                { count: '1', label: '1 Person', desc: 'Standard task', icon: '👤' },
                { count: '2', label: '2 People', desc: 'Faster completion', icon: '👥' },
                { count: '3', label: '3 People', desc: 'Heavy workload', icon: '👨‍👩‍👦' },
                { count: '4', label: '4+ People', desc: 'Large project', icon: '🏗️' },
              ].map((opt) => {
                const isActive = workersCount === opt.count
                return (
                  <TouchableOpacity key={opt.count}
                    style={[styles.workerCard, { backgroundColor: colors.white, borderColor: colors.border }, isActive && styles.workerCardActive]}
                    onPress={() => setWorkersCount(opt.count)}>
                    <Text style={{ fontSize: 24 }}>{opt.icon}</Text>
                    <Text style={[styles.workerLabel, { color: isActive ? colors.amberDark : colors.ink }]}>{opt.label}</Text>
                    <Text style={[styles.workerDesc, { color: colors.muted }]}>{opt.desc}</Text>
                    {isActive && <View style={[styles.workerCheck, { backgroundColor: colors.amber }]}><CheckCircle size={14} color="#111827" weight="fill" /></View>}
                  </TouchableOpacity>
                )
              })}
            </View>

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
              <Text style={styles.btnText}>See Pricing</Text>
            </TouchableOpacity>
            <Text style={[styles.fieldHint, { color: colors.muted, textAlign: 'center', marginTop: 8 }]}>
              Photos, time, and workers are optional but help providers give accurate quotes
            </Text>
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContent}>
            <Text style={styles.pricingSectionTitle}>Estimated Price Range</Text>
            {pricingLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <ActivityIndicator size="large" color={colors.amber} />
                <Text style={[styles.pricingLoadingText, { color: colors.muted }]}>Analyzing market data...</Text>
              </View>
            ) : priceEstimate ? (
              <>
                <View style={[styles.pricingCard, { backgroundColor: colors.amberBg, borderColor: colors.amber }]}>
                  <Text style={styles.pricingRange}>
                    {priceEstimate.symbol} {priceEstimate.priceRange.min.toLocaleString()} – {priceEstimate.symbol} {priceEstimate.priceRange.max.toLocaleString()}
                  </Text>
                  <Text style={[styles.pricingConfidence, { color: colors.muted }]}>
                    {priceEstimate.confidence === 'high' ? 'High confidence estimate' :
                     priceEstimate.confidence === 'medium' ? 'Medium confidence estimate' :
                     'Estimated range (limited data)'}
                  </Text>
                </View>

                <Text style={styles.pricingSectionTitle}>Breakdown</Text>
                <View style={[styles.breakdownCard, { backgroundColor: colors.white, borderColor: colors.border }]}>
                  {priceEstimate.breakdown.map((item: any, i: number) => (
                    <View key={i} style={[styles.breakdownRow, i < priceEstimate.breakdown.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                      <Text style={[styles.breakdownLabel, { color: colors.ink }]}>{item.label}</Text>
                      <Text style={[styles.breakdownValue, { color: colors.amberDark }]}>
                        {item.amountRange
                          ? `${priceEstimate.symbol} ${item.amountRange.min.toLocaleString()} – ${priceEstimate.symbol} ${item.amountRange.max.toLocaleString()}`
                          : `${priceEstimate.symbol} ${item.amount.toLocaleString()}`}
                      </Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.pricingSectionTitle}>Market Insight</Text>
                <View style={[styles.insightCard, {
                  backgroundColor: priceEstimate.marketInsight.comparison === 'below_average' ? '#ECFDF5' :
                    priceEstimate.marketInsight.comparison === 'average' ? '#FEF3C7' :
                    priceEstimate.marketInsight.comparison === 'slightly_above' ? '#FED7AA' : '#FEE2E2',
                  borderColor: priceEstimate.marketInsight.comparison === 'below_average' ? '#6EE7B7' :
                    priceEstimate.marketInsight.comparison === 'average' ? '#FCD34D' :
                    priceEstimate.marketInsight.comparison === 'slightly_above' ? '#FB923C' : '#FCA5A5',
                }]}>
                  <Text style={[styles.insightText, { color: colors.ink }]}>{priceEstimate.marketInsight.label}</Text>
                  <Text style={[styles.timeEstimateText, { color: colors.muted }]}>
                    Estimated time: {priceEstimate.timeEstimate}
                  </Text>
                </View>

                {priceEstimate.warning && (
                  <View style={[styles.warningCard, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
                    <Text style={[styles.warningText, { color: '#92400E' }]}>{priceEstimate.warning}</Text>
                  </View>
                )}

                {priceEstimate.suggestion && (
                  <View style={[styles.suggestionCard, { backgroundColor: '#E0F2FE', borderColor: '#7DD3FC' }]}>
                    <Text style={[styles.suggestionText, { color: '#0C4A6E' }]}>{priceEstimate.suggestion}</Text>
                  </View>
                )}

                <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(5)}>
                  <ArrowRight size={18} color="#111827" weight="bold" />
                  <Text style={styles.btnText}>Continue to Review</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        )}

        {step === 5 && (
          <View style={styles.stepContent}>
            <View style={[styles.reviewCard, { backgroundColor: colors.white, borderColor: colors.border }]}>
              {[
                { icon: MapPin, label: 'Location', value: [selectedArea?.name, selectedCity?.name, selectedState?.name].filter(Boolean).join(', ') + (address ? `\n${address}` : '') },
                { icon: Clipboard, label: 'Category', value: selectedCategory?.name },
                { icon: Clipboard, label: 'Title', value: title },
                ...(selectedSubTasks.length > 0 ? [{
                  icon: Wallet, label: 'Tasks & Budget',
                  value: selectedSubTasks.map(sid => {
                    const st = subTasks.find(s => s.id === sid)
                    if (!st) return ''
                    const p = getSubTaskPrice(st)
                    return `${st.name}: ${currencySymbol} ${p.min.toLocaleString()} – ${currencySymbol} ${p.max.toLocaleString()}`
                  }).join('\n') + `\n\nEstimated Total: ${currencySymbol} ${selectedSubTaskTotal.min.toLocaleString()} – ${currencySymbol} ${selectedSubTaskTotal.max.toLocaleString()}`
                }] : [{
                  icon: Wallet, label: 'Budget', value: `Est. Rs ${selectedSubTaskTotal.min.toLocaleString()} – Rs ${selectedSubTaskTotal.max.toLocaleString()}`
                }]),
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

  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  photoThumb: { width: 80, height: 80, borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  photoIcon: { fontSize: 26 },
  photoRemove: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },
  photoAdd: { width: 80, height: 80, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 4 },
  photoAddText: { fontSize: 10, fontFamily: fonts.bodyMedium },
  urgencyRow: { flexDirection: 'row', gap: 8 },
  urgencyChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5 },
  urgencyChipActive: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  urgencyText: { fontSize: 13, fontFamily: fonts.bodyMedium },

  dateChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', minWidth: 100 },
  dateChipActive: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  dateChipLabel: { fontSize: 13, fontFamily: fonts.bodySemiBold, marginBottom: 2 },
  dateChipDate: { fontSize: 11, fontFamily: fonts.body },
  selectedDateBadge: { borderRadius: 12, padding: 12, borderWidth: 1, marginTop: 8, marginBottom: 4 },
  selectedDateText: { fontSize: 13, fontFamily: fonts.bodyMedium },

  timeChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, alignItems: 'center' },
  timeChipActive: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  timeChipText: { fontSize: 12, fontFamily: fonts.bodyMedium },

  durationChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, minWidth: 90 },
  durationChipActive: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  durationChipText: { fontSize: 13, fontFamily: fonts.bodyMedium },

  workersRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  workerCard: { flex: 1, alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1.5, position: 'relative' },
  workerCardActive: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  workerLabel: { fontSize: 13, fontFamily: fonts.bodySemiBold, marginTop: 6, marginBottom: 2 },
  workerDesc: { fontSize: 10, fontFamily: fonts.body, textAlign: 'center' },
  workerCheck: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },

  datePickerModal: { borderRadius: 20, padding: 20, borderWidth: 1.5, marginTop: 8, marginBottom: 8 },
  datePickerTitle: { fontSize: 16, fontFamily: fonts.heading, marginBottom: 16 },
  dateModalDay: { alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1.5, minWidth: 42 },
  dateModalDayName: { fontSize: 10, fontFamily: fonts.bodyMedium },
  dateModalDayNum: { fontSize: 18, fontFamily: fonts.heading, marginVertical: 2 },
  dateModalDayMonth: { fontSize: 10, fontFamily: fonts.body },
  datePickerClose: { alignItems: 'center', paddingVertical: 10 },

  pricingSectionTitle: { fontSize: 16, fontFamily: fonts.heading, marginBottom: 10, marginTop: 16, color: colors.ink },
  pricingCard: { borderRadius: 24, padding: 28, alignItems: 'center', borderWidth: 1.5, marginBottom: 8 },
  pricingRange: { fontSize: 32, fontFamily: fonts.heading, color: colors.amberDark, marginBottom: 6 },
  pricingConfidence: { fontSize: 12, fontFamily: fonts.body },
  pricingLoadingText: { fontSize: 14, fontFamily: fonts.body, marginTop: 16 },
  breakdownCard: { borderRadius: 18, borderWidth: 1.5, overflow: 'hidden', marginBottom: 8 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  breakdownLabel: { fontSize: 14, fontFamily: fonts.body, flex: 1 },
  breakdownValue: { fontSize: 15, fontFamily: fonts.bodySemiBold },
  insightCard: { borderRadius: 16, padding: 16, borderWidth: 1.5, marginBottom: 8 },
  insightText: { fontSize: 14, fontFamily: fonts.bodyMedium, marginBottom: 6 },
  timeEstimateText: { fontSize: 13, fontFamily: fonts.body },
  warningCard: { borderRadius: 14, padding: 14, borderWidth: 1.5, marginBottom: 8 },
  warningText: { fontSize: 13, fontFamily: fonts.bodyMedium },
  suggestionCard: { borderRadius: 14, padding: 14, borderWidth: 1.5, marginBottom: 8 },
  suggestionText: { fontSize: 13, fontFamily: fonts.bodyMedium },

  questionCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1.5, marginBottom: 10 },
  questionInputWrap: { flex: 1 },
  questionLabel: { fontSize: 13, fontFamily: fonts.bodyMedium, marginBottom: 2 },
  questionInput: { fontSize: 14, fontFamily: fonts.body, padding: 0 },

  catInfoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 18, borderWidth: 1.5, marginBottom: 16 },
  catInfoName: { fontSize: 16, fontFamily: fonts.bodySemiBold, flex: 1 },
  catInfoChange: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.06)' },

  subTaskCard: { borderRadius: 18, borderWidth: 1.5, padding: 16, marginBottom: 10 },
  subTaskCardActive: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  subTaskHeader: { flexDirection: 'row', alignItems: 'center' },
  subTaskInfo: { flex: 1 },
  subTaskTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  subTaskName: { fontSize: 15, fontFamily: fonts.bodySemiBold, flex: 1, marginRight: 8 },
  subTaskPrice: { fontSize: 14, fontFamily: fonts.heading, marginBottom: 2 },
  subTaskExpandBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  subTaskDetails: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  subTaskDesc: { fontSize: 13, fontFamily: fonts.body, lineHeight: 18, marginBottom: 10 },
  subTaskMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  subTaskMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  subTaskMetaText: { fontSize: 12, fontFamily: fonts.bodyMedium },
  difficultyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  difficultyText: { fontSize: 11, fontFamily: fonts.bodySemiBold },
  subTaskTips: { marginTop: 4 },
  tipsTitle: { fontSize: 12, fontFamily: fonts.bodySemiBold, marginBottom: 4 },
  tipItem: { fontSize: 12, fontFamily: fonts.body, lineHeight: 18, marginBottom: 2 },
  totalCard: { borderRadius: 18, padding: 20, borderWidth: 1.5, alignItems: 'center', marginTop: 8, marginBottom: 12 },
  totalLabel: { fontSize: 13, fontFamily: fonts.bodyMedium, marginBottom: 4 },
  totalPrice: { fontSize: 24, fontFamily: fonts.heading, marginBottom: 4 },
  totalNote: { fontSize: 12, fontFamily: fonts.body },
  tipCard: { borderRadius: 14, padding: 14, borderWidth: 1, marginTop: 8, marginBottom: 4 },
  tipCardText: { fontSize: 13, fontFamily: fonts.bodyMedium, lineHeight: 18 },
  fieldHint: { fontSize: 11, fontFamily: fonts.body, marginTop: 2 },
  requiredDot: { color: '#EF4444', fontSize: 14, fontFamily: fonts.bodyMedium },

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
