import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, TextInput,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/features/auth/context/auth'
import { useColors } from '@/lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { fonts } from '@/lib/fonts'
import { getCategoryI18nKey } from '@/lib/categories'
import { getAuthToken } from '@/api/token'
import { taskers } from '@/api/taskers'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'

interface Category {
  id: string
  name: string
  iconName: string
}

const FALLBACK_CATEGORIES: Category[] = [
  { id: 'electrical', name: 'Electrical', iconName: 'flash-outline' },
  { id: 'plumbing', name: 'Plumbing', iconName: 'water-outline' },
  { id: 'ac', name: 'AC & Refrigeration', iconName: 'snow-outline' },
  { id: 'painting', name: 'Painting', iconName: 'color-palette-outline' },
  { id: 'carpentry', name: 'Carpentry', iconName: 'hammer-outline' },
  { id: 'cleaning', name: 'Cleaning', iconName: 'sparkles-outline' },
  { id: 'gardening', name: 'Gardening', iconName: 'leaf-outline' },
  { id: 'moving', name: 'Moving', iconName: 'cube-outline' },
  { id: 'pest-control', name: 'Pest Control', iconName: 'bug-outline' },
  { id: 'roofing', name: 'Roofing', iconName: 'home-outline' },
  { id: 'flooring', name: 'Flooring', iconName: 'layers-outline' },
  { id: 'tiling', name: 'Tiling', iconName: 'grid-outline' },
  { id: 'fencing', name: 'Fencing', iconName: 'lock-closed-outline' },
  { id: 'landscaping', name: 'Landscaping', iconName: 'flower-outline' },
  { id: 'home-automation', name: 'Home Automation', iconName: 'bulb-outline' },
  { id: 'solar', name: 'Solar', iconName: 'sunny-outline' },
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
              iconName: c.iconName || 'construct-outline',
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
      await taskers.updateProfile({
        skills: Array.from(selectedIds),
        ...(needsPhone ? { phone: phone.trim() } : {}),
      })
      await refreshUser()
      router.replace('/(tasker)')
    } catch (err: any) {
      let message = err?.message || t('errors.generic')
      try {
        const parsed = JSON.parse(message)
        message = parsed?.error || parsed?.message || message
      } catch {}
      Alert.alert(t('common.error'), message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={colors.ink} />
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
        <Ionicons
          name={allrounder ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={allrounder ? colors.amber : colors.muted}
        />
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
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.card, selected && styles.cardSelected]}
                onPress={() => toggleCategory(cat.id)}
                activeOpacity={0.7}
              >
                <Ionicons name={cat.iconName as any} size={28} color={selected ? colors.amberDark : colors.ink} />
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
            <Ionicons name="arrow-forward" size={20} color={colors.white} />
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
