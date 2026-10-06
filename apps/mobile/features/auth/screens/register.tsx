import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { CheckCircle, MagnifyingGlass, User, Wrench } from 'phosphor-react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'

import { useAuth } from '@/features/auth/context/auth'
import { jobCategories as jobCategoriesApi } from '@/api/jobs'
import type { JobCategory, TemplateJob } from '@/lib/types'
import { v3 } from '@/theme/v3/tokens'
import AuthShell from '@/components/v3/AuthShell'
import V3NavBar from '@/components/v3/V3NavBar'
import V3Input from '@/components/v3/V3Input'
import V3OTPInput from '@/components/v3/V3OTPInput'
import V3Button from '@/components/v3/V3Button'
import V3RoleCard from '@/components/v3/V3RoleCard'
import V3InfoBanner from '@/components/v3/V3InfoBanner'
import CountryPicker, { COUNTRIES, Country } from '@/components/ui/CountryPicker'

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
  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [catalog, setCatalog] = useState<JobCategory[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [serviceQuery, setServiceQuery] = useState('')
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [otpCode, setOtpCode] = useState('')

  const phoneDigits = phone.replace(/\D/g, '')
  const localDigits = phoneDigits.replace(/^0+/, '')
  const fullPhone = `${country.dial}${localDigits}`

  const allJobs = useMemo(
    () => catalog.flatMap(category => category.jobs || []),
    [catalog]
  )

  const selectedJobs = useMemo(
    () => allJobs.filter(job => selectedServices.has(job.id)),
    [allJobs, selectedServices]
  )

  const visibleJobs = useMemo(() => {
    const query = serviceQuery.trim().toLowerCase()
    if (query) {
      return allJobs.filter(job =>
        job.name.toLowerCase().includes(query) ||
        String(job.description || '').toLowerCase().includes(query)
      )
    }

    const active = catalog.find(category => category.id === activeCategoryId)
    return active?.jobs || []
  }, [activeCategoryId, allJobs, catalog, serviceQuery])

  useEffect(() => {
    if (role !== 'TASKER') return

    let active = true
    setCatalogLoading(true)
    jobCategoriesApi.list(country.code)
      .then(rows => {
        if (!active) return
        const available = rows
          .map(category => ({
            ...category,
            jobs: (category.jobs || []).filter(job => !job.isCompanyOnly),
          }))
          .filter(category => (category.jobs || []).length > 0)

        setCatalog(available)
        setActiveCategoryId(current =>
          current && available.some(category => category.id === current)
            ? current
            : available[0]?.id || null
        )
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
    if (step === 1) {
      router.back()
      return
    }

    if (step === 2) {
      if (paramRole) router.back()
      else setStep(1)
      return
    }

    if (step === 3) {
      setStep(2)
      return
    }

    if (step === 4) {
      setOtpCode('')
      setOtpError('')
      setStep(role === 'TASKER' ? 3 : 2)
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
        Alert.alert('Service limit', `Choose up to ${MAX_INITIAL_SERVICES} services. You can change them later from Tasker Profile.`)
        return current
      }

      next.add(jobId)
      return next
    })
  }

  const sendRegistrationOtp = async () => {
    if (name.trim().length < 2 || phoneDigits.length < 7) {
      Alert.alert('Check your details', 'Enter your full name and a valid mobile number.')
      return
    }

    if (role === 'TASKER' && selectedServices.size === 0) {
      Alert.alert('Choose a service', 'Select at least one service you can provide.')
      return
    }

    if (role === 'COMPANY' && companyName.trim().length < 2) {
      Alert.alert('Company name required', 'Enter the company name you want customers to see.')
      return
    }

    setLoading(true)
    try {
      const payload = role === 'TASKER'
        ? {
            role: 'TASKER' as const,
            phone: fullPhone,
            countryCode: country.code,
            name: name.trim(),
            serviceJobIds: Array.from(selectedServices),
          }
        : role === 'COMPANY'
          ? {
              role: 'COMPANY' as const,
              phone: fullPhone,
              countryCode: country.code,
              name: name.trim(),
              companyName: companyName.trim(),
            }
          : {
              role: 'CUSTOMER' as const,
              phone: fullPhone,
              countryCode: country.code,
              name: name.trim(),
            }

      const res = await register(payload)
      if (!res?.requiresVerification) throw new Error('Verification code was not requested')

      setOtpCode('')
      setOtpError('')
      setStep(4)
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
      if (user?.role === 'TASKER') router.replace('/(auth)/onboarding/tasker-services' as any)
      else if (user?.role === 'COMPANY') router.replace('/(auth)/onboarding/company-setup' as any)
      else router.replace('/(customer)' as any)
    } catch (err: any) {
      let message = err?.message || 'Invalid code'
      try { message = JSON.parse(message).error || message } catch {}
      setOtpError(message)
      setOtpCode('')
    } finally {
      setVerifying(false)
    }
  }

  const basicReady = name.trim().length >= 2 && phoneDigits.length >= 7
  const companyReady = basicReady && companyName.trim().length >= 2

  return (
    <AuthShell bg={v3.colors.canvas}>
      {step === 1 ? (
        <View style={styles.roleStep}>
          <Text style={styles.brand}>MΛINTΛINEX</Text>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Start with the essentials. You can complete the rest of your profile after you enter the app.</Text>

          <View style={styles.roles}>
            <V3RoleCard
              icon={<User size={18} color={v3.colors.amberDark} weight="fill" />}
              iconBg={v3.colors.amberSoft}
              title="I need services"
              subtitle="Create a Customer account with your name and mobile number."
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
              subtitle="Join as an individual professional or register your company."
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
          <V3NavBar
            title={role === 'TASKER' ? 'Create Tasker account' : role === 'COMPANY' ? 'Create company account' : 'Create customer account'}
            onBack={goBack}
          />

          <View style={styles.content}>
            <Text style={styles.title}>
              {role === 'TASKER' ? 'Start earning with MaintainEX' : role === 'COMPANY' ? 'Create your company workspace' : 'Tell us your name'}
            </Text>
            <Text style={styles.subtitle}>
              {role === 'TASKER'
                ? 'We only need your name, mobile number and the services you provide. Complete identity, experience and payout details later from Tasker Profile.'
                : role === 'COMPANY'
                  ? 'Create the owner login and company workspace now. Complete business documents, team and service areas later.'
                  : 'Your name and mobile number are enough to start booking services.'}
            </Text>

            <V3Input
              label={role === 'COMPANY' ? "Owner's full name" : 'Full name'}
              placeholder="Enter your full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            {role === 'COMPANY' ? (
              <>
                <View style={styles.spacer} />
                <V3Input
                  label="Company name"
                  placeholder="Business or company name"
                  value={companyName}
                  onChangeText={setCompanyName}
                  autoCapitalize="words"
                />
              </>
            ) : null}

            <View style={styles.spacer} />
            <Text style={styles.fieldLabel}>Mobile number</Text>
            <View style={styles.phoneRow}>
              <CountryPicker selected={country} onChange={setCountry} />
              <V3Input
                containerStyle={styles.phoneInputContainer}
                placeholder={country.code === 'LK' ? '77 123 4567' : '202 555 0102'}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={{ height: 18 }} />
            <V3InfoBanner
              title="Password-free sign in"
              subtitle="We will verify this mobile number with a 6-digit OTP. Profile details can be completed after login."
            />

            <View style={{ height: 28 }} />
            {role === 'TASKER' ? (
              <V3Button
                label="Choose services"
                onPress={() => setStep(3)}
                disabled={!basicReady}
              />
            ) : (
              <V3Button
                label="Send OTP"
                onPress={sendRegistrationOtp}
                loading={loading}
                disabled={role === 'COMPANY' ? !companyReady : !basicReady}
              />
            )}
          </View>
        </ScrollView>
      ) : step === 3 ? (
        <View style={styles.servicesScreen}>
          <V3NavBar title="Choose your services" onBack={goBack} />

          <ScrollView contentContainerStyle={styles.servicesContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>What jobs can you do?</Text>
            <Text style={styles.subtitle}>Choose only the exact services you are comfortable doing. Pricing and experience can be added later.</Text>

            <View style={styles.selectionSummary}>
              <Text style={styles.selectionCount}>{selectedServices.size}/{MAX_INITIAL_SERVICES} selected</Text>
              <Text style={styles.selectionHint}>
                {selectedJobs.length
                  ? selectedJobs.slice(0, 3).map(job => job.name).join(' · ') + (selectedJobs.length > 3 ? ` +${selectedJobs.length - 3} more` : '')
                  : 'Select at least one service to continue.'}
              </Text>
            </View>

            <View style={styles.searchBox}>
              <MagnifyingGlass size={17} color={v3.colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={serviceQuery}
                onChangeText={setServiceQuery}
                placeholder="Search services"
                placeholderTextColor={v3.colors.textPlaceholder}
              />
            </View>

            {catalogLoading ? (
              <ActivityIndicator color={v3.colors.ink} style={{ marginTop: 42 }} />
            ) : (
              <>
                {!serviceQuery.trim() ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryTabs}
                  >
                    {catalog.map(category => {
                      const active = activeCategoryId === category.id
                      const picked = (category.jobs || []).filter(job => selectedServices.has(job.id)).length
                      return (
                        <TouchableOpacity
                          key={category.id}
                          style={[styles.categoryTab, active && styles.categoryTabActive]}
                          onPress={() => setActiveCategoryId(category.id)}
                          activeOpacity={0.78}
                        >
                          <Text style={[styles.categoryTabText, active && styles.categoryTabTextActive]}>{category.name}</Text>
                          {picked > 0 ? (
                            <View style={[styles.categoryCount, active && styles.categoryCountActive]}>
                              <Text style={[styles.categoryCountText, active && styles.categoryCountTextActive]}>{picked}</Text>
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      )
                    })}
                  </ScrollView>
                ) : null}

                <View style={styles.jobList}>
                  {visibleJobs.map((job: TemplateJob) => {
                    const selected = selectedServices.has(job.id)
                    return (
                      <TouchableOpacity
                        key={job.id}
                        style={[styles.jobRow, selected && styles.jobRowSelected]}
                        onPress={() => toggleService(job.id)}
                        activeOpacity={0.76}
                      >
                        <View style={[styles.check, selected && styles.checkSelected]}>
                          {selected ? <CheckCircle size={20} color={v3.colors.paper} weight="fill" /> : null}
                        </View>
                        <View style={styles.jobCopy}>
                          <Text style={styles.jobName}>{job.name}</Text>
                          {job.description ? (
                            <Text style={styles.jobDescription} numberOfLines={2}>{job.description}</Text>
                          ) : null}
                        </View>
                        <Text style={[styles.addLabel, selected && styles.addLabelSelected]}>{selected ? 'Selected' : 'Add'}</Text>
                      </TouchableOpacity>
                    )
                  })}

                  {visibleJobs.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyTitle}>No matching services</Text>
                      <Text style={styles.emptyText}>Try another search or choose a different category.</Text>
                    </View>
                  ) : null}
                </View>
              </>
            )}

            <View style={{ height: 24 }} />
            <V3Button
              label={selectedServices.size ? `Continue with ${selectedServices.size} service${selectedServices.size === 1 ? '' : 's'}` : 'Select at least one service'}
              onPress={sendRegistrationOtp}
              loading={loading}
              disabled={selectedServices.size === 0 || catalogLoading}
            />
          </ScrollView>
        </View>
      ) : (
        <View style={styles.otpStep}>
          <V3NavBar title="Verify your number" onBack={goBack} />
          <View style={styles.otpContent}>
            <Text style={styles.title}>Enter your OTP</Text>
            <Text style={styles.subtitle}>Enter the 6-digit code for {maskPhone(fullPhone)}.</Text>
            <Text style={styles.enterCode}>Verification code</Text>

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

            <TouchableOpacity onPress={goBack}>
              <Text style={styles.changeNumber}>Wrong number? Change it</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={sendRegistrationOtp} disabled={loading || verifying} activeOpacity={0.72}>
              <Text style={styles.resendCode}>{loading ? 'Sending…' : 'Send a new code'}</Text>
            </TouchableOpacity>

            {otpError ? <Text style={styles.otpError}>{otpError}</Text> : null}

            <View style={styles.otpBottom}>
              <V3Button
                label="Verify & enter MaintainEX"
                onPress={() => handleVerifyOtp()}
                loading={verifying}
                disabled={otpCode.length !== 6}
              />
            </View>
          </View>
        </View>
      )}
    </AuthShell>
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
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phoneInputContainer: { flex: 1 },
  servicesScreen: { flex: 1 },
  servicesContent: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 34 },
  selectionSummary: { padding: 14, borderRadius: 16, backgroundColor: v3.colors.ink, marginBottom: 14 },
  selectionCount: { fontSize: 14, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.paper },
  selectionHint: { marginTop: 5, fontSize: 9.5, lineHeight: 14, fontFamily: 'Outfit_500Medium', color: '#D1D1D1' },
  searchBox: { height: 52, borderRadius: 15, borderWidth: 1, borderColor: v3.colors.line, backgroundColor: v3.colors.paper, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, fontSize: 11.5, fontFamily: 'Outfit_600SemiBold', color: v3.colors.ink, paddingVertical: 0 },
  categoryTabs: { paddingTop: 14, paddingBottom: 12, gap: 8, paddingRight: 16 },
  categoryTab: { minHeight: 40, borderRadius: 20, borderWidth: 1, borderColor: v3.colors.line, backgroundColor: v3.colors.paper, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7 },
  categoryTabActive: { backgroundColor: v3.colors.ink, borderColor: v3.colors.ink },
  categoryTabText: { fontSize: 10, fontFamily: 'Outfit_700Bold', color: v3.colors.ink },
  categoryTabTextActive: { color: v3.colors.paper },
  categoryCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  categoryCountActive: { backgroundColor: v3.colors.paper },
  categoryCountText: { fontSize: 8, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.paper },
  categoryCountTextActive: { color: v3.colors.ink },
  jobList: { gap: 9 },
  jobRow: { minHeight: 70, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: v3.colors.line, backgroundColor: v3.colors.paper, flexDirection: 'row', alignItems: 'center' },
  jobRowSelected: { borderColor: v3.colors.ink, borderWidth: 1.5 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  checkSelected: { borderColor: v3.colors.ink, backgroundColor: v3.colors.ink },
  jobCopy: { flex: 1, marginLeft: 11, paddingRight: 8 },
  jobName: { fontSize: 11.5, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  jobDescription: { marginTop: 3, fontSize: 9, lineHeight: 13, fontFamily: 'Outfit_500Medium', color: v3.colors.textSecondary },
  addLabel: { fontSize: 9, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.textMuted },
  addLabelSelected: { color: v3.colors.ink },
  emptyCard: { padding: 22, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center' },
  emptyTitle: { fontSize: 12, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  emptyText: { marginTop: 4, fontSize: 9.5, fontFamily: 'Outfit_500Medium', color: v3.colors.textMuted, textAlign: 'center' },
  otpStep: { flex: 1 },
  otpContent: { flex: 1, paddingHorizontal: 24, paddingTop: 10 },
  enterCode: { marginTop: 46, textAlign: 'center', fontSize: 11, fontFamily: 'Outfit_700Bold', color: v3.colors.textSecondary },
  otpWrap: { alignItems: 'center', marginTop: 18 },
  changeNumber: { marginTop: 24, textAlign: 'center', fontSize: 10, fontFamily: 'Outfit_700Bold', color: v3.colors.textSecondary },
  resendCode: { marginTop: 12, textAlign: 'center', fontSize: 10, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  otpError: { marginTop: 8, textAlign: 'center', fontSize: 9.5, fontFamily: 'Outfit_600SemiBold', color: v3.colors.error },
  otpBottom: { flex: 1, justifyContent: 'flex-end', paddingBottom: 16 },
})
