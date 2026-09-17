import React, { Component, useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, Animated, useWindowDimensions, Image,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Reanimated, { FadeInDown, FadeInRight } from 'react-native-reanimated'
import { categoryVisualBySlug } from '../../../../lib/categoryVisuals'
import * as ImagePicker from 'expo-image-picker'

class ErrorBoundary extends Component<{ children: any }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: any) {
    const stack = info?.componentStack || ''
    const lines = stack.split('\n').filter((l: string) => l.trim()).slice(0, 5)
    Alert.alert('Error', (error?.message || String(error)) + '\n\nIn:\n' + lines.join('\n'))
  }
  render() {
    if (this.state.error) return null
    return this.props.children
  }
}
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'
import { MapPin, Clipboard, Wallet, CheckCircle, ArrowRight, CaretLeft, X, Sparkle, NavigationArrow, CalendarBlank, ClockAfternoon, Lightning, Drop, Snowflake, PaintBrush, Hammer, SquaresFour, Wall, House, Bug, Leaf, Lock, Truck, Car, Desktop, Gift, HandHeart, HouseSimple, Sun, SealCheck, Money, Wrench, FrameCorners, Television, TShirt, Camera, NotePencil, UserCircle } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { v2SmartBooking, v2CustomJobs, type SmartTemplate, type SmartQuestion } from '../../../../lib/api-v2'
import { useColors } from '../../../../lib/ThemeContext'
import { fonts } from '../../../../lib/fonts'
import { getAuthToken, resolveImageUri } from '../../../../lib/api'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'

interface Category { id: string; name: string; slug?: string | null; iconName?: string }
interface Area { id: string; name: string }
interface City { id: string; name: string; areas: Area[] }
interface State { id: string; name: string; cities: City[] }
interface Country { id: string; name: string; code: string; states: State[] }

const FALLBACK_CATEGORIES: Category[] = [
  { id: 'cmq11mmga0000au6t7lriksk3', slug: 'electrical-works', name: 'Electrical Works' },
  { id: 'cmq11mmhz0001au6tx65rlca0', slug: 'plumbing', name: 'Plumbing' },
  { id: 'cmq11mmj00002au6tqnnedkzs', slug: 'ac-and-refrigeration', name: 'AC and Refrigeration' },
  { id: 'cmq11mmjt0003au6tgd86dua9', slug: 'painting-and-decorating', name: 'Painting and Decorating' },
  { id: 'cmq11mmkk0004au6tfpvqt403', slug: 'carpentry-and-furniture', name: 'Carpentry and Furniture' },
  { id: 'cmq11mmkz0005au6tyc75eg8x', slug: 'tiling-and-flooring', name: 'Tiling and Flooring' },
  { id: 'cmq11mmlb0006au6tjgu3fc77', slug: 'masonry-and-concrete', name: 'Masonry and Concrete' },
  { id: 'cmq11mmls0007au6tejrellmd', slug: 'roofing-and-gutters', name: 'Roofing and Gutters' },
  { id: 'cmq11mmm40008au6tb1chtxse', slug: 'pest-control', name: 'Pest Control' },
  { id: 'cmq11mmme0009au6tz4ilxt3n', slug: 'cleaning-services', name: 'Cleaning Services' },
  { id: 'cmq11mmms000aau6tw8l1635y', slug: 'gardening-and-landscaping', name: 'Gardening and Landscaping' },
  { id: 'cmq11mmn4000bau6tx4pjvqzu', slug: 'home-security-and-automation', name: 'Home Security and Automation' },
  { id: 'cmq11mmng000cau6to6u5pfcw', slug: 'moving-and-packing', name: 'Moving and Packing' },
  { id: 'cmq11mmnq000dau6t6rhtyb9w', slug: 'vehicle-care-and-maintenance', name: 'Vehicle Care and Maintenance' },
  { id: 'cmq11mmo1000eau6t8rv561up', slug: 'it-and-electronics-repair', name: 'IT and Electronics Repair' },
  { id: 'cmq11mmog000fau6ty5r27yw8', slug: 'event-and-party-services', name: 'Event and Party Services' },
  { id: 'cmq11mmor000gau6t44fkq9r8', slug: 'personal-care-and-wellness', name: 'Personal Care and Wellness' },
  { id: 'cmq11mmp2000hau6txbqrhsn5', slug: 'home-renovation-and-interiors', name: 'Home Renovation and Interiors' },
  { id: 'cmq11mmph000iau6tuxaq64qg', slug: 'solar-and-energy-solutions', name: 'Solar and Energy Solutions' },
  { id: 'cmtilkh0z00a79z5q737mmpfm', slug: 'handyman-and-general-repairs', name: 'Handyman and General Repairs' },
  { id: 'cmtilkh3b00bi9z5qt16axea0', slug: 'glass-and-aluminium', name: 'Glass and Aluminium' },
  { id: 'cmtilkh4i00c59z5qbnfgkpkr', slug: 'appliance-installation-and-repair', name: 'Appliance Installation and Repair' },
  { id: 'cmtilkh5v00cu9z5qu0pbw6o9', slug: 'locksmith-services', name: 'Locksmith Services' },
  { id: 'cmtilkh6t00dd9z5qzge5lmnv', slug: 'curtains-blinds-and-upholstery', name: 'Curtains, Blinds and Upholstery' },
]

const CAT_ICONS: Record<string, React.ComponentType<any>> = {
  'electrical-works': Lightning,
  plumbing: Drop,
  'ac-and-refrigeration': Snowflake,
  'painting-and-decorating': PaintBrush,
  'carpentry-and-furniture': Hammer,
  'tiling-and-flooring': SquaresFour,
  'masonry-and-concrete': Wall,
  'roofing-and-gutters': House,
  'pest-control': Bug,
  'cleaning-services': Sparkle,
  'gardening-and-landscaping': Leaf,
  'home-security-and-automation': Lock,
  'moving-and-packing': Truck,
  'vehicle-care-and-maintenance': Car,
  'it-and-electronics-repair': Desktop,
  'event-and-party-services': Gift,
  'personal-care-and-wellness': HandHeart,
  'home-renovation-and-interiors': HouseSimple,
  'solar-and-energy-solutions': Sun,
  'handyman-and-general-repairs': Wrench,
  'glass-and-aluminium': FrameCorners,
  'appliance-installation-and-repair': Television,
  'locksmith-services': Lock,
  'curtains-blinds-and-upholstery': TShirt,
}

function categoryIcon(name?: string): React.ComponentType<any> {
  if (!name) return WrenchFallback
  const key = name.toLowerCase()
  for (const [slug, icon] of Object.entries(CAT_ICONS)) {
    if (key === slug || key.includes(slug.replace(/-/g, ' '))) return icon
  }
  return WrenchFallback
}
function WrenchFallback(props: any) { return <SquaresFour {...props} /> }

function flattenAnswers(template: SmartTemplate | null, answers: Record<string, any>): string[] {
  if (!template) return []
  const lines: string[] = []
  for (const q of template.questions || []) {
    const val = answers[q.key]
    if (val == null) continue
    const picks = Array.isArray(val) ? val : [val]
    if (picks.length === 0) continue
    const labels = picks.map((v: string) => {
      const opt = (q.options || []).find((o) => o.value === v)
      return opt ? opt.label : String(v)
    })
    lines.push(`${q.label}: ${labels.join(', ')}`)
  }
  return lines
}

function buildTitle(template: SmartTemplate | null, answers: Record<string, any>): string {
  if (!template) return ''
  const primary = (template.questions || []).find((q) => q.required)
  const label = primary ? ((primary.options || []).find((o) => o.value === answers[primary.key])?.label) : ''
  return label ? `${template.jobCategory?.name || template.name}: ${label}` : template.jobCategory?.name || template.name
}

function buildDescription(template: SmartTemplate | null, answers: Record<string, any>, address: string, urgency: string): string {
  const lines = flattenAnswers(template, answers)
  let desc = template?.description || ''
  if (lines.length > 0) desc += `\n\n${lines.join('\n')}`
  if (urgency && urgency !== 'normal') desc += `\n\nUrgency: ${urgency}`
  if (address) desc += `\n\nAddress: ${address}`
  return desc
}

function useSlideIn(delay = 0) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 6, tension: 80, delay, useNativeDriver: true }).start()
  }, [])
  return anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] })
}

function useCountUp(target: number, duration = 800) {
  const val = useRef(new Animated.Value(0)).current
  useEffect(() => {
    val.setValue(0)
    Animated.timing(val, { toValue: target, duration, useNativeDriver: false }).start()
  }, [target])
  return val
}

function CountUpRange({ min, max, symbol, style }: { min: number; max: number; symbol: string; style?: any }) {
  const minAnim = useCountUp(min)
  const maxAnim = useCountUp(max)
  const [dispMin, setDispMin] = useState('0')
  const [dispMax, setDispMax] = useState('0')
  useEffect(() => {
    const id1 = minAnim.addListener(({ value }) => setDispMin(String(Math.round(value).toLocaleString())))
    const id2 = maxAnim.addListener(({ value }) => setDispMax(String(Math.round(value).toLocaleString())))
    return () => { minAnim.removeListener(id1); maxAnim.removeListener(id2) }
  }, [minAnim, maxAnim])
  return (
    <Text style={style}>
      {symbol}{dispMin} – {symbol}{dispMax}
    </Text>
  )
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
  const { urgency: prefilledUrgency, categoryId, templateJobId, taskerId, taskerName } = useLocalSearchParams<{
    urgency?: string; categoryId?: string; templateJobId?: string; title?: string; taskerId?: string; taskerName?: string
  }>()

  const [step, setStep] = useState(0)
  const enteredPreselected = !!(categoryId && templateJobId)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [postSuccess, setPostSuccess] = useState(false)
  const [createdJobId, setCreatedJobId] = useState<string | null>(null)
  const [createdConversationId, setCreatedConversationId] = useState<string | null>(null)

  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [templates, setTemplates] = useState<SmartTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<SmartTemplate | null>(null)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [templatesLoading, setTemplatesLoading] = useState(false)

  const [countries, setCountries] = useState<Country[]>([])
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null)
  const [selectedState, setSelectedState] = useState<State | null>(null)
  const [selectedCity, setSelectedCity] = useState<City | null>(null)
  const [selectedArea, setSelectedArea] = useState<Area | null>(null)
  const [address, setAddress] = useState('')
  const [mapReady, setMapReady] = useState(false)
  const [region, setRegion] = useState<any>({
    latitude: 6.9271,
    longitude: 79.8612,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  })
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [pinLocating, setPinLocating] = useState(false)
  const mapRef = useRef<MapView | null>(null)

  const [urgency, setUrgency] = useState('normal')
  const [preferredDate, setPreferredDate] = useState('')
  const [preferredTimeSlot, setPreferredTimeSlot] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)

  const [estimate, setEstimate] = useState<any>(null)
  const [estimateLoading, setEstimateLoading] = useState(false)
  const [budgetAmount, setBudgetAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'DIGITAL' | 'CASH'>('DIGITAL')
  const [qIndex, setQIndex] = useState(0)

  const [photos, setPhotos] = useState<string[]>([])
  const [photoUploading, setPhotoUploading] = useState(false)
  const [notes, setNotes] = useState('')

  const [showCustomJob, setShowCustomJob] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [customDesc, setCustomDesc] = useState('')
  const [customBudget, setCustomBudget] = useState('')
  const [customSubmitting, setCustomSubmitting] = useState(false)
  const [customThanks, setCustomThanks] = useState(false)

  const slideAnim = useSlideIn()

  const { width: winWidth } = useWindowDimensions()
  const catTileW = Math.floor((winWidth - 40 - 10) / 4.4)

  const stepMeta = [
    { icon: Clipboard, title: 'What do you need?', sub: 'Pick a category' },
    { icon: Sparkle, title: 'Pick your sub-category', sub: 'Choose the exact service you need' },
    { icon: MapPin, title: 'Where should we go?', sub: 'Set your location' },
    { icon: ClockAfternoon, title: 'When do you need it?', sub: 'Pick a date and time' },
    { icon: Camera, title: 'Photos & Notes', sub: 'Help taskers understand the job' },
    { icon: CheckCircle, title: 'Review & Post', sub: 'Confirm and post your job' },
  ]

  const TIME_SLOT_KEYS: Record<string, string> = {
    'Morning (8–12)': 'morning',
    'Afternoon (12–5)': 'afternoon',
    'Evening (5–9)': 'evening',
    'Any Time': 'anytime',
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
        if (categoryId) {
          const pre = (list.length > 0 ? list : FALLBACK_CATEGORIES).find((c: any) => (c.id === categoryId) || (c.slug === categoryId))
          if (pre) { setSelectedCategory(pre); if (templateJobId) { setTemplatesLoading(true); setStep(1) } }
        }
      } else {
        setCategories(FALLBACK_CATEGORIES)
        if (categoryId) {
          const pre = FALLBACK_CATEGORIES.find((c: any) => (c.id === categoryId) || (c.slug === categoryId))
          if (pre) { setSelectedCategory(pre); if (templateJobId) { setTemplatesLoading(true); setStep(1) } }
        }
      }
      if (locRes.ok) { const d = await locRes.json(); setCountries(d.countries || []) }
      if (prefilledUrgency) setUrgency(prefilledUrgency)
    } catch {
      setCategories(FALLBACK_CATEGORIES)
    } finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (!selectedCategory) { setTemplates([]); setSelectedTemplate(null); setAnswers({}); return }
    let cancelled = false
    setTemplatesLoading(true)
    v2SmartBooking.templates(selectedCategory.id)
      .then((list) => {
        if (cancelled) return
        setTemplates(list)
        const match = templateJobId ? list.find((tp: any) => tp.id === templateJobId || tp.slug === templateJobId || tp.refJob?.id === templateJobId) : null
        const preselected = match || (templateJobId ? list[0] || null : null)
        setSelectedTemplate(preselected)
        setAnswers({})
        setQIndex(0)
        setEstimate(null)
        if (templateJobId && preselected) setStep(1)
      })
      .catch(() => { if (!cancelled) { setTemplates([]); setSelectedTemplate(null) } })
      .finally(() => { if (!cancelled) setTemplatesLoading(false) })
    return () => { cancelled = true }
  }, [selectedCategory?.id, templateJobId])

  const submitCustomJob = async () => {
    if (!customTitle.trim()) {
      Alert.alert('Missing fields', 'Please describe the job you need.')
      return
    }
    setCustomSubmitting(true)
    try {
      const budget = Number(customBudget) || 0
      await v2CustomJobs.submit({
        title: customTitle.trim(),
        description: customDesc.trim(),
        categoryId: selectedCategory?.id || null,
        cityName: selectedCity?.name || null,
        budgetMin: budget > 0 ? budget : null,
        budgetMax: budget > 0 ? budget : null,
      })
      setCustomThanks(true)
    } catch (e: any) {
      let msg = 'Could not submit your request. Please try again.'
      try { msg = JSON.parse(e.message).error || msg } catch {}
      Alert.alert('Something went wrong', msg)
    } finally {
      setCustomSubmitting(false)
    }
  }

  const autoTitle = selectedTemplate ? buildTitle(selectedTemplate, answers) : ''
  const autoDescription = selectedTemplate ? buildDescription(selectedTemplate, answers, address, urgency) : ''

  const scheduledForValue: 'today' | 'tomorrow' | 'this_week' | 'flexible' =
    urgency === 'emergency' ? 'today' : urgency === 'urgent' ? 'tomorrow' : 'this_week'

  useEffect(() => {
    if (step === 5 && selectedTemplate && !estimate && !estimateLoading) {
      fetchEstimate()
    }
  }, [step, selectedTemplate?.id, answers])

  const fetchEstimate = async () => {
    if (!selectedTemplate) return
    setEstimateLoading(true)
    try {
      const res = await v2SmartBooking.priceEstimate({
        templateId: selectedTemplate.id,
        answers,
        countryCode: selectedCountry?.code === 'CAN' ? 'CA' : 'LK',
        urgency,
        city: selectedCity?.name || (selectedState?.name === 'Western Province' ? 'Colombo' : undefined),
        scheduledFor: scheduledForValue,
      })
      setEstimate(res)
      if (!budgetAmount && res.priceRange?.max > 0) {
        setBudgetAmount(String(Math.round(res.priceRange.max)))
      }
    } catch {
      setEstimate(null)
    } finally {
      setEstimateLoading(false)
    }
  }

  const pickPhotos = async () => {
    const token = await getAuthToken()
    if (!token) { Alert.alert(t('common.error'), 'Please sign in to upload photos.'); return }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('common.error'), 'Photo library permission is required to attach photos.')
      return
    }
    const remaining = 5 - photos.length
    if (remaining <= 0) { Alert.alert(t('common.error'), 'You can attach up to 5 photos.'); return }
    const res = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    })
    if (res.canceled) return
    setPhotoUploading(true)
    try {
      const uploaded: string[] = []
      for (const asset of res.assets) {
        const form = new FormData()
        form.append('file', {
          uri: asset.uri,
          name: asset.fileName || `photo-${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        } as any)
        form.append('kind', 'mobile')
        const fileRes = await fetch(`${API_URL}/api/mobile/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        })
        const data = await fileRes.json()
        if (fileRes.ok && data.url) uploaded.push(data.url)
      }
      if (uploaded.length > 0) setPhotos((prev) => [...prev, ...uploaded].slice(0, 5))
      else Alert.alert(t('common.error'), 'Could not upload photos. Please try again.')
    } catch {
      Alert.alert(t('common.error'), t('postJob.networkError'))
    } finally {
      setPhotoUploading(false)
    }
  }

  const selectAnswer = (q: SmartQuestion, value: string) => {
    setEstimate(null)
    if (q.type === 'multi') {
      const current: string[] = Array.isArray(answers[q.key]) ? answers[q.key] : []
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
      setAnswers((prev) => ({ ...prev, [q.key]: next }))
    } else {
      setAnswers((prev) => ({ ...prev, [q.key]: value }))
    }
  }

  const answersReady = () => {
    if (!selectedTemplate) return false
    for (const q of selectedTemplate.questions || []) {
      if (q.required) {
        const v = answers[q.key]
        if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) return false
      }
    }
    return true
  }

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
      const g = geo && geo[0]
      if (g) {
        const parts = [g.name, g.street, g.district, g.city, g.region, g.country].filter(Boolean)
        const label = parts.join(', ')
        setAddress(label || `(${lat.toFixed(4)}, ${lng.toFixed(4)})`)
      } else {
        setAddress(`(${lat.toFixed(4)}, ${lng.toFixed(4)})`)
      }
    } catch {
      setAddress(`(${lat.toFixed(4)}, ${lng.toFixed(4)})`)
    }
  }

  const onRegionChangeComplete = (r: any) => {
    setRegion(r)
    const lat = r.latitude
    const lng = r.longitude
    setCoords({ latitude: lat, longitude: lng })
    reverseGeocode(lat, lng)
  }

  const useMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('common.error'), 'Location permission is required to use this feature')
      return
    }
    setPinLocating(true)
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      const r = { latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }
      setRegion(r)
      setCoords({ latitude: lat, longitude: lng })
      mapRef.current?.animateToRegion(r, 600)
      await reverseGeocode(lat, lng)
    } catch {
      Alert.alert(t('common.error'), 'Could not fetch your location. Try again.')
    } finally {
      setPinLocating(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedCategory || !selectedTemplate || !selectedCountry || !selectedState || !selectedCity) {
      Alert.alert('Missing fields', 'Please complete all required fields.'); return
    }
    setSubmitting(true)
    try {
      const token = await getAuthToken()
      const smartPayload = {
        templateId: selectedTemplate.id,
        templateSlug: selectedTemplate.slug,
        templateName: selectedTemplate.name,
        categoryName: selectedCategory.name,
        answers,
        estimatedPriceMin: estimate?.priceRange?.min ?? null,
        estimatedPriceMax: estimate?.priceRange?.max ?? null,
        timeSlot: preferredTimeSlot,
        preferredDate: preferredDate || null,
        paymentMethod,
        locationText: [selectedArea?.name, selectedCity?.name, selectedState?.name].filter(Boolean).join(', ') + (address ? ` · ${address}` : ''),
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      }

      const res = await fetch(`${API_URL}/api/mobile/v2/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: autoTitle,
          description: autoDescription + (notes ? `\n\nNotes: ${notes}` : ''),
          categoryId: selectedCategory.id,
          serviceTemplateId: selectedTemplate.id,
          templateJobId: selectedTemplate.refJob?.id || null,
          preferredTimeSlot: preferredTimeSlot ? (TIME_SLOT_KEYS[preferredTimeSlot] || 'anytime') : null,
          countryCode: selectedCountry.code || 'LK',
          targetTaskerId: taskerId || null,
          budgetType: 'FIXED',
          budgetAmount: budgetAmount ? Number(budgetAmount) : (estimate?.priceRange?.max ?? 0),
          areaId: selectedArea?.id || null,
          postalCode: null,
          preferredDate: preferredDate || null,
          estimatedDuration: selectedTemplate.defaultDurationMinutes ? selectedTemplate.defaultDurationMinutes / 60 : null,
          workersCount: 1,
          urgency,
          photos,
          materialHandling: 'quote_both',
          smartBookingJson: smartPayload,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { Alert.alert(t('common.error'), data.error || t('postJob.failed')); return }
      setCreatedJobId(data.job?.id || null)
      setCreatedConversationId(data.conversationId || null)
      setPostSuccess(true)
    } catch { Alert.alert(t('common.error'), t('postJob.networkError'))
    } finally { setSubmitting(false) }
  }

  useEffect(() => {
    if (postSuccess) {
      const timer = setTimeout(() => {
        if (createdConversationId) {
          router.replace(`/(chat)/${createdConversationId}?status=OPEN`)
        } else if (createdJobId) {
          router.replace(`/(customer)/jobs/waiting/${createdJobId}`)
        } else {
          router.replace('/(customer)/(tabs)/activity')
        }
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [postSuccess])

  if (postSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <CheckCircle size={46} color={colors.success} weight="fill" />
          </View>
          <Text style={styles.successTitle}>Your job is posted!</Text>
          <Text style={styles.successSub}>We're notifying taskers near you now.</Text>
          <Text style={styles.successSupport}>
            Hold tight — nearby taskers are being notified. We'll show you their quotes shortly.
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  if (loading) {
    return <SafeAreaView style={styles.container}><ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} /></SafeAreaView>
  }

  const stepGroup = step < 2 ? 1 : step < 4 ? 2 : 3
  const catRows = (() => {
    const items = categories.length > 0 ? categories : FALLBACK_CATEGORIES
    const mid = Math.ceil(items.length / 2)
    return [items.slice(0, mid), items.slice(mid)]
  })()

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (step === 1 && enteredPreselected) ? router.back() : step > 0 ? setStep(step - 1) : router.back()}
          style={styles.backBtnCircle}
        >
          {step > 0 ? <CaretLeft size={20} color={colors.ink} weight="bold" /> : <X size={20} color={colors.ink} weight="regular" />}
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post a job</Text>
        <View style={styles.backBtnCircle} />
      </View>

      <View style={styles.stepBadgeWrap}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>STEP {stepGroup} OF 3</Text>
        </View>
      </View>

      <Animated.ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}
        style={{ transform: [{ translateY: slideAnim }] }}>

        <Text style={styles.stepTitle}>{stepMeta[step].title}</Text>
        <Text style={styles.stepSub}>{stepMeta[step].sub}</Text>

        {step === 0 && (
          <View style={styles.stepContent}>
            <View style={styles.catGrid}>
              {catRows.map((row, ri) => (
                <ScrollView
                  key={ri}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.catRow}
                  snapToInterval={catTileW + 10}
                  decelerationRate="fast"
                >
                  {row.map((cat, i) => {
                    const visual = categoryVisualBySlug(cat.slug || cat.id || cat.name)
                    const active = selectedCategory?.id === cat.id
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={{ width: catTileW, alignItems: 'center', marginRight: 10 }}
                        onPress={() => { if (cat.id !== selectedCategory?.id) setTemplatesLoading(true); setSelectedCategory(cat); setSelectedTemplate(null); setAnswers({}); setEstimate(null); setQIndex(0); setStep(1) }}
                        activeOpacity={0.8}
                      >
                        <LinearGradient colors={visual.gradient} style={[styles.catCircle, { width: catTileW - 24, height: catTileW - 24 }, active && styles.catCircleActive]}>
                          <visual.icon size={26} color="rgba(255,255,255,0.95)" weight="fill" />
                          {active && <SealCheck size={18} color="#000000" weight="fill" style={styles.catCheck} />}
                        </LinearGradient>
                        <Text style={[styles.catCircleName, active && styles.catCircleNameActive]} numberOfLines={2}>{cat.name}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              ))}
            </View>

            <View style={[
              styles.customJobCard,
              (showCustomJob || customThanks) && { flexDirection: 'column', alignItems: 'stretch' },
            ]}>
              {customThanks ? (
                <>
                  <View style={styles.customThanksIcon}>
                    <CheckCircle size={30} color={colors.success} weight="fill" />
                  </View>
                  <Text style={styles.customThanksTitle}>Request received!</Text>
                  <Text style={styles.customThanksSub}>
                    Our team will review it. If enough people ask for the same job, we'll add it to the app and match you with a tasker.
                  </Text>
                  <TouchableOpacity
                    style={styles.ctaBtn}
                    onPress={() => { setShowCustomJob(false); setCustomThanks(false); setCustomTitle(''); setCustomDesc(''); setCustomBudget('') }}
                  >
                    <Text style={styles.ctaBtnText}>Done</Text>
                  </TouchableOpacity>
                </>
              ) : showCustomJob ? (
                <>
                  <Text style={styles.customJobTitle}>Request a custom job</Text>
                  <Text style={styles.customJobSub}>
                    Don't see your job listed? Tell us what you need and our team will review it.
                  </Text>
                  <Text style={styles.inputLabel}>What do you need?</Text>
                  <TextInput
                    style={styles.customInput}
                    value={customTitle}
                    onChangeText={setCustomTitle}
                    placeholder="e.g., Fix my balcony railing"
                    placeholderTextColor={colors.muted}
                  />
                  <Text style={styles.inputLabel}>Describe it (optional)</Text>
                  <TextInput
                    style={[styles.customInput, styles.customInputArea]}
                    value={customDesc}
                    onChangeText={setCustomDesc}
                    placeholder="Add details about the job..."
                    placeholderTextColor={colors.muted}
                    multiline
                  />
                  <Text style={styles.inputLabel}>Approximate budget (optional)</Text>
                  <TextInput
                    style={styles.customInput}
                    value={customBudget}
                    onChangeText={setCustomBudget}
                    placeholder="LKR"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity
                    style={[styles.ctaBtn, customSubmitting && { opacity: 0.6 }]}
                    onPress={submitCustomJob}
                    disabled={customSubmitting}
                  >
                    {customSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.ctaBtnText}>Submit request</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowCustomJob(false)} style={{ alignSelf: 'center', paddingVertical: 8 }}>
                    <Text style={styles.customCancel}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.customJobIcon}>
                    <Sparkle size={22} color={colors.amber} weight="fill" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customJobTitle}>Can't find your job?</Text>
                    <Text style={styles.customJobSub}>
                      Request a custom job — we'll add it if others want it too.
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowCustomJob(true)} style={styles.customJobCta}>
                    <Text style={styles.customJobCtaText}>Request</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}

        {step === 1 && (
          <View style={styles.stepContent}>
            {templatesLoading ? (
              <ActivityIndicator size="small" color={colors.amber} style={{ marginVertical: 24 }} />
            ) : templates.length === 0 ? (
              <Text style={styles.fieldHint}>No services available for this category yet.</Text>
            ) : (
              templates.map((tp) => {
                const active = selectedTemplate?.id === tp.id
                return (
                  <TouchableOpacity
                    key={tp.id}
                    style={[styles.serviceOption, active && styles.serviceOptionActive]}
                    onPress={() => { setSelectedTemplate(tp); setShowErrors(false); setStep(2) }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.serviceOptionIcon}>
                      <Sparkle size={20} color={colors.amber} weight="fill" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.serviceOptionName} numberOfLines={1}>{tp.name}</Text>
                      <Text style={styles.serviceOptionDesc} numberOfLines={1}>{tp.description}</Text>
                    </View>
                    <View style={[styles.serviceOptionRadio, active && styles.serviceOptionRadioActive]}>
                      {active && <View style={styles.serviceOptionRadioInner} />}
                    </View>
                  </TouchableOpacity>
                )
              })
            )}
            {showErrors && !selectedTemplate && <Text style={styles.errorHint}>Please select a service</Text>}
            <TouchableOpacity style={[styles.ctaBtn, (!selectedTemplate) && styles.ctaBtnDisabled]}
              onPress={() => {
                if (!selectedTemplate) { setShowErrors(true); Alert.alert('Missing fields', 'Please select a service'); return }
                setShowErrors(false); setStep(2)
              }}>
              <Text style={styles.ctaBtnText}>Next: Where should we go?</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContent}>
            <View style={styles.mapCard}>
              <View style={styles.mapWrap}>
                <MapView
                  ref={mapRef}
                  provider={PROVIDER_DEFAULT}
                  style={StyleSheet.absoluteFill}
                  initialRegion={region}
                  onMapReady={() => setMapReady(true)}
                  onRegionChangeComplete={onRegionChangeComplete}
                  showsUserLocation
                  loadingEnabled
                >
                  {coords && (
                    <Marker coordinate={coords} anchor={{ x: 0.5, y: 1 }}>
                      <MapPin size={34} color={colors.amber} weight="fill" />
                    </Marker>
                  )}
                </MapView>
                <TouchableOpacity style={styles.overlayLocBtn} onPress={useMyLocation} disabled={pinLocating}>
                  {pinLocating ? (
                    <ActivityIndicator color={colors.amber} size="small" />
                  ) : (
                    <>
                      <NavigationArrow size={16} color={colors.amber} weight="fill" />
                      <Text style={styles.overlayLocText}>Use my location</Text>
                    </>
                  )}
                </TouchableOpacity>
                {!coords && !pinLocating && (
                  <View style={styles.mapHint} pointerEvents="none">
                    <MapPin size={14} color={colors.muted} weight="fill" />
                    <Text style={styles.mapHintText}>Move the map to drop a pin</Text>
                  </View>
                )}
              </View>
              <Text style={styles.mapCaption}>
                Drag the map to place the exact service pin{coords ? ` · ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` : ''}
              </Text>
              <View style={styles.inputWrap}>
                <TextInput style={[styles.input, styles.textAreaSmall]} value={address} onChangeText={setAddress}
                  placeholder="Address from the pin — edit if needed" placeholderTextColor={colors.muted} multiline />
              </View>
            </View>

            <Text style={styles.label}>Country <Text style={styles.requiredDot}>*</Text></Text>
            <View style={styles.pillsWrap}>
              {countries.map((c) => (
                <TouchableOpacity key={c.id} style={[styles.pill, selectedCountry?.id === c.id && styles.pillActive]}
                  onPress={() => { setSelectedCountry(c); setSelectedState(null); setSelectedCity(null); setSelectedArea(null) }}>
                  <Text style={[styles.pillText, selectedCountry?.id === c.id && styles.pillTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {showErrors && !selectedCountry && <Text style={styles.errorHint}>Please select a country</Text>}
            {selectedCountry && <>
              <Text style={styles.label}>State / Province <Text style={styles.requiredDot}>*</Text></Text>
              <View style={styles.pillsWrap}>{(selectedCountry.states || []).map((s) => (
                <TouchableOpacity key={s.id} style={[styles.pill, selectedState?.id === s.id && styles.pillActive]}
                  onPress={() => { setSelectedState(s); setSelectedCity(null); setSelectedArea(null) }}>
                  <Text style={[styles.pillText, selectedState?.id === s.id && styles.pillTextActive]}>{s.name}</Text>
                </TouchableOpacity>
              ))}</View>
            </>}
            {selectedState && <>
              <Text style={styles.label}>City <Text style={styles.requiredDot}>*</Text></Text>
              <View style={styles.pillsWrap}>{(selectedState.cities || []).map((c) => (
                <TouchableOpacity key={c.id} style={[styles.pill, selectedCity?.id === c.id && styles.pillActive]}
                  onPress={() => { setSelectedCity(c); setSelectedArea(null) }}>
                  <Text style={[styles.pillText, selectedCity?.id === c.id && styles.pillTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}</View>
              {showErrors && !selectedCity && <Text style={styles.errorHint}>Please select a city</Text>}
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
            <TouchableOpacity style={[styles.ctaBtn, (!selectedCountry || !selectedState || !selectedCity) && styles.ctaBtnDisabled]}
              onPress={() => {
                const missing: string[] = []
                if (!selectedCountry) missing.push('Country')
                if (!selectedState) missing.push('State')
                if (!selectedCity) missing.push('City')
                if (missing.length > 0) { setShowErrors(true); Alert.alert('Missing fields', `Please select: ${missing.join(', ')}`); return }
                setShowErrors(false); setStep(3)
              }}>
              <Text style={styles.ctaBtnText}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.label}>Urgency</Text>
            <View style={styles.urgencyRow}>
              {[
                { key: 'normal', label: 'Normal' },
                { key: 'urgent', label: 'Urgent' },
                { key: 'emergency', label: 'Emergency' },
              ].map((u) => (
                <TouchableOpacity key={u.key} style={[styles.urgencyChip, urgency === u.key && styles.urgencyChipActive]}
                  onPress={() => setUrgency(u.key)}>
                  {u.key === 'emergency' && <Lightning size={14} color={urgency === u.key ? '#000000' : colors.muted} weight={urgency === u.key ? 'fill' : 'regular'} />}
                  {u.key === 'urgent' && <ClockAfternoon size={14} color={urgency === u.key ? '#000000' : colors.muted} weight={urgency === u.key ? 'fill' : 'regular'} />}
                  {u.key === 'normal' && <Snowflake size={14} color={urgency === u.key ? '#000000' : colors.muted} weight={urgency === u.key ? 'fill' : 'regular'} />}
                  <Text style={[styles.urgencyText, urgency === u.key && styles.urgencyTextActive]}>{u.label}</Text>
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
                      style={[styles.dateChip, isActive && styles.dateChipActive]}
                      onPress={() => setPreferredDate(isActive ? '' : dateStr)}>
                      <Text style={[styles.dateChipLabel, isActive && styles.dateChipLabelActive]}>{opt.label}</Text>
                      <Text style={[styles.dateChipDate, isActive && styles.dateChipDateActive]}>
                        {opt.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
                <TouchableOpacity style={[styles.dateChip, showDatePicker && styles.dateChipActive]}
                  onPress={() => setShowDatePicker(!showDatePicker)}>
                  <CalendarBlank size={18} color={showDatePicker ? '#000000' : colors.muted} />
                  <Text style={[styles.dateChipLabel, showDatePicker && styles.dateChipLabelActive]}>Pick a Date</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            {showDatePicker && (
              <View style={styles.datePickerModal}>
                <Text style={styles.datePickerTitle}>Select a date</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {['01','02','03','04','05','06','07'].map(day => {
                    const d = new Date()
                    d.setDate(d.getDate() + parseInt(day))
                    const dateStr = d.toISOString().split('T')[0]
                    const isActive = preferredDate === dateStr
                    return (
                      <TouchableOpacity key={day}
                        style={[styles.dateModalDay, isActive && styles.dateModalDayActive]}
                        onPress={() => { setPreferredDate(dateStr); setShowDatePicker(false) }}>
                        <Text style={[styles.dateModalDayName, isActive && styles.dateModalDayTextActive]}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</Text>
                        <Text style={[styles.dateModalDayNum, isActive && styles.dateModalDayTextActive]}>{d.getDate()}</Text>
                        <Text style={[styles.dateModalDayMonth, isActive && styles.dateModalDayTextActive]}>{d.toLocaleDateString('en-US', { month: 'short' })}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.datePickerClose}>
                  <Text style={styles.datePickerCloseText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
            {preferredDate && (
              <View style={styles.selectedDateBadge}>
                <Text style={styles.selectedDateText}>
                  {new Date(preferredDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
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
                      style={[styles.timeChip, isActive && styles.timeChipActive]}
                      onPress={() => setPreferredTimeSlot(isActive ? '' : slot)}>
                      <ClockAfternoon size={15} color={isActive ? '#000000' : colors.muted} weight={isActive ? 'fill' : 'regular'} />
                      <Text style={[styles.timeChipText, isActive && styles.timeChipTextActive]}>{slot}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.ctaBtn} onPress={() => { setShowErrors(false); setStep(4) }}>
              <Text style={styles.ctaBtnText}>Next: Photos & Notes</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContent}>
            {taskerId ? (
              <View style={styles.taskerChip}>
                <UserCircle size={20} color={colors.amber} weight="fill" />
                <Text style={styles.taskerChipText}>
                  Booking {taskerName || 'your selected tasker'} directly
                </Text>
              </View>
            ) : null}

            <Text style={styles.label}>Photos <Text style={{ color: colors.muted, fontSize: 12 }}>(up to 5 — helps taskers quote accurately)</Text></Text>
            <View style={styles.photoRow}>
              {photos.map((p, i) => (
                <View key={i} style={styles.photoCell}>
                  <Image source={{ uri: resolveImageUri(p) }} style={styles.photoThumb} />
                  <TouchableOpacity style={styles.photoRemove} onPress={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}>
                    <X size={12} color="#fff" weight="bold" />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 5 && (
                <TouchableOpacity style={styles.photoAdd} onPress={pickPhotos} disabled={photoUploading}>
                  {photoUploading ? (
                    <ActivityIndicator size="small" color={colors.amber} />
                  ) : (
                    <>
                      <Camera size={24} color={colors.amber} weight="fill" />
                      <Text style={styles.photoAddText}>Add</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.label}>Notes <Text style={{ color: colors.muted, fontSize: 12 }}>(optional)</Text></Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g., master bedroom air conditioner stopped cooling yesterday"
                placeholderTextColor={colors.muted}
                multiline
              />
            </View>

            <TouchableOpacity style={styles.ctaBtn} onPress={() => { setShowErrors(false); setStep(5) }}>
              <Text style={styles.ctaBtnText}>Review & Post</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 5 && (
          <View style={styles.stepContent}>
            {taskerId ? (
              <View style={styles.taskerChip}>
                <UserCircle size={20} color={colors.amber} weight="fill" />
                <Text style={styles.taskerChipText}>
                  Booking {taskerName || 'your selected tasker'} directly — they'll be notified to quote.
                </Text>
              </View>
            ) : null}
            <View style={styles.reviewCard}>
              {[
                { icon: Clipboard, label: 'Service', value: selectedTemplate ? `${selectedTemplate.jobCategory?.name || ''} — ${selectedTemplate.name}` : '' },
                { icon: Sparkle, label: 'Details', value: (() => { const lines = flattenAnswers(selectedTemplate, answers); return lines.length > 0 ? lines.join('\n') : selectedTemplate?.description || '' })() },
                { icon: MapPin, label: 'Location', value: [selectedArea?.name, selectedCity?.name, selectedState?.name].filter(Boolean).join(', ') + (address ? `\n${address}` : '') },
                { icon: ClockAfternoon, label: 'When', value: preferredDate ? (new Date(preferredDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + (preferredTimeSlot ? ` · ${preferredTimeSlot}` : '')) : (preferredTimeSlot || 'Flexible') },
                { icon: Camera, label: 'Photos', value: photos.length > 0 ? `${photos.length} photo${photos.length > 1 ? 's' : ''} attached` : 'None' },
                { icon: Wallet, label: 'Budget Range', value: estimate ? `${estimate.symbol}${estimate.priceRange.min.toLocaleString()} – ${estimate.symbol}${estimate.priceRange.max.toLocaleString()}` : 'Calculating…' },
              ].map((item, i) => {
                const RIcon = item.icon
                return (
                  <View key={i} style={[styles.reviewItem, i < 5 && styles.reviewItemBorder]}>
                    <RIcon size={18} color={colors.amber} weight="fill" />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={styles.reviewItemLabel}>{item.label}</Text>
                      <Text style={styles.reviewItemValue}>{item.value}</Text>
                    </View>
                  </View>
                )
              })}
            </View>

            {estimateLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <ActivityIndicator size="small" color={colors.amber} />
                <Text style={[styles.fieldHint, { marginTop: 10 }]}>Estimating your price…</Text>
              </View>
            ) : estimate ? (
              <Reanimated.View entering={FadeInRight.duration(300)} style={styles.pricingCard}>
                <Text style={styles.pricingLabel}>Estimated Price</Text>
                <CountUpRange
                  min={estimate.priceRange.min}
                  max={estimate.priceRange.max}
                  symbol={estimate.symbol}
                  style={styles.pricingRange}
                />
                <Text style={styles.pricingConfidence}>
                  Est. {Math.round(estimate.timeEstimateMinutes)} min · {estimate.confidence} confidence
                </Text>
              </Reanimated.View>
            ) : null}

            <Text style={styles.label}>Your Budget (LKR) <Text style={{ color: colors.muted, fontSize: 12 }}>(optional — defaults to estimate)</Text></Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={budgetAmount}
                onChangeText={setBudgetAmount}
                placeholder="Enter max budget"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
              />
            </View>

            <Text style={styles.label}>Payment Method</Text>
            <View style={styles.paymentRow}>
              <TouchableOpacity
                style={[styles.paymentCard, paymentMethod === 'DIGITAL' && styles.paymentCardActive]}
                onPress={() => setPaymentMethod('DIGITAL')}>
                <Wallet size={22} color={paymentMethod === 'DIGITAL' ? '#000000' : colors.muted} weight={paymentMethod === 'DIGITAL' ? 'fill' : 'regular'} />
                <Text style={[styles.paymentTitle, paymentMethod === 'DIGITAL' && styles.paymentTitleActive]}>Digital (Wallet)</Text>
                <Text style={[styles.paymentTag, paymentMethod === 'DIGITAL' && styles.paymentTagActive]}>Recommended</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentCard, paymentMethod === 'CASH' && styles.paymentCardActive]}
                onPress={() => setPaymentMethod('CASH')}>
                <Money size={22} color={paymentMethod === 'CASH' ? '#000000' : colors.muted} weight={paymentMethod === 'CASH' ? 'fill' : 'regular'} />
                <Text style={[styles.paymentTitle, paymentMethod === 'CASH' && styles.paymentTitleActive]}>Cash</Text>
                <Text style={[styles.paymentTag, paymentMethod === 'CASH' ? styles.paymentTagActive : { color: colors.muted }]}>10% commission applies</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.ctaBtn, styles.submitBtn, submitting && styles.ctaBtnDisabled]}
              onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#FFFFFF" /> : <>
                <CheckCircle size={20} color="#FFFFFF" weight="fill" />
                <Text style={styles.ctaBtnText}>Post Job</Text>
              </>}
            </TouchableOpacity>
            <Text style={[styles.fieldHint, { textAlign: 'center', marginTop: 12 }]}>
              We'll notify all nearby matching taskers instantly — no need to wait.
            </Text>
          </View>
        )}

      </Animated.ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  successIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1.5, borderColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { fontSize: 22, fontFamily: fonts.headingBold, color: colors.ink, textAlign: 'center', marginBottom: 8 },
  successSub: { fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.ink, textAlign: 'center', marginBottom: 6 },
  successSupport: { fontSize: 13, fontFamily: fonts.body, color: colors.muted, textAlign: 'center', lineHeight: 19, marginTop: 4 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtnCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: fonts.headingBold, color: colors.ink },

  stepBadgeWrap: { paddingHorizontal: 20, paddingBottom: 4 },
  stepBadge: { alignSelf: 'flex-start', backgroundColor: '#FFF2D6', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  stepBadgeText: { fontSize: 11, fontFamily: fonts.bodyMedium, color: '#9A6000', letterSpacing: 0.5 },

  scroll: { padding: 20, paddingBottom: 40 },
  stepTitle: { fontSize: 28, fontFamily: fonts.heading, color: colors.ink, marginBottom: 4, marginTop: 8 },
  stepSub: { fontSize: 12, fontFamily: fonts.body, color: '#5B5B5B', marginBottom: 24 },
  label: { fontSize: 14, fontFamily: fonts.bodyMedium, marginBottom: 8, marginTop: 16, color: colors.ink },
  stepContent: {},

  pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  pillActive: { borderColor: colors.amber, backgroundColor: 'rgba(245,166,35,0.12)' },
  pillText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.muted },
  pillTextActive: { color: colors.amber },

  catGrid: { marginTop: 4 },
  catRow: { alignItems: 'flex-start', paddingBottom: 6 },
  catCircle: { borderRadius: 999, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  catCircleActive: { borderWidth: 3, borderColor: colors.amber },
  catCircleName: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.muted, textAlign: 'center' },
  catCircleNameActive: { color: colors.amber },
  catCheck: { position: 'absolute', right: 6, top: 6 },

  serviceOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, borderWidth: 1.5, marginBottom: 10,
    backgroundColor: colors.surface, borderColor: colors.border,
  },
  serviceOptionActive: { borderColor: colors.amber, backgroundColor: 'rgba(245,166,35,0.12)' },
  serviceOptionIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(245,166,35,0.12)' },
  serviceOptionName: { fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.ink },
  serviceOptionDesc: { fontSize: 12, fontFamily: fonts.body, color: colors.muted, marginTop: 2 },
  serviceOptionRadio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  serviceOptionRadioActive: { borderColor: colors.amber, backgroundColor: colors.amber },
  serviceOptionRadioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#000000' },

  customJobCard: {
    marginTop: 24, borderRadius: 18, borderWidth: 1.5, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderColor: colors.border,
  },
  customJobIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(245,166,35,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  customJobTitle: { fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.ink },
  customJobSub: { fontSize: 12, fontFamily: fonts.body, color: colors.muted, marginTop: 2, lineHeight: 17 },
  customJobCta: {
    backgroundColor: colors.amber, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
  },
  customJobCtaText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: '#000000' },
  customThanksIcon: { alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(34,197,94,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  customThanksTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.ink, textAlign: 'center', marginBottom: 6 },
  customThanksSub: { fontSize: 13, fontFamily: fonts.body, color: colors.muted, textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  inputLabel: { fontSize: 13, fontFamily: fonts.bodyMedium, marginBottom: 6, marginTop: 10, color: colors.ink },
  customInput: {
    borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, fontFamily: fonts.body,
    backgroundColor: colors.surface, borderColor: colors.border, color: colors.ink,
  },
  customInputArea: { minHeight: 84, textAlignVertical: 'top' },
  customCancel: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.muted },

  mapCard: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.surface, marginBottom: 4 },
  mapWrap: { height: 220, borderRadius: 20, overflow: 'hidden' },
  overlayLocBtn: {
    position: 'absolute', top: 12, right: 12, zIndex: 5,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 100, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  overlayLocText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.amber },
  mapHint: {
    position: 'absolute', bottom: 12, left: 12, zIndex: 5,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100,
  },
  mapHintText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.muted },
  mapCaption: { fontSize: 12, fontFamily: fonts.body, color: colors.muted, paddingHorizontal: 4, paddingTop: 10 },

  inputWrap: { borderRadius: 16, borderWidth: 1.5, overflow: 'hidden', backgroundColor: colors.surface, borderColor: colors.border },
  input: { padding: 16, fontSize: 15, fontFamily: fonts.body, color: colors.ink },
  textAreaSmall: { height: 80, textAlignVertical: 'top' },

  urgencyRow: { flexDirection: 'row', gap: 8 },
  urgencyChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, backgroundColor: colors.surface, borderColor: colors.border },
  urgencyChipActive: { borderColor: colors.amber, backgroundColor: 'rgba(245,166,35,0.12)' },
  urgencyText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.muted },
  urgencyTextActive: { color: '#000000' },

  dateChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', minWidth: 100, backgroundColor: colors.surface, borderColor: colors.border },
  dateChipActive: { borderColor: colors.amber, backgroundColor: 'rgba(245,166,35,0.12)' },
  dateChipLabel: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.muted, marginBottom: 2 },
  dateChipLabelActive: { color: '#000000' },
  dateChipDate: { fontSize: 11, fontFamily: fonts.body, color: colors.muted },
  dateChipDateActive: { color: '#000000' },
  selectedDateBadge: { borderRadius: 12, padding: 12, borderWidth: 1, marginTop: 8, marginBottom: 4, backgroundColor: 'rgba(245,166,35,0.08)', borderColor: colors.amber },
  selectedDateText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.amber },

  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, backgroundColor: colors.surface, borderColor: colors.border },
  timeChipActive: { borderColor: colors.amber, backgroundColor: 'rgba(245,166,35,0.12)' },
  timeChipText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.muted },
  timeChipTextActive: { color: '#000000' },

  datePickerModal: { borderRadius: 20, padding: 20, borderWidth: 1.5, marginTop: 8, marginBottom: 8, backgroundColor: colors.surface, borderColor: colors.border },
  datePickerTitle: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.ink, marginBottom: 16 },
  dateModalDay: { alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1.5, minWidth: 42, backgroundColor: colors.surface, borderColor: colors.border },
  dateModalDayActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  dateModalDayName: { fontSize: 10, fontFamily: fonts.bodyMedium, color: colors.muted },
  dateModalDayNum: { fontSize: 18, fontFamily: fonts.bodyMedium, color: colors.ink, marginVertical: 2 },
  dateModalDayMonth: { fontSize: 10, fontFamily: fonts.body, color: colors.muted },
  dateModalDayTextActive: { color: '#000000' },
  datePickerClose: { alignItems: 'center', paddingVertical: 10 },
  datePickerCloseText: { color: colors.amber, fontFamily: fonts.bodyMedium },

  pricingCard: { borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1.5, marginTop: 16, backgroundColor: 'rgba(245,166,35,0.08)', borderColor: colors.amber },
  pricingLabel: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink, marginBottom: 4 },
  pricingRange: { fontSize: 30, fontFamily: fonts.heading, color: colors.amber, marginBottom: 6 },
  pricingConfidence: { fontSize: 12, fontFamily: fonts.body, color: colors.muted },

  reviewCard: { borderRadius: 16, padding: 4, borderWidth: 1.5, overflow: 'hidden', backgroundColor: colors.surface, borderColor: colors.border },
  reviewItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14 },
  reviewItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  reviewItemLabel: { fontSize: 11, fontFamily: fonts.body, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  reviewItemValue: { fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.ink, marginTop: 1 },

  paymentRow: { flexDirection: 'row', gap: 10 },
  paymentCard: { flex: 1, borderRadius: 16, borderWidth: 1.5, padding: 16, alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderColor: colors.border },
  paymentCardActive: { borderColor: colors.amber, backgroundColor: 'rgba(245,166,35,0.12)' },
  paymentTitle: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.muted },
  paymentTitleActive: { color: '#000000' },
  paymentTag: { fontSize: 11, fontFamily: fonts.body, textAlign: 'center' },
  paymentTagActive: { color: '#000000' },

  ctaBtn: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#000000', borderRadius: 16, marginTop: 28 },
  ctaBtnText: { fontSize: 16, fontFamily: fonts.bodyMedium, color: '#FFFFFF' },
  ctaBtnDisabled: { opacity: 0.4 },

  submitBtn: { height: 58, marginTop: 20 },

  errorHint: { fontSize: 11, fontFamily: fonts.body, color: colors.red, marginTop: 2 },
  fieldHint: { fontSize: 11, fontFamily: fonts.body, color: colors.muted, marginTop: 2 },
  requiredDot: { color: colors.red, fontSize: 14, fontFamily: fonts.bodyMedium },

  taskerChip: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, borderWidth: 1.5, marginBottom: 10, backgroundColor: 'rgba(245,166,35,0.08)', borderColor: colors.amber },
  taskerChipText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.amber, flex: 1 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCell: { width: 84, height: 84, borderRadius: 14, overflow: 'hidden' },
  photoThumb: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  photoAdd: { width: 84, height: 84, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: colors.surface, borderColor: colors.border },
  photoAddText: { fontSize: 11, fontFamily: fonts.bodyMedium, color: colors.muted },
  notesInput: { minHeight: 110, textAlignVertical: 'top' },
})
