import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { CaretDown, CaretUp, CheckCircle, User, Wrench } from 'phosphor-react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'

import { useAuth } from '../../lib/auth'
import { jobCategories as jobCategoriesApi } from '../../lib/api'
import type { JobCategory, TemplateJob } from '../../lib/types'
import { v3 } from '../../theme/v3/tokens'
import AuthShell from '../../components/v3/AuthShell'
import V3NavBar from '../../components/v3/V3NavBar'
import V3Input from '../../components/v3/V3Input'
import V3OTPInput from '../../components/v3/V3OTPInput'
import V3Button from '../../components/v3/V3Button'
import V3RoleCard from '../../components/v3/V3RoleCard'
import V3InfoBanner from '../../components/v3/V3InfoBanner'
import CountryPicker, { COUNTRIES, Country } from '../../components/ui/CountryPicker'

const MAX_INITIAL_SERVICES = 15

export default function RegisterScreen() {
  const router = useRouter()
  const { role: paramRole } = useLocalSearchParams<{ role?: string }>()
  const { register, verifyRegisterOtp } = useAuth()

  const [step, setStep] = useState(paramRole ? 2 : 1)
  const [role, setRole] = useState<'CUSTOMER' | 'TASKER' | 'COMPANY' | ''>(
    paramRole === 'TASKER'
      ? 'TASKER'
      : paramRole === 'COMPANY'
        ? 'COMPANY'
        : paramRole === 'CUSTOMER'
          ? 'CUSTOMER'
          : ''
  )
  const [country, setCountry] = useState<Country>(COUNTRIES[0])
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [experienceSummary, setExperienceSummary] = useState('')
  const [catalog, setCatalog] = useState<JobCategory[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [otpCode, setOtpCode] = useState('')

  const phoneDigits = phone.replace(/\D/g, '')
  const localDigits = phoneDigits.replace(/^0+/, '')
  const fullPhone = `${country.dial}${localDigits}`
  const validDob = /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) && !Number.isNaN(new Date(`${dateOfBirth}T00:00:00Z`).getTime())
  const expYears = Number(experienceYears)
  const validExperience = Number.isInteger(expYears) && expYears >= 0 && expYears <= 60 && experienceSummary.trim().length >= 10

  const selectedJobs = useMemo(() => {
    const rows: TemplateJob[] = []
    for (const category of catalog) {
      for (const job of category.jobs || []) {
        if (selectedServices.has(job.id)) rows.push(job)
      }
    }
    return rows
  }, [catalog, selectedServices])

  useEffect(() => {
    if (role !== 'TASKER') return
    let active = true
    setCatalogLoading(true)
    jobCategoriesApi.list(country.code)
      .then((rows) => {
        if (!active) return
        const available = rows
          .map(category => ({
            ...category,
            jobs: (category.jobs || []).filter(job => !job.isCompanyOnly),
          }))
          .filter(category => (category.jobs || []).length > 0)
        setCatalog(available)
        setExpandedCategory(current => current || available[0]?.id || null)
      })
      .catch(() => {
        if (active) Alert.alert('Unable to load services', 'Please check your connection and try again.')
      })
      .finally(() => {
        if (active) setCatalogLoading(false)
      })
    return () => { active = false }
  }, [country.code, role])

  const goBack = () => {
    if (step === 1) return router.back()
    if (step === 2) {
      if (paramRole) return router.back()
      setStep(1)
      return
    }
    if (step === 6) {
      setStep(role === 'TASKER' ? 5 : 2)
      setOtpCode('')
      setOtpError('')
      return
    }
    setStep(step - 1)
  }

  const sendRegistrationOtp = async () => {
    setLoading(true)
    try {
      const payload = role === 'TASKER'
        ? {
            role: 'TASKER' as const,
            phone: fullPhone,
            countryCode: country.code,
            name: name.trim(),
            email: email.trim() || undefined,
            dateOfBirth,
            address: address.trim(),
            experienceYears: expYears,
            experienceSummary: experienceSummary.trim(),
            serviceJobIds: Array.from(selectedServices),
          }
        : role === 'COMPANY'
          ? {
              role: 'COMPANY' as const,
              phone: fullPhone,
              countryCode: country.code,
              name: name.trim(),
              email: email.trim() || undefined,
            }
          : {
              role: 'CUSTOMER' as const,
              phone: fullPhone,
              countryCode: country.code,
            }

      const res = await register(payload)
      if (!res?.requiresVerification) throw new Error('Verification code was not requested')
      setOtpCode('')
      setOtpError('')
      setStep(6)
    } catch (err: any) {
      let message = err?.message || 'Registration failed'
      try { message = JSON.parse(message).error || message } catch {}
      Alert.alert('Unable to continue', message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (candidate = otpCode) => {
    if (candidate.length !== 6) return
    setVerifying(true)
    setOtpError('')
    try {
      const user = await verifyRegisterOtp(fullPhone, candidate, 'PHONE_VERIFICATION')
      if (user?.role === 'TASKER') {
        const identity = String(user.identityStatus || 'NOT_SUBMITTED').toUpperCase()
        const identityReady = identity === 'VERIFIED' || identity === 'APPROVED'
        if (user.needsOnboarding || user.taskerOnboardingStage === 'SERVICES') {
          router.replace('/(auth)/onboarding/tasker-services')
        } else if (identityReady || user.taskerOnboardingStage === 'READY') {
          router.replace('/(tasker)/(tabs)/profile' as any)
        } else if (user.taskerOnboardingStage === 'PENDING_APPROVAL') {
          router.replace('/(auth)/pending-approval')
        } else {
          router.replace({ pathname: '/(tasker)/identity', params: { onboarding: '1' } } as any)
        }
      } else if (user?.role === 'COMPANY') {
        if (user.needsOnboarding) router.replace('/(auth)/onboarding/company-setup')
        else router.replace('/(company)')
      } else {
        router.replace('/(customer)')
      }
    } catch (err: any) {
      let message = err?.message || 'Invalid code'
      try { message = JSON.parse(message).error || message } catch {}
      setOtpError(message)
      setOtpCode('')
    } finally {
      setVerifying(false)
    }
  }

  const toggleService = (jobId: string) => {
    setSelectedServices(current => {
      const next = new Set(current)
      if (next.has(jobId)) {
        next.delete(jobId)
        return next
      }
      if (next.size >= MAX_INITIAL_SERVICES) {
        Alert.alert('Service limit', `Choose up to ${MAX_INITIAL_SERVICES} services during registration. You can manage them later from your Tasker profile.`)
        return current
      }
      next.add(jobId)
      return next
    })
  }

  const personalReady =
    name.trim().length >= 2 &&
    phoneDigits.length >= 7 &&
    validDob &&
    address.trim().length >= 5

  return (
    <AuthShell bg={v3.colors.canvas}>
      {step === 1 ? (
        <View style={styles.roleStep}>
          <Text style={styles.brand}>MΛINTΛINEX</Text>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Customers start quickly. Taskers complete verification before receiving work.</Text>

          <View style={styles.roles}>
            <V3RoleCard
              icon={<User size={18} color={v3.colors.amberDark} weight="fill" />}
              iconBg={v3.colors.amberSoft}
              title="I need services"
              subtitle="Register with your mobile number. Complete your profile later."
              badge="Customer"
              badgeColor={v3.colors.amberDark}
              badgeBg={v3.colors.amberSoft}
              selected={role === 'CUSTOMER'}
              onPress={() => setRole('CUSTOMER')}
            />
            <V3RoleCard
              icon={<Wrench size={18} color={v3.colors.info} weight="fill" />}
              iconBg={v3.colors.infoSoft}
              title="I want to earn"
              subtitle="Choose whether you work as an individual professional or as a company."
              badge="Provider"
              badgeColor={v3.colors.info}
              badgeBg={v3.colors.infoSoft}
              selected={false}
              onPress={() => router.push('/(auth)/provider-type')}
            />
          </View>

          <V3Button label="Continue" onPress={() => setStep(2)} disabled={!role} />
        </View>
      ) : step === 2 ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <V3NavBar title={role === 'TASKER' ? 'Personal details' : role === 'COMPANY' ? 'Company owner' : 'Create account'} onBack={goBack} />
          <View style={styles.content}>
            {role === 'CUSTOMER' ? (
              <>
                <Text style={styles.title}>Your mobile number</Text>
                <Text style={styles.subtitle}>That is all we need to create your customer account. You can add your name, address and other details later.</Text>
                <Text style={styles.fieldLabel}>Mobile number</Text>
                <View style={styles.phoneRow}>
                  <CountryPicker selected={country} onChange={setCountry} />
                  <V3Input containerStyle={styles.phoneInputContainer} placeholder="77 123 4567" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                </View>
                <View style={{ height: 18 }} />
                <V3InfoBanner title="Password-free sign in" subtitle="We will send a 6-digit OTP to this mobile number." />
                <View style={{ height: 28 }} />
                <V3Button label="Send OTP" onPress={sendRegistrationOtp} loading={loading} disabled={phoneDigits.length < 7} />
              </>
            ) : role === 'COMPANY' ? (
              <>
                <Text style={styles.title}>Create the owner account</Text>
                <Text style={styles.subtitle}>Use the mobile number of the person responsible for this company. Company details and services come next.</Text>
                <V3Input label="Owner's full name" placeholder="Full legal name" value={name} onChangeText={setName} autoCapitalize="words" />
                <View style={styles.spacer} />
                <Text style={styles.fieldLabel}>Mobile number</Text>
                <View style={styles.phoneRow}>
                  <CountryPicker selected={country} onChange={setCountry} />
                  <V3Input containerStyle={styles.phoneInputContainer} placeholder="77 123 4567" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                </View>
                <View style={styles.spacer} />
                <V3Input label="Business email (optional)" placeholder="hello@company.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                <View style={{ height: 18 }} />
                <V3InfoBanner title="One owner, one company workspace" subtitle="After OTP verification you will create the company profile, choose services and set up your team." />
                <View style={{ height: 26 }} />
                <V3Button label="Send OTP" onPress={sendRegistrationOtp} loading={loading} disabled={name.trim().length < 2 || phoneDigits.length < 7} />
              </>
            ) : (
              <>
                <Text style={styles.title}>Tell us who you are</Text>
                <Text style={styles.subtitle}>These details are required before a Tasker account can be created.</Text>
                <V3Input label="Full legal name" placeholder="Name exactly as on your ID" value={name} onChangeText={setName} autoCapitalize="words" />
                <View style={styles.spacer} />
                <V3Input label="Date of birth" placeholder="YYYY-MM-DD" value={dateOfBirth} onChangeText={setDateOfBirth} />
                <Text style={styles.hint}>Use the date shown on your identity document.</Text>
                <View style={styles.spacer} />
                <Text style={styles.fieldLabel}>Mobile number</Text>
                <View style={styles.phoneRow}>
                  <CountryPicker selected={country} onChange={setCountry} />
                  <V3Input containerStyle={styles.phoneInputContainer} placeholder="77 123 4567" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                </View>
                <View style={styles.spacer} />
                <V3Input label="Full address" placeholder="Street, area, city" value={address} onChangeText={setAddress} autoCapitalize="words" />
                <View style={styles.spacer} />
                <V3Input label="Email (optional)" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                <View style={{ height: 26 }} />
                <V3Button label="Continue to work experience" onPress={() => setStep(3)} disabled={!personalReady} />
              </>
            )}
          </View>
        </ScrollView>
      ) : step === 3 ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <V3NavBar title="Work experience" onBack={goBack} />
          <View style={styles.content}>
            <Text style={styles.title}>Your work experience</Text>
            <Text style={styles.subtitle}>Tell customers what experience you already have. You can add certificates and portfolio evidence later.</Text>
            <V3Input label="Years of experience" placeholder="e.g. 4" value={experienceYears} onChangeText={setExperienceYears} keyboardType="numeric" />
            <View style={styles.spacer} />
            <Text style={styles.fieldLabel}>Experience summary</Text>
            <TextInput
              style={styles.multiline}
              value={experienceSummary}
              onChangeText={setExperienceSummary}
              placeholder="Example: I have worked on residential plumbing repairs, tap replacements and bathroom installations."
              placeholderTextColor={v3.colors.textPlaceholder}
              multiline
              textAlignVertical="top"
              maxLength={700}
            />
            <Text style={styles.counter}>{experienceSummary.length}/700</Text>
            <View style={{ height: 24 }} />
            <V3Button label="Choose the services you provide" onPress={() => setStep(4)} disabled={!validExperience} />
          </View>
        </ScrollView>
      ) : step === 4 ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <V3NavBar title="Your services" onBack={goBack} />
          <View style={styles.content}>
            <Text style={styles.title}>What can you actually do?</Text>
            <Text style={styles.subtitle}>Choose exact services, not just broad categories. You will only be matched to work that fits these capabilities.</Text>
            <View style={styles.selectionSummary}>
              <Text style={styles.selectionCount}>{selectedServices.size}/{MAX_INITIAL_SERVICES} selected</Text>
              <Text style={styles.selectionHint}>You can change this later from Tasker Profile → Your Services.</Text>
            </View>

            {catalogLoading ? (
              <ActivityIndicator color={v3.colors.ink} style={{ marginTop: 36 }} />
            ) : (
              catalog.map(category => {
                const open = expandedCategory === category.id
                const selectedInCategory = (category.jobs || []).filter(job => selectedServices.has(job.id)).length
                return (
                  <View key={category.id} style={styles.categoryCard}>
                    <TouchableOpacity
                      style={styles.categoryHeader}
                      onPress={() => setExpandedCategory(open ? null : category.id)}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.categoryName}>{category.name}</Text>
                        <Text style={styles.categoryMeta}>{selectedInCategory} selected · {(category.jobs || []).length} services</Text>
                      </View>
                      {open ? <CaretUp size={18} color={v3.colors.ink} /> : <CaretDown size={18} color={v3.colors.ink} />}
                    </TouchableOpacity>

                    {open ? (
                      <View style={styles.jobList}>
                        {(category.jobs || []).map(job => {
                          const selected = selectedServices.has(job.id)
                          return (
                            <TouchableOpacity key={job.id} style={styles.jobRow} onPress={() => toggleService(job.id)} activeOpacity={0.72}>
                              <View style={[styles.check, selected && styles.checkSelected]}>
                                {selected ? <CheckCircle size={19} color={v3.colors.ink} weight="fill" /> : null}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.jobName}>{job.name}</Text>
                                {job.description ? <Text style={styles.jobDescription} numberOfLines={2}>{job.description}</Text> : null}
                              </View>
                            </TouchableOpacity>
                          )
                        })}
                      </View>
                    ) : null}
                  </View>
                )
              })
            )}

            <View style={{ height: 22 }} />
            <V3Button label="Review registration" onPress={() => setStep(5)} disabled={selectedServices.size === 0 || catalogLoading} />
          </View>
        </ScrollView>
      ) : step === 5 ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <V3NavBar title="Review" onBack={goBack} />
          <View style={styles.content}>
            <Text style={styles.title}>Check your details</Text>
            <Text style={styles.subtitle}>After OTP verification, you must upload an ID before MaintainEX can activate your Tasker account.</Text>

            <ReviewRow label="Full name" value={name} />
            <ReviewRow label="Mobile" value={fullPhone} />
            <ReviewRow label="Date of birth" value={dateOfBirth} />
            <ReviewRow label="Address" value={address} />
            <ReviewRow label="Experience" value={`${experienceYears} year${expYears === 1 ? '' : 's'}`} />

            <Text style={styles.reviewSectionLabel}>SELECTED SERVICES</Text>
            <View style={styles.reviewServices}>
              {selectedJobs.map(job => <Text key={job.id} style={styles.reviewService}>• {job.name}</Text>)}
            </View>

            <View style={{ height: 18 }} />
            <V3InfoBanner title="Identity verification is mandatory" subtitle="Your Tasker account cannot receive jobs or submit quotes until your identity is approved." />
            <View style={{ height: 24 }} />
            <V3Button label="Send OTP & create Tasker account" onPress={sendRegistrationOtp} loading={loading} />
          </View>
        </ScrollView>
      ) : (
        <View style={styles.otpStep}>
          <V3NavBar title="Verify your number" onBack={goBack} />
          <View style={styles.otpContent}>
            <Text style={styles.title}>Enter your SMS code</Text>
            <Text style={styles.subtitle}>We sent a 6-digit verification code to {maskPhone(fullPhone)}.</Text>
            <Text style={styles.enterCode}>Enter code</Text>
            <View style={styles.otpWrap}>
              <V3OTPInput
                size="compact"
                autoSubmit={false}
                onChangeCode={setOtpCode}
                onComplete={handleVerifyOtp}
                error={otpError}
                loading={verifying}
              />
            </View>
            <TouchableOpacity onPress={goBack}><Text style={styles.changeNumber}>Wrong number? Change it</Text></TouchableOpacity>
            <TouchableOpacity onPress={sendRegistrationOtp} disabled={loading || verifying} activeOpacity={0.72}>
              <Text style={styles.resendCode}>{loading ? 'Sending…' : 'Resend SMS code'}</Text>
            </TouchableOpacity>
            {otpError ? <Text style={styles.otpError}>{otpError}</Text> : null}
            <View style={styles.otpBottom}>
              <V3Button label={role === 'TASKER' ? 'Verify & continue to ID' : 'Verify & create account'} onPress={() => handleVerifyOtp()} loading={verifying} disabled={otpCode.length !== 6} />
            </View>
          </View>
        </View>
      )}
    </AuthShell>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  )
}

function maskPhone(num: string) {
  const digits = num.replace(/\D/g, '')
  if (digits.length < 6) return num
  return `+${digits.slice(0, Math.max(2, digits.length - 7))} ${digits.slice(-7, -4)}•••${digits.slice(-4)}`
}

const styles = StyleSheet.create({
  roleStep: { flex: 1, padding: 18 },
  brand: { fontSize: 13, fontFamily: 'Outfit_900Black', color: v3.colors.ink, letterSpacing: 0.8, marginBottom: 32 },
  title: { fontSize: 26, lineHeight: 31, fontFamily: 'Outfit_900Black', color: v3.colors.ink, marginBottom: 6 },
  subtitle: { fontSize: 11, lineHeight: 17, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary, marginBottom: 22 },
  roles: { flex: 1, gap: 12, marginBottom: 16 },
  scroll: { flexGrow: 1, paddingBottom: 28 },
  content: { paddingHorizontal: 18, paddingTop: 10 },
  spacer: { height: 14 },
  fieldLabel: { fontSize: 10, fontFamily: 'Outfit_700Bold', color: '#4F4F4F', marginBottom: 6 },
  hint: { marginTop: 5, marginLeft: 2, fontSize: 9, fontFamily: 'Outfit_500Medium', color: v3.colors.textMuted },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phoneInputContainer: { flex: 1 },
  multiline: {
    minHeight: 132,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: v3.colors.line,
    backgroundColor: v3.colors.paper,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Outfit_500Medium',
    color: v3.colors.ink,
  },
  counter: { marginTop: 5, textAlign: 'right', fontSize: 9, fontFamily: 'Outfit_500Medium', color: v3.colors.textMuted },
  selectionSummary: { padding: 14, borderRadius: 15, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, marginBottom: 14 },
  selectionCount: { fontSize: 13, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  selectionHint: { marginTop: 3, fontSize: 9.5, lineHeight: 14, fontFamily: 'Outfit_500Medium', color: v3.colors.textSecondary },
  categoryCard: { marginBottom: 10, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, overflow: 'hidden' },
  categoryHeader: { minHeight: 62, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  categoryName: { fontSize: 13, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  categoryMeta: { marginTop: 3, fontSize: 9.5, fontFamily: 'Outfit_500Medium', color: v3.colors.textMuted },
  jobList: { borderTopWidth: 1, borderTopColor: v3.colors.line },
  jobRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: v3.colors.line },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  checkSelected: { borderColor: v3.colors.ink },
  jobName: { fontSize: 11.5, fontFamily: 'Outfit_700Bold', color: v3.colors.ink },
  jobDescription: { marginTop: 2, fontSize: 9, lineHeight: 13, fontFamily: 'Outfit_500Medium', color: v3.colors.textSecondary },
  reviewRow: { minHeight: 58, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: v3.colors.line },
  reviewLabel: { fontSize: 9, fontFamily: 'Outfit_700Bold', color: v3.colors.textMuted, letterSpacing: 0.4 },
  reviewValue: { marginTop: 4, fontSize: 12, lineHeight: 17, fontFamily: 'Outfit_700Bold', color: v3.colors.ink },
  reviewSectionLabel: { marginTop: 24, marginBottom: 8, fontSize: 9, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.textMuted, letterSpacing: 0.6 },
  reviewServices: { borderRadius: 15, borderWidth: 1, borderColor: v3.colors.line, backgroundColor: v3.colors.paper, padding: 14, gap: 7 },
  reviewService: { fontSize: 10.5, lineHeight: 15, fontFamily: 'Outfit_600SemiBold', color: v3.colors.ink },
  otpStep: { flex: 1 },
  otpContent: { flex: 1, paddingHorizontal: 24, paddingTop: 10 },
  enterCode: { marginTop: 46, textAlign: 'center', fontSize: 11, fontFamily: 'Outfit_700Bold', color: v3.colors.textSecondary },
  otpWrap: { alignItems: 'center', marginTop: 18 },
  changeNumber: { marginTop: 24, textAlign: 'center', fontSize: 10, fontFamily: 'Outfit_700Bold', color: v3.colors.textSecondary },
  resendCode: { marginTop: 12, textAlign: 'center', fontSize: 10, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  otpError: { marginTop: 8, textAlign: 'center', fontSize: 9.5, fontFamily: 'Outfit_600SemiBold', color: v3.colors.error },
  otpBottom: { flex: 1, justifyContent: 'flex-end', paddingBottom: 16 },
})
