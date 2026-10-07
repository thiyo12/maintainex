import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/features/auth/context/auth'
import { useColors } from '@/lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { fonts } from '@/lib/fonts'
import { getCategoryI18nKey } from '@/lib/categories'
import { getAuthToken } from '@/api/token'
import {
  CaretLeft, CaretRight, Check, CheckCircle, UsersThree, ShieldCheck,
  Lightning, Drop, Snowflake, Palette, Hammer, Sparkle, Leaf, Package,
  Bug, House, SquaresFour, GridFour, Lock, Flower, Lightbulb, Sun, Wrench,
} from 'phosphor-react-native'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'

interface CompanyServiceJob {
  id: string
  name: string
  isCompanyOnly?: boolean
}

interface Category {
  id: string
  name: string
  iconName: string
  jobs: CompanyServiceJob[]
}

const CATEGORY_ICON_MAP: Record<string, React.ComponentType<any>> = {
  Lightning,
  Drop,
  Snowflake,
  Palette,
  Hammer,
  Sparkle,
  Leaf,
  Package,
  Bug,
  House,
  Layers: SquaresFour,
  GridFour,
  Lock,
  Flower,
  Lightbulb,
  Sun,
  Wrench,
}

const FALLBACK_CATEGORIES: Category[] = []

export default function CompanySetupOnboarding() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { t } = useTranslation()
  const { refreshUser } = useAuth()
  const [step, setStep] = useState(0)

  const [companyName, setCompanyName] = useState('')
  const [registrationNo, setRegistrationNo] = useState('')
  const [description, setDescription] = useState('')

  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [categoriesLoading, setCategoriesLoading] = useState(true)

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
              iconName: c.iconName || 'Wrench',
              jobs: Array.isArray(c.jobs)
                ? c.jobs.map((job: any) => ({ id: job.id, name: job.name, isCompanyOnly: job.isCompanyOnly }))
                : [],
            })).filter((c: Category) => c.jobs.length > 0)
          )
          setExpandedCategory((current) => current || data.find((c: any) => Array.isArray(c.jobs) && c.jobs.length > 0)?.id || null)
        }
      }
    } catch {
      // use fallback
    } finally {
      setCategoriesLoading(false)
    }
  }

  const toggleService = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
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
              <Check size={14} color={colors.white} weight="bold" />
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
            <Text style={styles.sectionSub}>Choose the exact services your company can deliver. This keeps job matching accurate.</Text>
            <View style={styles.serviceCountCard}>
              <Text style={styles.serviceCount}>{selectedIds.size}</Text>
              <Text style={styles.serviceCountLabel}>{selectedIds.size === 1 ? 'service selected' : 'services selected'}</Text>
            </View>
            {categoriesLoading ? (
              <ActivityIndicator color={colors.amber} style={{ marginTop: 24 }} />
            ) : categories.length === 0 ? (
              <Text style={styles.skipHint}>Services could not be loaded. Check your connection and reopen this step.</Text>
            ) : (
              <View>
                {categories.map((cat) => {
                  const open = expandedCategory === cat.id
                  const IconComponent = CATEGORY_ICON_MAP[cat.iconName] || Wrench
                  const selectedCount = cat.jobs.filter(job => selectedIds.has(job.id)).length
                  return (
                    <View key={cat.id} style={styles.categoryCard}>
                      <TouchableOpacity
                        style={styles.categoryHeader}
                        activeOpacity={0.72}
                        onPress={() => setExpandedCategory(open ? null : cat.id)}
                      >
                        <View style={styles.categoryIcon}>
                          <IconComponent size={20} color={colors.ink} weight="bold" />
                        </View>
                        <View style={styles.categoryCopy}>
                          <Text style={styles.categoryName}>{t(getCategoryI18nKey(cat))}</Text>
                          <Text style={styles.categoryMeta}>{selectedCount} selected · {cat.jobs.length} services</Text>
                        </View>
                        <CaretRight
                          size={18}
                          color={colors.muted}
                          weight="bold"
                          style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}
                        />
                      </TouchableOpacity>

                      {open ? (
                        <View style={styles.jobList}>
                          {cat.jobs.map(job => {
                            const selected = selectedIds.has(job.id)
                            return (
                              <TouchableOpacity
                                key={job.id}
                                style={styles.jobRow}
                                activeOpacity={0.72}
                                onPress={() => toggleService(job.id)}
                              >
                                <View style={[styles.jobCheck, selected && styles.jobCheckSelected]}>
                                  {selected ? <Check size={13} color={colors.white} weight="bold" /> : null}
                                </View>
                                <Text style={styles.jobName}>{job.name}</Text>
                                {job.isCompanyOnly ? <Text style={styles.companyOnly}>COMPANY</Text> : null}
                              </TouchableOpacity>
                            )
                          })}
                        </View>
                      ) : null}
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        )
      case 2:
        return (
          <View>
            <Text style={styles.sectionTitle}>Your company workspace</Text>
            <Text style={styles.sectionSub}>Your owner account is created first. After company verification, you can invite managers, dispatchers, workers and finance staff from the Team workspace.</Text>

            <View style={styles.workspaceCard}>
              <View style={styles.workspaceIcon}><UsersThree size={24} color={colors.ink} weight="fill" /></View>
              <View style={styles.workspaceCopy}>
                <Text style={styles.workspaceTitle}>Team access unlocks after verification</Text>
                <Text style={styles.workspaceBody}>This prevents unverified businesses from adding staff or receiving marketplace work.</Text>
              </View>
            </View>

            <View style={styles.workspaceCard}>
              <View style={styles.workspaceIcon}><ShieldCheck size={24} color={colors.ink} weight="fill" /></View>
              <View style={styles.workspaceCopy}>
                <Text style={styles.workspaceTitle}>Company review</Text>
                <Text style={styles.workspaceBody}>Your company profile starts as Pending. MaintainEX can then review business details before marketplace activation.</Text>
              </View>
            </View>
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
                {categories.flatMap(category => category.jobs).filter(job => selectedIds.has(job.id)).map(job => job.name).join(', ')}
              </Text>
            </View>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Company status</Text>
              <Text style={styles.reviewValue}>Pending verification · Team access after approval</Text>
            </View>
          </View>
        )
      default:
        return null
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => step > 0 ? setStep(step - 1) : router.back()} style={styles.backButton}>
          <CaretLeft size={24} color={colors.ink} weight="bold" />
        </TouchableOpacity>

        <Text style={styles.title}>{t('auth.onboarding.setupTitle')}</Text>

        {renderStepIndicator()}
        {renderStep()}

        <View style={styles.navRow}>
          {step > 0 && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(step - 1)}>
              <CaretLeft size={18} color={colors.ink} weight="bold" />
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
              <CaretRight size={18} color={colors.white} weight="bold" />
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
                  <CheckCircle size={18} color={colors.white} weight="bold" />
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
  serviceCountCard: { height: 58, borderRadius: 16, paddingHorizontal: 15, marginBottom: 14, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center' },
  serviceCount: { fontSize: 22, fontFamily: fonts.headingBold, color: colors.white },
  serviceCountLabel: { marginLeft: 8, fontSize: 10, fontFamily: fonts.bodyMedium, color: '#D0D0D0' },
  categoryCard: { borderRadius: 17, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, marginBottom: 10, overflow: 'hidden' },
  categoryHeader: { minHeight: 64, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center' },
  categoryIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#F2F2F2', alignItems: 'center', justifyContent: 'center' },
  categoryCopy: { flex: 1, marginLeft: 10 },
  categoryName: { fontSize: 13, fontFamily: fonts.headingBold, color: colors.ink },
  categoryMeta: { marginTop: 3, fontSize: 9.5, fontFamily: fonts.body, color: colors.muted },
  jobList: { borderTopWidth: 1, borderTopColor: colors.border },
  jobRow: { minHeight: 56, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  jobCheck: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  jobCheckSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  jobName: { flex: 1, marginLeft: 10, paddingRight: 8, fontSize: 11, fontFamily: fonts.bodyMedium, color: colors.ink },
  companyOnly: { fontSize: 7.5, letterSpacing: 0.5, fontFamily: fonts.headingBold, color: colors.amberDark },
  workspaceCard: { minHeight: 96, padding: 14, borderRadius: 17, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start' },
  workspaceIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F2F2F2', alignItems: 'center', justifyContent: 'center' },
  workspaceCopy: { flex: 1, marginLeft: 11 },
  workspaceTitle: { fontSize: 12, fontFamily: fonts.headingBold, color: colors.ink },
  workspaceBody: { marginTop: 4, fontSize: 9.5, lineHeight: 14, fontFamily: fonts.body, color: colors.muted },
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
