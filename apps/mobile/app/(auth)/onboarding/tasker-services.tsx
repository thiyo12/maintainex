import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, TextInput,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../../lib/auth'
import { useColors } from '../../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { fonts } from '../../../lib/fonts'
import { getCategoryI18nKey } from '../../../lib/categories'
import { getAuthToken } from '../../../lib/api'
import {
  CaretLeft, CaretRight, CheckCircle, Circle,
  Lightning, Drop, Snowflake, Palette, Hammer, Sparkle, Leaf, Package,
  Bug, House, Layers, GridFour, Lock, Flower, Lightbulb, Sun, Wrench,
} from 'phosphor-react-native'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'

interface Category {
  id: string
  name: string
  iconName: string
}

const CATEGORY_ICON_MAP: Record<string, React.ComponentType<any>> = {
  'Lightning': Lightning,
  'Drop': Drop,
  'Snowflake': Snowflake,
  'Palette': Palette,
  'Hammer': Hammer,
  'Sparkle': Sparkle,
  'Leaf': Leaf,
  'Package': Package,
  'Bug': Bug,
  'House': House,
  'Layers': Layers,
  'GridFour': GridFour,
  'Lock': Lock,
  'Flower': Flower,
  'Lightbulb': Lightbulb,
  'Sun': Sun,
  'Wrench': Wrench,
}

const FALLBACK_CATEGORIES: Category[] = [
  { id: 'electrical', name: 'Electrical', iconName: 'Lightning' },
  { id: 'plumbing', name: 'Plumbing', iconName: 'Drop' },
  { id: 'ac', name: 'AC & Refrigeration', iconName: 'Snowflake' },
  { id: 'painting', name: 'Painting', iconName: 'Palette' },
  { id: 'carpentry', name: 'Carpentry', iconName: 'Hammer' },
  { id: 'cleaning', name: 'Cleaning', iconName: 'Sparkle' },
  { id: 'gardening', name: 'Gardening', iconName: 'Leaf' },
  { id: 'moving', name: 'Moving', iconName: 'Package' },
  { id: 'pest-control', name: 'Pest Control', iconName: 'Bug' },
  { id: 'roofing', name: 'Roofing', iconName: 'House' },
  { id: 'flooring', name: 'Flooring', iconName: 'Layers' },
  { id: 'tiling', name: 'Tiling', iconName: 'GridFour' },
  { id: 'fencing', name: 'Fencing', iconName: 'Lock' },
  { id: 'landscaping', name: 'Landscaping', iconName: 'Flower' },
  { id: 'home-automation', name: 'Home Automation', iconName: 'Lightbulb' },
  { id: 'solar', name: 'Solar', iconName: 'Sun' },
]

export default function TaskerServicesOnboarding() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { t } = useTranslation()
  const { user, refreshUser } = useAuth()
  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [allrounder, setAllrounder] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [phone, setPhone] = useState('')
  const needsPhone = !user?.phone

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    setLoading(true)
    try {
      const token = await getAuthToken()
      const res = await fetch(`${API_URL}/api/mobile/job-categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.length > 0) {
          setCategories(
            data.map((c: any) => ({
              id: c.id,
              name: c.name,
              iconName: c.iconName || 'Wrench',
            }))
          )
        }
      }
    } catch {
      // use fallback
    } finally {
      setLoading(false)
    }
  }

  const toggleCategory = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
    if (next.size < categories.length) setAllrounder(false)
  }

  const toggleAllrounder = () => {
    const next = !allrounder
    setAllrounder(next)
    if (next) setSelectedIds(new Set(categories.map(c => c.id)))
    else setSelectedIds(new Set())
  }

  const handleSave = async () => {
    if (selectedIds.size === 0) {
      Alert.alert(t('errors.selectionRequired'), t('errors.selectService'))
      return
    }
    if (needsPhone && phone.trim().length < 7) {
      Alert.alert(t('common.error'), 'Please add a valid phone number so customers can reach you.')
      return
    }
    setSaving(true)
    try {
      const token = await getAuthToken()
      const res = await fetch(`${API_URL}/api/mobile/taskers/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          skills: Array.from(selectedIds),
          ...(needsPhone ? { phone: phone.trim() } : {}),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        Alert.alert(t('common.error'), err.error || t('errors.generic'))
        return
      }
      await refreshUser()
      router.replace('/(tasker)')
    } catch {
      Alert.alert(t('common.error'), t('errors.network'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <CaretLeft size={24} color={colors.ink} weight="bold" />
      </TouchableOpacity>

      <Text style={styles.title}>{t('auth.onboarding.selectServices')}</Text>
      <Text style={styles.subtitle}>
        {t('auth.onboarding.selectServicesDesc')}
      </Text>

      {needsPhone && (
        <View style={styles.phoneCard}>
          <Text style={styles.phoneLabel}>Phone number</Text>
          <TextInput
            style={[styles.phoneInput, { backgroundColor: colors.surface, color: colors.ink, borderColor: colors.border }]}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="e.g. 077 123 4567"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.phoneHint}>Customers use this to reach you. Keep it up to date in Settings.</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.allrounderCard, allrounder && styles.allrounderCardActive]}
        onPress={toggleAllrounder}
        activeOpacity={0.7}
      >
        {allrounder ? (
          <CheckCircle size={24} color={colors.amber} weight="fill" />
        ) : (
          <Circle size={24} color={colors.muted} weight="bold" />
        )}
        <View style={styles.allrounderTextWrap}>
          <Text style={styles.allrounderLabel}>{t('auth.onboarding.allrounder')}</Text>
          <Text style={styles.allrounderDesc}>{t('auth.onboarding.allrounderDesc', { n: categories.length })}</Text>
        </View>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color={colors.amber} style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.grid}>
          {categories.map((cat) => {
            const selected = selectedIds.has(cat.id)
            const IconComponent = CATEGORY_ICON_MAP[cat.iconName] || Wrench
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.card, selected && styles.cardSelected]}
                onPress={() => toggleCategory(cat.id)}
                activeOpacity={0.7}
              >
                <IconComponent size={28} color={selected ? colors.amberDark : colors.ink} weight="bold" />
                <Text style={[styles.cardLabel, selected && styles.cardLabelSelected]}>{t(getCategoryI18nKey(cat))}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      <TouchableOpacity
        style={[styles.saveButton, (selectedIds.size === 0 || saving) && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={selectedIds.size === 0 || saving}
      >
        {saving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            <Text style={styles.saveText}>{t('auth.onboarding.saveAndContinue')}</Text>
            <CaretRight size={20} color={colors.white} weight="bold" />
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 24, paddingBottom: 48 },
  backButton: { marginBottom: 16, alignSelf: 'flex-start' },
  title: { fontSize: 26, fontFamily: fonts.headingBold, color: colors.ink, marginBottom: 8 },
  subtitle: { fontSize: 15, fontFamily: fonts.body, color: colors.muted, marginBottom: 24, lineHeight: 22 },
  phoneCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, marginBottom: 16, backgroundColor: colors.white },
  phoneLabel: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink, marginBottom: 8 },
  phoneInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, fontFamily: fonts.body },
  phoneHint: { fontSize: 11, fontFamily: fonts.body, color: colors.muted, marginTop: 6 },
  allrounderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 16, backgroundColor: colors.white,
    marginBottom: 20, borderWidth: 2, borderColor: colors.border,
  },
  allrounderCardActive: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  allrounderTextWrap: { flex: 1 },
  allrounderLabel: { fontSize: 17, fontFamily: fonts.bodyMedium, color: colors.ink },
  allrounderDesc: { fontSize: 13, fontFamily: fonts.body, color: colors.muted, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '47%', padding: 16, borderRadius: 16, backgroundColor: colors.white,
    alignItems: 'center', marginBottom: 8,
    shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardSelected: { backgroundColor: colors.amberBg, borderWidth: 2, borderColor: colors.amber },
  cardLabel: { fontSize: 13, fontFamily: fonts.body, color: colors.ink, marginTop: 8, textAlign: 'center' },
  cardLabelSelected: { fontFamily: fonts.bodyMedium, color: colors.amberDark },
  saveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.amber, paddingVertical: 16, borderRadius: 16, marginTop: 24,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveText: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.white },
})
