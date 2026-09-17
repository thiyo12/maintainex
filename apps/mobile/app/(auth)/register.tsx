import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { User, Wrench } from 'phosphor-react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'

import { useAuth } from '../../lib/auth'
import { v3 } from '../../theme/v3/tokens'
import AuthShell from '../../components/v3/AuthShell'
import V3NavBar from '../../components/v3/V3NavBar'
import V3Input from '../../components/v3/V3Input'
import V3OTPInput from '../../components/v3/V3OTPInput'
import V3Button from '../../components/v3/V3Button'
import V3RoleCard from '../../components/v3/V3RoleCard'
import V3InfoBanner from '../../components/v3/V3InfoBanner'
import CountryPicker, { COUNTRIES, Country } from '../../components/ui/CountryPicker'

export default function RegisterScreen() {
  const router = useRouter()
  const { role: paramRole } = useLocalSearchParams<{ role?: string }>()
  const { register, verifyRegisterOtp } = useAuth()

  const [step, setStep] = useState(paramRole ? 2 : 1)
  const [role, setRole] = useState<'CUSTOMER' | 'TASKER' | ''>(
    paramRole === 'TASKER' ? 'TASKER' : paramRole === 'CUSTOMER' ? 'CUSTOMER' : ''
  )
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState<Country>(COUNTRIES[0])
  const [loading, setLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [otpCode, setOtpCode] = useState('')

  const fullPhone = `${country.dial}${phone.replace(/\D/g, '')}`
  const phoneDigits = phone.replace(/\D/g, '')
  const canDetails = name.trim().length >= 2 && phoneDigits.length >= 7

  const goBack = () => {
    if (step === 2 && !paramRole) setStep(1)
    else if (step === 3) {
      setStep(2)
      setOtpError('')
      setOtpCode('')
    } else router.back()
  }

  const handleSendCode = async () => {
    if (!canDetails || !role) return
    setLoading(true)
    try {
      const res = await register({
        name: name.trim(),
        phone: fullPhone,
        email: email.trim() || undefined,
        role,
      })
      if (res.requiresVerification) {
        setStep(3)
        setOtpError('')
        setOtpCode('')
      } else if (res?.token && res?.user) {
        if (res.user.role === 'TASKER') router.replace('/(auth)/onboarding/tasker-services')
        else router.replace('/(customer)')
      } else {
        setStep(3)
      }
    } catch (err: any) {
      let message = err?.message || 'Registration failed'
      try { message = JSON.parse(message).error || message } catch {}
      Alert.alert('Unable to create account', message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (code = otpCode) => {
    if (code.length !== 6) return
    setVerifying(true)
    setOtpError('')
    try {
      const user = await verifyRegisterOtp(fullPhone, code, 'PHONE_VERIFICATION')
      if (user?.role === 'TASKER') router.replace('/(auth)/onboarding/tasker-services')
      else if (user?.role === 'COMPANY') router.replace('/(auth)/onboarding/company-setup')
      else router.replace('/(customer)')
    } catch (err: any) {
      let message = err?.message || 'Invalid code'
      try { message = JSON.parse(message).error || message } catch {}
      setOtpError(message)
    } finally {
      setVerifying(false)
    }
  }

  return (
    <AuthShell bg={v3.colors.canvas}>
      {step === 1 ? (
        <View style={styles.step1}>
          <Text style={styles.brand}>MΛINTΛINEX</Text>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Choose how you will use MaintainEX.</Text>

          <View style={styles.roles}>
            <V3RoleCard
              icon={<User size={18} color={v3.colors.amberDark} weight="fill" />}
              iconBg={v3.colors.amberSoft}
              title="I need services"
              subtitle="Post jobs and book trusted professionals."
              badge="Customer"
              badgeColor={v3.colors.amberDark}
              badgeBg={v3.colors.amberSoft}
              selected={role === 'CUSTOMER'}
              onPress={() => setRole('CUSTOMER')}
            />
            <V3RoleCard
              icon={<Wrench size={18} color={v3.colors.info} weight="fill" />}
              iconBg={v3.colors.infoSoft}
              title="I offer services"
              subtitle="Earn with your skills as a tasker."
              badge="Tasker"
              badgeColor={v3.colors.info}
              badgeBg={v3.colors.infoSoft}
              selected={role === 'TASKER'}
              onPress={() => setRole('TASKER')}
            />
          </View>

          <V3Button label="Continue" onPress={() => setStep(2)} disabled={!role} />
        </View>
      ) : step === 2 ? (
        <ScrollView contentContainerStyle={styles.step2} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <V3NavBar title="Your details" onBack={goBack} />
          <View style={styles.step2Content}>
            <Text style={styles.detailsTitle}>Your details</Text>
            <Text style={styles.detailsSubtitle}>We only ask for what is needed.</Text>

            <V3Input label="Full name" placeholder="Kamal Perera" value={name} onChangeText={setName} />
            <View style={styles.spacer} />

            <Text style={styles.fieldLabel}>Mobile number</Text>
            <View style={styles.phoneRow}>
              <CountryPicker selected={country} onChange={setCountry} />
              <V3Input
                containerStyle={styles.phoneInputContainer}
                placeholder="77 123 4567"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.spacer} />
            <View style={styles.emailLabelRow}>
              <Text style={styles.fieldLabel}>Email</Text>
              {role === 'CUSTOMER' ? <Text style={styles.optionalHint}>optional for customers</Text> : null}
            </View>
            <V3Input placeholder="kamal@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

            <View style={{ height: 18 }} />
            <V3InfoBanner title="Your account starts with verification" subtitle="Phone verification helps taskers trust requests." />
          </View>

          <View style={styles.step2Bottom}>
            <V3Button label="Send verification code" onPress={handleSendCode} loading={loading} disabled={!canDetails || !role} />
          </View>
        </ScrollView>
      ) : (
        <View style={styles.step3}>
          <V3NavBar title="Verify your number" onBack={goBack} />
          <View style={styles.step3Content}>
            <Text style={styles.verifyTitle}>Verify your number</Text>
            <Text style={styles.verifySubtitle}>We sent a 6-digit code to {maskPhone(fullPhone)}</Text>

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

            <TouchableOpacity onPress={goBack}><Text style={styles.resend}>Wrong number? Change it</Text></TouchableOpacity>
            {otpError ? <Text style={styles.otpError}>{otpError}</Text> : null}

            <View style={styles.verifyBottom}>
              <V3Button label="Verify & create account" onPress={() => handleVerifyOtp()} loading={verifying} disabled={otpCode.length !== 6} />
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
  step1: { flex: 1, padding: 18 },
  brand: { fontSize: 13, fontFamily: 'Outfit_900Black', color: v3.colors.ink, letterSpacing: 0.8, marginBottom: 32 },
  title: { fontSize: 27, fontFamily: 'Outfit_900Black', color: v3.colors.ink, marginBottom: 6 },
  subtitle: { fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary, marginBottom: 20 },
  roles: { flex: 1, gap: 12, marginBottom: 16 },

  step2: { flexGrow: 1 },
  step2Content: { paddingHorizontal: 18, paddingTop: 8 },
  detailsTitle: { fontSize: 24, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  detailsSubtitle: { marginTop: 3, marginBottom: 22, fontSize: 10.5, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  spacer: { height: 14 },
  fieldLabel: { fontSize: 10, fontFamily: 'Outfit_700Bold', color: '#4F4F4F', marginBottom: 6 },
  emailLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  optionalHint: { fontSize: 9, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textMuted, marginBottom: 6 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phoneInputContainer: { flex: 1 },
  step2Bottom: { paddingHorizontal: 18, paddingTop: 24, paddingBottom: 24 },

  step3: { flex: 1 },
  step3Content: { flex: 1, paddingHorizontal: 24, paddingTop: 10 },
  verifyTitle: { fontSize: 24, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  verifySubtitle: { marginTop: 3, fontSize: 10.5, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  enterCode: { marginTop: 52, textAlign: 'center', fontSize: 11, fontFamily: 'Outfit_700Bold', color: v3.colors.textSecondary },
  otpWrap: { alignItems: 'center', marginTop: 18 },
  resend: { marginTop: 24, textAlign: 'center', fontSize: 10, fontFamily: 'Outfit_700Bold', color: v3.colors.textSecondary },
  otpError: { marginTop: 8, textAlign: 'center', fontSize: 9.5, fontFamily: 'Outfit_600SemiBold', color: v3.colors.error },
  verifyBottom: { flex: 1, justifyContent: 'flex-end', paddingBottom: 16 },
})
