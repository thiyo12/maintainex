import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../../lib/auth'
import { useColors } from '../../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { fonts } from '../../../lib/fonts'
import { getCategoryI18nKey } from '../../../lib/categories'
import { getAuthToken } from '../../../lib/api'
import { v2Team } from '../../../lib/api-v2'

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

interface InviteEntry {
  name: string
  email: string
  phone: string
}

export default function CompanySetupOnboarding() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { t } = useTranslation()
  const { user, refreshUser } = useAuth()
  const [step, setStep] = useState(0)

  const [companyName, setCompanyName] = useState('')
  const [registrationNo, setRegistrationNo] = useState('')
  const [description, setDescription] = useState('')

  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [categoriesLoading, setCategoriesLoading] = useState(true)

  const [invites, setInvites] = useState<InviteEntry[]>([])
  const [newInvite, setNewInvite] = useState<InviteEntry>({ name: '', email: '', phone: '' })

  const STEPS = [t('auth.onboarding.steps.0'), t('auth.onboarding.steps.1'), t('auth.onboarding.steps.2'), t('auth.onboarding.steps.3')]
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    setCategoriesLoading(true)
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
      setCategoriesLoading(false)
    }
  }

  const toggleCategory = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const addInvite = () => {
    if (!newInvite.name) {
      Alert.alert(t('common.error'), t('errors.enterMemberName'))
      return
    }
    if (!newInvite.email && !newInvite.phone) {
      Alert.alert(t('common.error'), t('errors.enterEmailOrPhone'))
      return
    }
    setInvites([...invites, { ...newInvite }])
    setNewInvite({ name: '', email: '', phone: '' })
  }

  const removeInvite = (index: number) => {
    setInvites(invites.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!companyName) {
      Alert.alert(t('common.error'), t('errors.companyNameRequired'))
      return
    }
    if (selectedIds.size === 0) {
      Alert.alert(t('common.error'), t('errors.selectServiceCompany'))
      return
    }
    setSaving(true)
    try {
      const token = await getAuthToken()

      const profileRes = await fetch(`${API_URL}/api/mobile/company/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          companyName,
          registrationNo: registrationNo || undefined,
          description: description || undefined,
          services: Array.from(selectedIds),
          serviceAreas: [],
        }),
      })
      if (!profileRes.ok) {
        const err = await profileRes.json()
        Alert.alert(t('common.error'), err.error || t('errors.generic'))
        return
      }

      for (const invite of invites) {
        try {
          await v2Team.invite({ name: invite.name, email: invite.email || undefined, phone: invite.phone || undefined })
        } catch {
          // ignore individual invite failures
        }
      }

      await refreshUser()
      router.replace('/(company)')
    } catch {
      Alert.alert(t('common.error'), t('errors.network'))
    } finally {
      setSaving(false)
    }
  }

  const renderStepIndicator = () => (
    <View style={styles.stepsRow}>
      {STEPS.map((label, i) => (
        <TouchableOpacity key={i} style={styles.stepItem} onPress={() => i < step && setStep(i)} disabled={i > step}>
          <View style={[styles.stepDot, i === step && styles.stepDotActive, i < step && styles.stepDotDone]}>
            {i < step ? (
              <Ionicons name="checkmark" size={14} color={colors.white} />
            ) : (
              <Text style={[styles.stepNum, i === step && styles.stepNumActive]}>{i + 1}</Text>
            )}
          </View>
          <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View>
            <Text style={styles.sectionTitle}>{t('auth.onboarding.companyInfo')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.onboarding.companyName')}
              placeholderTextColor={colors.muted}
              value={companyName}
              onChangeText={setCompanyName}
            />
            <TextInput
              style={styles.input}
              placeholder={t('auth.onboarding.regNumber')}
              placeholderTextColor={colors.muted}
              value={registrationNo}
              onChangeText={setRegistrationNo}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('auth.onboarding.description')}
              placeholderTextColor={colors.muted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </View>
        )
      case 1:
        return (
          <View>
            <Text style={styles.sectionTitle}>{t('auth.onboarding.selectServicesTitle')}</Text>
            <Text style={styles.sectionSub}>{t('auth.onboarding.selectServicesDesc2')}</Text>
            {categoriesLoading ? (
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
          </View>
        )
      case 2:
        return (
          <View>
            <Text style={styles.sectionTitle}>{t('auth.onboarding.inviteTeam')}</Text>
            <Text style={styles.sectionSub}>{t('auth.onboarding.inviteTeamDesc')}</Text>

            <View style={styles.inviteForm}>
              <TextInput
                style={styles.input}
                placeholder={t('auth.onboarding.memberName')}
                placeholderTextColor={colors.muted}
                value={newInvite.name}
                onChangeText={(t) => setNewInvite({ ...newInvite, name: t })}
              />
              <TextInput
                style={styles.input}
                placeholder={t('auth.onboarding.memberEmail')}
                placeholderTextColor={colors.muted}
                value={newInvite.email}
                onChangeText={(t) => setNewInvite({ ...newInvite, email: t })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder={t('auth.onboarding.memberPhone')}
                placeholderTextColor={colors.muted}
                value={newInvite.phone}
                onChangeText={(t) => setNewInvite({ ...newInvite, phone: t })}
                keyboardType="phone-pad"
              />
              <TouchableOpacity style={styles.addInviteBtn} onPress={addInvite}>
                <Ionicons name="person-add-outline" size={18} color={colors.white} />
                <Text style={styles.addInviteText}>{t('auth.onboarding.addMember')}</Text>
              </TouchableOpacity>
            </View>

            {invites.map((inv, i) => (
              <View key={i} style={styles.inviteRow}>
                <Ionicons name="person-outline" size={20} color={colors.amber} />
                <View style={styles.inviteInfo}>
                  <Text style={styles.inviteName}>{inv.name}</Text>
                  <Text style={styles.inviteContact}>{inv.email || inv.phone}</Text>
                </View>
                <TouchableOpacity onPress={() => removeInvite(i)}>
                  <Ionicons name="close-circle-outline" size={22} color={colors.muted} />
                </TouchableOpacity>
              </View>
            ))}

            {invites.length === 0 && (
              <Text style={styles.skipHint}>{t('auth.onboarding.inviteLater')}</Text>
            )}
          </View>
        )
      case 3:
        return (
          <View>
            <Text style={styles.sectionTitle}>{t('auth.onboarding.review')}</Text>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>{t('auth.onboarding.companyNameLabel')}</Text>
              <Text style={styles.reviewValue}>{companyName}</Text>
            </View>
            {registrationNo ? (
              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>{t('auth.onboarding.regNo')}</Text>
                <Text style={styles.reviewValue}>{registrationNo}</Text>
              </View>
            ) : null}
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>{t('auth.onboarding.servicesCount', { n: selectedIds.size })}</Text>
              <Text style={styles.reviewValue}>
                {categories.filter(c => selectedIds.has(c.id)).map(c => t(getCategoryI18nKey(c))).join(', ')}
              </Text>
            </View>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>{t('auth.onboarding.teamInvites')}</Text>
              <Text style={styles.reviewValue}>{invites.length} member{invites.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
        )
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => step > 0 ? setStep(step - 1) : router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </TouchableOpacity>

        <Text style={styles.title}>{t('auth.onboarding.setupTitle')}</Text>

        {renderStepIndicator()}
        {renderStep()}

        <View style={styles.navRow}>
          {step > 0 && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(step - 1)}>
              <Ionicons name="arrow-back" size={18} color={colors.ink} />
              <Text style={styles.secondaryBtnText}>{t('common.back')}</Text>
            </TouchableOpacity>
          )}
          {step < STEPS.length - 1 ? (
            <TouchableOpacity
              style={[styles.primaryBtn, step === 0 && !companyName && styles.primaryBtnDisabled]}
              onPress={() => setStep(step + 1)}
              disabled={step === 0 && !companyName}
            >
              <Text style={styles.primaryBtnText}>{t('common.continue')}</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.white} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryBtn, (!companyName || selectedIds.size === 0 || saving) && styles.primaryBtnDisabled]}
              onPress={handleSubmit}
              disabled={!companyName || selectedIds.size === 0 || saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>{t('common.finishSetup')}</Text>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 24, paddingBottom: 48 },
  backButton: { marginBottom: 16, alignSelf: 'flex-start' },
  title: { fontSize: 26, fontFamily: fonts.headingBold, color: colors.ink, marginBottom: 24 },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  stepItem: { alignItems: 'center', flex: 1 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border,
  },
  stepDotActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  stepDotDone: { backgroundColor: colors.success, borderColor: colors.success },
  stepNum: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.muted },
  stepNumActive: { color: colors.white },
  stepLabel: { fontSize: 11, fontFamily: fonts.body, color: colors.muted, marginTop: 4, textAlign: 'center' },
  stepLabelActive: { fontFamily: fonts.bodyMedium, color: colors.ink },
  sectionTitle: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.ink, marginBottom: 8 },
  sectionSub: { fontSize: 14, fontFamily: fonts.body, color: colors.muted, marginBottom: 20, lineHeight: 20 },
  input: {
    backgroundColor: colors.white, borderRadius: 12, padding: 14, fontSize: 15,
    fontFamily: fonts.body, color: colors.ink, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  textArea: { height: 100, textAlignVertical: 'top' },
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
  inviteForm: { marginBottom: 16 },
  addInviteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.amber, paddingVertical: 12, borderRadius: 12, marginTop: 4,
  },
  addInviteText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.white },
  inviteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, backgroundColor: colors.white, borderRadius: 12,
    marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  inviteInfo: { flex: 1 },
  inviteName: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.ink },
  inviteContact: { fontSize: 12, fontFamily: fonts.body, color: colors.muted },
  skipHint: { fontSize: 13, fontFamily: fonts.body, color: colors.muted, fontStyle: 'italic', marginTop: 8 },
  reviewSection: { marginBottom: 16, padding: 14, backgroundColor: colors.white, borderRadius: 12 },
  reviewLabel: { fontSize: 12, fontFamily: fonts.body, color: colors.muted, marginBottom: 4 },
  reviewValue: { fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.ink },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, gap: 12 },
  primaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.amber, paddingVertical: 16, borderRadius: 16,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.white },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 16, paddingHorizontal: 20, borderRadius: 16,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
  },
  secondaryBtnText: { fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.ink },
})
