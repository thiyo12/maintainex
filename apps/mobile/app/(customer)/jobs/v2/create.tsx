import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { colors } from '../../../../lib/colors'
import { fonts } from '../../../../lib/fonts'
import { getAuthToken } from '../../../../lib/api'
import ProgressSteps from '../../../../components/ui/ProgressSteps'
import { getCategoryIcon } from '../../../../lib/category-icons'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'

interface Category { id: string; name: string; iconName: string }
interface Area { id: string; name: string }
interface City { id: string; name: string; areas: Area[] }
interface State { id: string; name: string; cities: City[] }
interface Country { id: string; name: string; code: string; states: State[] }

const budgetTiers = [
  { key: 'SMALL', label: 'Small', range: 'LKR 1,000 – 3,000', icon: 'cash-outline' as const },
  { key: 'MEDIUM', label: 'Medium', range: 'LKR 3,000 – 8,000', icon: 'wallet-outline' as const },
  { key: 'LARGE', label: 'Large', range: 'LKR 8,000+', icon: 'diamond-outline' as const },
]

const providerTypes = ['FREELANCER', 'COMPANY', 'BOTH']

export default function CreateJobScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Step 1
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  // Step 2
  const [selectedTier, setSelectedTier] = useState('')
  const [providerType, setProviderType] = useState('')

  // Step 3
  const [countries, setCountries] = useState<Country[]>([])
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null)
  const [selectedState, setSelectedState] = useState<State | null>(null)
  const [selectedCity, setSelectedCity] = useState<City | null>(null)
  const [selectedArea, setSelectedArea] = useState<Area | null>(null)
  const [addressText, setAddressText] = useState('')

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
      Alert.alert(t('common.error'), t('errors.network'))
    } finally {
      setLoading(false)
    }
  }

  const tierToBudget = (tier: string): { type: string; amount: number } => {
    if (tier === 'SMALL') return { type: 'FIXED', amount: 3000 }
    if (tier === 'MEDIUM') return { type: 'FIXED', amount: 8000 }
    if (tier === 'LARGE') return { type: 'FIXED', amount: 15000 }
    return { type: 'REQUEST_QUOTES', amount: 0 }
  }

  const handleSubmit = async () => {
    if (!selectedCategory || !title || !description || !selectedTier) {
      Alert.alert(t('postJob.noCategory'), t('postJob.noCategoryMsg'))
      return
    }
    setSubmitting(true)
    try {
      const token = await getAuthToken()
      const budget = tierToBudget(selectedTier)
      const res = await fetch(`${API_URL}/api/mobile/v2/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          title,
          description,
          categoryId: selectedCategory.id,
          budgetType: budget.type,
          budgetAmount: budget.amount,
          providerType: providerType || null,
          areaId: selectedArea?.id || null,
          postalCode: null,
          preferredDate: null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        Alert.alert(t('common.error'), data.error || t('postJob.failed'))
        return
      }
      Alert.alert(t('postJob.published'), t('postJob.publishedMsg'), [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (err) {
      Alert.alert(t('common.error'), t('postJob.networkError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 0 ? setStep(step - 1) : router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.amber} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('postJob.header')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ProgressSteps current={step} total={4} labels={[t('common.next'), t('postJob.step2.title'), t('postJob.step3.title'), t('postJob.step4.title')]} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* STEP 1: Job Details */}
        {step === 0 && (
          <View>
            <Text style={styles.sectionTitle}>{t('postJob.step1.title')}</Text>
            <Text style={styles.sectionSub}>{t('postJob.step1.subtitle')}</Text>

            <Text style={styles.label}>{t('postJob.step1.category')}</Text>
            <View style={styles.categoryGrid}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryCard, selectedCategory?.id === cat.id && styles.categoryCardSelected]}
                  onPress={() => setSelectedCategory(cat)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={getCategoryIcon(cat.iconName)} size={28} color={selectedCategory?.id === cat.id ? colors.amberDark : colors.ink} />
                  <Text style={[styles.catName, selectedCategory?.id === cat.id && styles.catNameSelected]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{t('postJob.step1.jobTitle')}</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder={t('postJob.step1.jobTitlePlaceholder')} placeholderTextColor={colors.muted} />

            <Text style={styles.label}>{t('postJob.step1.description')}</Text>
            <View style={styles.charCountRow}>
              <Text style={styles.charCountHint}>{t('postJob.step1.descHint')}</Text>
              <Text style={[styles.charCount, description.length > 1000 && styles.charCountWarn]}>{description.length}/2000</Text>
            </View>
            <TextInput
              style={[styles.input, styles.textArea, description.length > 1000 && { borderColor: description.length > 1500 ? '#EF4444' : '#F59E0B' }]}
              value={description}
              onChangeText={(t) => setDescription(t.slice(0, 2000))}
              placeholder={t('postJob.step1.descriptionPlaceholder')}
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={5}
            />

            <TouchableOpacity style={[styles.nextBtn, (!selectedCategory || !title || !description) && styles.btnDisabled]} onPress={() => { if (selectedCategory && title && description) setStep(1); else Alert.alert(t('postJob.noCategory'), t('postJob.noCategoryMsg')) }}>
              <Text style={styles.btnText}>{t('common.next')}</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.ink} />
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: Budget & Type */}
        {step === 1 && (
          <View>
            <Text style={styles.sectionTitle}>{t('postJob.step2.title')}</Text>
            <Text style={styles.sectionSub}>{t('postJob.step2.subtitle')}</Text>

            <View style={styles.tierRow}>
              {budgetTiers.map((tier) => (
                <TouchableOpacity
                  key={tier.key}
                  style={[styles.tierCard, selectedTier === tier.key && styles.tierCardSelected]}
                  onPress={() => setSelectedTier(tier.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={tier.icon} size={24} color={selectedTier === tier.key ? colors.amberDark : colors.muted} />
                  <Text style={styles.tierLabel}>{tier.label}</Text>
                  <Text style={[styles.tierRange, selectedTier === tier.key && styles.tierRangeSelected]}>{tier.range}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedTier && (
              <View style={styles.recommendBox}>
                <Ionicons name="bulb-outline" size={18} color={colors.amber} />
                <Text style={styles.recommendText}>
                  {selectedTier === 'LARGE'
                    ? t('postJob.step2.recommendCompany')
                    : t('postJob.step2.recommendTasker')}
                </Text>
              </View>
            )}

            <Text style={styles.label}>{t('postJob.step2.providerType')}</Text>
            <View style={styles.providerRow}>
              {providerTypes.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.providerChip, providerType === p && styles.providerChipSelected]}
                  onPress={() => setProviderType(p)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.providerText, providerType === p && styles.providerTextSelected]}>
                    {p === 'FREELANCER' ? t('postJob.step2.freelancer') : p === 'COMPANY' ? t('postJob.step2.company') : t('postJob.step2.both')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.nextBtn, !selectedTier && styles.btnDisabled]} onPress={() => { if (selectedTier) setStep(2); else Alert.alert(t('postJob.selectBudget'), t('postJob.selectBudgetMsg')) }}>
              <Text style={styles.btnText}>{t('common.next')}</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.ink} />
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3: Location */}
        {step === 2 && (
          <View>
            <Text style={styles.sectionTitle}>{t('postJob.step3.title')}</Text>
            <Text style={styles.sectionSub}>{t('postJob.step3.subtitle')}</Text>

            <Text style={styles.label}>{t('postJob.step3.country')}</Text>
            <View style={styles.pickerRow}>
              {countries.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.pill, selectedCountry?.id === c.id && styles.pillSelected]}
                  onPress={() => { setSelectedCountry(c); setSelectedState(null); setSelectedCity(null); setSelectedArea(null) }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, selectedCountry?.id === c.id && styles.pillTextSelected]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedCountry && (
              <>
                <Text style={styles.label}>{t('postJob.step3.state')}</Text>
                <View style={styles.pickerRow}>
                  {selectedCountry.states.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.pill, selectedState?.id === s.id && styles.pillSelected]}
                      onPress={() => { setSelectedState(s); setSelectedCity(null); setSelectedArea(null) }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pillText, selectedState?.id === s.id && styles.pillTextSelected]}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {selectedState && (
              <>
                <Text style={styles.label}>{t('postJob.step3.city')}</Text>
                <View style={styles.pickerRow}>
                  {selectedState.cities.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.pill, selectedCity?.id === c.id && styles.pillSelected]}
                      onPress={() => { setSelectedCity(c); setSelectedArea(null) }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pillText, selectedCity?.id === c.id && styles.pillTextSelected]}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {selectedCity && selectedCity.areas.length > 0 && (
              <>
                <Text style={styles.label}>{t('postJob.step3.area')}</Text>
                <View style={styles.pickerRow}>
                  {selectedCity.areas.map((a) => (
                    <TouchableOpacity
                      key={a.id}
                      style={[styles.pill, selectedArea?.id === a.id && styles.pillSelected]}
                      onPress={() => setSelectedArea(a)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pillText, selectedArea?.id === a.id && styles.pillTextSelected]}>{a.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.label}>{t('postJob.step3.address')}</Text>
            <TextInput
              style={styles.input}
              value={addressText}
              onChangeText={setAddressText}
              placeholder={t('postJob.step3.addressPlaceholder')}
              placeholderTextColor={colors.muted}
            />

            <TouchableOpacity style={[styles.nextBtn, (!selectedCountry || !selectedState || !selectedCity) && styles.btnDisabled]} onPress={() => { if (selectedCountry && selectedState && selectedCity) setStep(3); else Alert.alert(t('postJob.selectLocation'), t('postJob.selectLocationMsg')) }}>
              <Text style={styles.btnText}>{t('postJob.step4.title')}</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.ink} />
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 4: Review & Post */}
        {step === 3 && (
          <View>
            <Text style={styles.sectionTitle}>{t('postJob.step4.title')}</Text>
            <Text style={styles.sectionSub}>{t('postJob.step4.subtitle')}</Text>

            <View style={styles.reviewCard}>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>{t('postJob.step4.category')}</Text>
                <Text style={styles.reviewValue}>{selectedCategory?.name}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>{t('postJob.step4.title_lbl')}</Text>
                <Text style={styles.reviewValue}>{title}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>{t('postJob.step4.description')}</Text>
                <Text style={styles.reviewValue} numberOfLines={3}>{description}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>{t('postJob.step4.budget')}</Text>
                <Text style={styles.reviewValue}>{budgetTiers.find(tier => tier.key === selectedTier)?.label} — {budgetTiers.find(tier => tier.key === selectedTier)?.range}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>{t('postJob.step4.provider')}</Text>
                <Text style={styles.reviewValue}>{providerType || t('postJob.step4.any')}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>{t('postJob.step4.location')}</Text>
                <Text style={styles.reviewValue}>{selectedArea?.name || selectedCity?.name}, {selectedState?.name}</Text>
              </View>
            </View>

            <View style={styles.reviewFooter}>
              <TouchableOpacity onPress={() => setStep(0)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="arrow-back" size={18} color={colors.amber} />
                <Text style={styles.editLink}> {t('postJob.step4.editDetails')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.btnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color={colors.ink} /> : <><Ionicons name="checkmark-circle-outline" size={18} color={colors.ink} /><Text style={styles.submitBtnText}> {t('postJob.step4.post')}</Text></>}
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
  headerTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.ink },
  content: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 22, fontFamily: fonts.heading, color: colors.ink, marginBottom: 4 },
  sectionSub: { fontSize: 14, fontFamily: fonts.body, color: colors.muted, marginBottom: 20 },

  // Step 1 — Category grid
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: { width: '47%', padding: 16, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', marginBottom: 8, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  categoryCardSelected: { backgroundColor: colors.amberBg, borderWidth: 2, borderColor: colors.amber },
  catName: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink, textAlign: 'center' },
  catNameSelected: { color: colors.amberDark, fontFamily: fonts.bodyMedium },

  // Fields
  label: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.ink, marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 15, fontFamily: fonts.body, color: colors.ink, backgroundColor: colors.white },
  textArea: { height: 140, textAlignVertical: 'top' },
  charCountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, marginTop: -2 },
  charCountHint: { fontSize: 12, color: colors.muted, flex: 1, fontFamily: fonts.bodyLight },
  charCount: { fontSize: 12, color: colors.muted, fontFamily: fonts.bodyMedium },
  charCountWarn: { color: '#F59E0B' },

  // Step 2 — Budget tiers
  tierRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  tierCard: { flex: 1, backgroundColor: colors.white, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border },
  tierCardSelected: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  tierLabel: { fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.ink, marginBottom: 4 },
  tierRange: { fontSize: 11, fontFamily: fonts.bodyLight, color: colors.muted },
  tierRangeSelected: { color: colors.amberDark, fontFamily: fonts.bodyMedium },
  recommendBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, backgroundColor: colors.amberBg, borderRadius: 12, marginBottom: 12 },
  recommendText: { flex: 1, fontSize: 13, fontFamily: fonts.body, color: colors.muted, lineHeight: 18 },

  providerRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  providerChip: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border },
  providerChipSelected: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  providerText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.muted },
  providerTextSelected: { color: colors.amberDark, fontFamily: fonts.bodyMedium },

  // Step 3 — Location
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border },
  pillSelected: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  pillText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.muted },
  pillTextSelected: { color: colors.amberDark, fontFamily: fonts.bodyMedium },

  // Buttons
  nextBtn: { flexDirection: 'row', backgroundColor: colors.amber, paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 24, gap: 8 },
  btnText: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.ink },
  btnDisabled: { opacity: 0.5 },

  // Step 4 — Review
  reviewCard: { backgroundColor: colors.white, borderRadius: 14, padding: 16, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  reviewRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  reviewLabel: { fontSize: 12, fontFamily: fonts.body, color: colors.muted, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  reviewValue: { fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.ink },
  reviewFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 24 },
  editLink: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.amber },
  submitBtn: { flexDirection: 'row', backgroundColor: colors.amber, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 6 },
  submitBtnText: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.ink },
})
