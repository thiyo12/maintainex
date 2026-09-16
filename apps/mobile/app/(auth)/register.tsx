import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Image,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
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

  const fullPhone = `${country.dial}${phone.replace(/\D/g, '')}`
  const phoneDigits = phone.replace(/\D/g, '')
  const canStep2 = name.length >= 2 && phoneDigits.length >= 7

  const goBack = () => {
    if (step === 2 && !paramRole) {
      setStep(1)
    } else if (step === 3) {
      setStep(2)
      setOtpError('')
    } else {
      router.back()
    }
  }

  const handleSendCode = async () => {
    if (!canStep2) return
    setLoading(true)
    try {
      const res = await register({
        name,
        phone: fullPhone,
        email: email || undefined,
        role: role === 'TASKER' ? 'TASKER' : 'CUSTOMER',
      })
      if (res.requiresVerification) {
        setStep(3)
        setOtpError('')
      }
    } catch (err: any) {
      let message = err?.message || 'Registration failed'
      try { message = JSON.parse(message).error || message } catch {}
      Alert.alert('Error', message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (code: string) => {
    setVerifying(true)
    setOtpError('')
    try {
      const user = await verifyRegisterOtp(fullPhone, code, 'PHONE_VERIFICATION')
      if (user?.role === 'TASKER') {
        router.replace('/(auth)/onboarding/tasker-services')
      } else if (user?.role === 'COMPANY') {
        router.replace('/(auth)/onboarding/company-setup')
      } else {
        router.replace('/(customer)')
      }
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
              icon={<Text style={{ fontSize: 18 }}>👤</Text>}
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
              icon={<Text style={{ fontSize: 18 }}>🛠</Text>}
              iconBg={v3.colors.infoSoft}
              title="I offer services"
              subtitle="Earn with your skills as a tasker."
              badge="Tasker"
              badgeColor={v3.colors.info}
              badgeBg={v3.colors.infoSoft}
              selected={role === 'TASKER'}
              onPress={() => setRole('TASKER')}
            />
            <V3RoleCard
              icon={<Text style={{ fontSize: 18 }}>🏢</Text>}
              iconBg={v3.colors.surfaceGray}
              title="I manage a team"
              subtitle="Assign jobs and grow your business."
              badge="Coming soon"
              badgeColor={v3.colors.textMuted}
              badgeBg={v3.colors.surfaceGray}
              disabled
            />
          </View>

          <V3Button
            label="Continue"
            onPress={() => setStep(2)}
            disabled={!role}
          />
        </View>
      ) : step === 2 ? (
        <ScrollView contentContainerStyle={styles.step2} keyboardShouldPersistTaps="handled">
          <V3NavBar title="Your details" onBack={goBack} />

          <View style={styles.step2Content}>
            <Text style={styles.title}>Your details</Text>
            <Text style={styles.subtitle}>We only ask for what is needed.</Text>

            <V3Input
              label="Full name"
              placeholder="Kamal Perera"
              value={name}
              onChangeText={setName}
            />
            <View style={{ height: 14 }} />
            <V3Input
              label="Mobile number"
              placeholder="77 123 4567"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            {role === 'TASKER' && (
              <>
                <View style={{ height: 14 }} />
                <V3Input
                  label="Email"
                  placeholder="kamal@email.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                />
                <Text style={styles.optionalHint}>optional for customers</Text>
              </>
            )}

            <View style={{ height: 16 }} />
            <V3InfoBanner
              title="Your account starts with verification"
              subtitle="Phone verification helps taskers trust requests."
            />
          </View>

          <View style={styles.step2Bottom}>
            <V3Button
              label="Send verification code"
              onPress={handleSendCode}
              loading={loading}
              disabled={!canStep2}
            />
          </View>
        </ScrollView>
      ) : (
        <View style={styles.step3}>
          <V3NavBar title="Verify your number" onBack={goBack} />

          <View style={styles.step3Content}>
            <Text style={styles.title}>Verify your number</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to {fullPhone}
            </Text>

            <View style={styles.otpWrap}>
              <V3OTPInput
                size="compact"
                onComplete={handleVerifyOtp}
                error={otpError}
                loading={verifying}
              />
            </View>

            <TouchableOpacity onPress={goBack}>
              <Text style={styles.wrongNumber}>Wrong number?</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </AuthShell>
  )
}

const styles = StyleSheet.create({
  step1: {
    flex: 1,
    padding: 18,
    gap: 0,
  },
  brand: {
    fontSize: 13,
    fontFamily: 'Outfit_900Black',
    fontWeight: '900',
    color: v3.colors.textPrimary,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  title: {
    fontSize: 27,
    fontFamily: 'Outfit_900Black',
    fontWeight: '900',
    color: v3.colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    fontWeight: '600',
    color: v3.colors.textSecondary,
    marginBottom: 20,
  },
  roles: {
    flex: 1,
    gap: 12,
    marginBottom: 16,
  },
  step2: {
    padding: 0,
    flexGrow: 1,
  },
  step2Content: {
    padding: 18,
    gap: 0,
  },
  step2Bottom: {
    padding: 18,
    paddingBottom: 24,
  },
  optionalHint: {
    fontSize: 9,
    fontFamily: 'Outfit_500Medium',
    fontWeight: '650',
    color: v3.colors.textMuted,
    marginTop: 4,
    marginLeft: 2,
  },
  step3: {
    flex: 1,
  },
  step3Content: {
    padding: 24,
    gap: 0,
  },
  otpWrap: {
    alignItems: 'center',
    marginVertical: 24,
  },
  wrongNumber: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    fontWeight: '700',
    color: v3.colors.textSecondary,
    textAlign: 'center',
  },
})
