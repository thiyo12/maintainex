import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
  Animated, Image,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { CaretLeft, User, Wrench, ArrowRight } from 'phosphor-react-native'
import { useAuth } from '../../lib/auth'
import CountryPicker, { COUNTRIES, Country } from '../../components/ui/CountryPicker'
import OtpInput from '../../components/ui/OtpInput'
import PressableScale from '../../components/ui/PressableScale'

const STEPS = [1, 2, 3]

const CUSTOMER_PILLS = ['Cleaning', 'Repairs', 'Home', 'More']
const TASKER_PILLS = ['Handyman', 'Cleaning', 'Repairs', 'More']

export default function RegisterScreen() {
  const router = useRouter()
  const { role: paramRole } = useLocalSearchParams<{ role: string }>()
  const { register, verifyRegisterOtp } = useAuth()

  const [step, setStep] = useState(paramRole ? 2 : 1)
  const [role, setRole] = useState<'CUSTOMER' | 'TASKER' | 'COMPANY'>(paramRole === 'TASKER' ? 'TASKER' : paramRole === 'COMPANY' ? 'COMPANY' : paramRole === 'CUSTOMER' ? 'CUSTOMER' : '')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState<Country>(COUNTRIES[0])
  const [loading, setLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const slideAnim = useRef(new Animated.Value(paramRole ? 1 : 0)).current

  const fullPhone = `${country.dial}${phone.replace(/\D/g, '')}`
  const phoneDigits = phone.replace(/\D/g, '')
  const canStep2 = name.length >= 2 && phoneDigits.length >= 7

  const goNext = () => {
    Animated.timing(slideAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start()
    setStep(2)
  }

  const goBack = () => {
    if (step === 2 && !paramRole) {
      Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start()
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
        role: role || 'CUSTOMER',
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

  const pills = role === 'TASKER' ? TASKER_PILLS : CUSTOMER_PILLS

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <CaretLeft size={20} color="#FFFFFF" weight="bold" />
          </TouchableOpacity>
          {step === 1 && (
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        {step === 1 && (
          <View style={styles.stepContainer}>
            <View style={styles.dotsRow}>
              {STEPS.map((s) => (
                <View key={s} style={[styles.dot, s === 1 && styles.dotActive]} />
              ))}
            </View>

            <View style={styles.logoSection}>
              <View style={styles.logoBox}>
                <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
              </View>
            </View>

            <Text style={styles.title}>How will you use{'\n'}MΛINTΛINEX?</Text>
            <Text style={styles.subtitle}>Choose your role to get started.{'\n'}You can always change this later.</Text>

            <PressableScale
              scaleTo={0.97}
              onPress={() => setRole('CUSTOMER')}
              style={[styles.roleCard, role === 'CUSTOMER' && styles.roleCardActive]}
            >
              <View style={[styles.roleIconCircle, role === 'CUSTOMER' && styles.roleIconActive]}>
                <User size={26} color={role === 'CUSTOMER' ? '#0D0D0D' : '#F5A623'} weight="fill" />
              </View>
              <View style={styles.roleText}>
                <Text style={styles.roleTitle}>I need a service</Text>
                <Text style={styles.roleSub}>Find and book trusted professionals near you.</Text>
                <View style={styles.pillsRow}>
                  {CUSTOMER_PILLS.map((p) => (
                    <View key={p} style={styles.pill}>
                      <Text style={styles.pillText}>{p}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={[styles.radio, role === 'CUSTOMER' && styles.radioActive]}>
                {role === 'CUSTOMER' && <View style={styles.radioInner} />}
              </View>
            </PressableScale>

            <PressableScale
              scaleTo={0.97}
              onPress={() => setRole('TASKER')}
              style={[styles.roleCard, role === 'TASKER' && styles.roleCardActive]}
            >
              <View style={[styles.roleIconCircle, role === 'TASKER' && styles.roleIconActive]}>
                <Wrench size={26} color={role === 'TASKER' ? '#0D0D0D' : '#F5A623'} weight="fill" />
              </View>
              <View style={styles.roleText}>
                <Text style={styles.roleTitle}>I offer services</Text>
                <Text style={styles.roleSub}>Earn money with your skills and experience.</Text>
                <View style={styles.pillsRow}>
                  {TASKER_PILLS.map((p) => (
                    <View key={p} style={styles.pill}>
                      <Text style={styles.pillText}>{p}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={[styles.radio, role === 'TASKER' && styles.radioActive]}>
                {role === 'TASKER' && <View style={styles.radioInner} />}
              </View>
            </PressableScale>

            <PressableScale
              scaleTo={0.97}
              onPress={goNext}
              disabled={!role}
              style={[styles.pillButton, !role && styles.pillButtonDisabled]}
            >
              <View style={styles.pillBtnRow}>
                <Text style={styles.pillBtnText}>Continue</Text>
                <ArrowRight size={20} color="#0D0D0D" weight="bold" />
              </View>
            </PressableScale>
          </View>
        )}

        {step === 2 && (
          <Animated.View style={[styles.stepContainer, { opacity: slideAnim, transform: [{ translateX: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }] }]}>
            <View style={styles.dotsRow}>
              {STEPS.map((s) => (
                <View key={s} style={[styles.dot, s <= 2 && styles.dotActive]} />
              ))}
            </View>

            <Text style={styles.title}>Your details</Text>
            <Text style={styles.subtitle}>We'll use this to create your account</Text>

            <Text style={styles.fieldLabel}>Full name</Text>
            <View style={styles.inputRow}>
              <User size={18} color="#6B6B6B" weight="regular" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Kamal Perera"
                placeholderTextColor="#6B6B6B"
              />
            </View>

            <Text style={styles.fieldLabel}>Mobile number</Text>
            <View style={styles.phoneRow}>
              <CountryPicker selected={country} onChange={setCountry} />
              <TextInput
                style={styles.phoneInput}
                value={phone}
                onChangeText={setPhone}
                placeholder={country.code === 'LK' ? '771 234 567' : '416 234 5678'}
                placeholderTextColor="#6B6B6B"
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>

            {role === 'TASKER' && (
              <>
                <Text style={styles.fieldLabel}>Email (optional)</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.textInput}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="kamal@email.com"
                    placeholderTextColor="#6B6B6B"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </>
            )}

            <PressableScale
              scaleTo={0.97}
              onPress={handleSendCode}
              disabled={!canStep2 || loading}
              style={[styles.pillButton, !canStep2 && styles.pillButtonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="#0D0D0D" />
              ) : (
                <View style={styles.pillBtnRow}>
                  <Text style={styles.pillBtnText}>Send Verification Code</Text>
                  <ArrowRight size={20} color="#0D0D0D" weight="bold" />
                </View>
              )}
            </PressableScale>
          </Animated.View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <View style={styles.dotsRow}>
              {STEPS.map((s) => (
                <View key={s} style={[styles.dot, styles.dotActive]} />
              ))}
            </View>

            <Text style={styles.title}>Verify your number</Text>
            <Text style={styles.subtitle}>Code sent to {fullPhone}</Text>

            <OtpInput
              onComplete={handleVerifyOtp}
              error={otpError}
              loading={verifying}
            />

            <View style={styles.resendRow}>
              <TouchableOpacity onPress={() => setStep(2)}>
                <Text style={styles.wrongNumber}>Wrong number?</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  scrollContent: { padding: 24, paddingTop: 60, flexGrow: 1 },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#1C1C1C',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2E2E2E',
  },
  skipText: { fontSize: 16, fontFamily: 'Outfit_600SemiBold', color: '#FFFFFF' },

  dotsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  dot: { width: 24, height: 4, borderRadius: 2, backgroundColor: '#2E2E2E' },
  dotActive: { backgroundColor: '#F5A623' },

  logoSection: { alignItems: 'center', marginBottom: 24 },
  logoBox: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: 'rgba(245,166,35,0.08)',
    borderWidth: 1.5, borderColor: '#F5A623',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#F5A623', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  logo: { width: 40, height: 40 },

  stepContainer: { flex: 1 },
  title: { fontSize: 30, fontFamily: 'Outfit_800ExtraBold', color: '#FFFFFF', marginBottom: 8, lineHeight: 36 },
  subtitle: { fontSize: 15, fontFamily: 'Outfit_400Regular', color: '#B3B3B3', marginBottom: 28, lineHeight: 22 },

  roleCard: {
    flexDirection: 'row', alignItems: 'flex-start', padding: 16,
    backgroundColor: '#1C1C1C', borderWidth: 1.5, borderColor: '#2E2E2E',
    borderRadius: 20, marginBottom: 12,
  },
  roleCardActive: { borderColor: '#F5A623' },
  roleIconCircle: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(245,166,35,0.12)',
    justifyContent: 'center', alignItems: 'center', marginRight: 14, marginTop: 2,
  },
  roleIconActive: { backgroundColor: '#F5A623' },
  roleText: { flex: 1 },
  roleTitle: { fontSize: 17, fontFamily: 'Outfit_700Bold', color: '#FFFFFF', marginBottom: 3 },
  roleSub: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: '#B3B3B3', marginBottom: 10, lineHeight: 18 },
  pillsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  pillText: { fontSize: 12, fontFamily: 'Outfit_500Medium', color: '#B3B3B3' },

  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#6B6B6B',
    justifyContent: 'center', alignItems: 'center', marginTop: 4,
  },
  radioActive: { borderColor: '#F5A623' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F5A623' },

  fieldLabel: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: '#B3B3B3', marginBottom: 6, marginTop: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 16,
    backgroundColor: '#1C1C1C', borderWidth: 1, borderColor: '#2E2E2E',
    marginBottom: 16, overflow: 'hidden',
  },
  inputIcon: { paddingLeft: 16, marginRight: 8 },
  textInput: { flex: 1, paddingHorizontal: 16, fontSize: 16, fontFamily: 'Outfit_500Medium', color: '#FFFFFF' },

  phoneRow: {
    flexDirection: 'row', height: 56, borderRadius: 16,
    backgroundColor: '#1C1C1C', borderWidth: 1, borderColor: '#2E2E2E',
    overflow: 'hidden', marginBottom: 16,
  },
  phoneInput: {
    flex: 1, paddingHorizontal: 16, fontSize: 16, fontFamily: 'Outfit_500Medium',
    color: '#FFFFFF',
  },

  pillButton: {
    height: 56, borderRadius: 16, backgroundColor: '#F5A623',
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
    shadowColor: '#F5A623', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  pillButtonDisabled: { backgroundColor: '#2E2E2E', shadowOpacity: 0 },
  pillBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pillBtnText: { fontSize: 17, fontFamily: 'Outfit_700Bold', color: '#0D0D0D' },

  resendRow: { alignItems: 'center', marginTop: 16 },
  wrongNumber: { fontSize: 14, fontFamily: 'Outfit_600SemiBold', color: '#F5A623' },
})
