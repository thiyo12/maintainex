import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
  Animated, Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { CaretLeft, ArrowRight, EnvelopeSimple } from 'phosphor-react-native'
import { useAuth } from '../../lib/auth'
import CountryPicker, { COUNTRIES, Country } from '../../components/ui/CountryPicker'
import OtpInput from '../../components/ui/OtpInput'
import PressableScale from '../../components/ui/PressableScale'

export default function LoginScreen() {
  const router = useRouter()
  const { sendLoginOtp, otpLogin } = useAuth()
  const [country, setCountry] = useState<Country>(COUNTRIES[0])
  const [phone, setPhone] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [otpError, setOtpError] = useState('')
  const [maskedPhone, setMaskedPhone] = useState('')
  const slideAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (resendTimer <= 0) return
    const interval = setInterval(() => setResendTimer((v) => v - 1), 1000)
    return () => clearInterval(interval)
  }, [resendTimer])

  const fullPhone = `${country.dial}${phone}`

  const maskPhone = (num: string) => {
    const d = num.replace(/\D/g, '')
    if (d.length < 4) return num
    const prefix = d.slice(0, 3)
    const suffix = d.slice(-2)
    const middle = 'X'.repeat(Math.max(0, d.length - 5))
    return `+${prefix} ${middle} ${suffix}`
  }

  const handleSendCode = async () => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 7) {
      Alert.alert('Error', 'Enter a valid phone number')
      return
    }
    setSending(true)
    try {
      await sendLoginOtp(fullPhone)
      setMaskedPhone(maskPhone(fullPhone))
      setCodeSent(true)
      setResendTimer(60)
      setOtpError('')
      Animated.timing(slideAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start()
    } catch (err: any) {
      let message = err?.message || 'Something went wrong'
      try { message = JSON.parse(message).error || message } catch {}
      Alert.alert('Error', message)
    } finally {
      setSending(false)
    }
  }

  const handleResend = () => {
    setResendTimer(60)
    handleSendCode()
  }

  const handleVerify = async (code: string) => {
    setVerifying(true)
    setOtpError('')
    try {
      const user = await otpLogin(fullPhone, code)
      if (user.role === 'TASKER') router.replace('/(tasker)')
      else if (user.role === 'COMPANY') router.replace('/(company)')
      else router.replace('/(customer)')
    } catch (err: any) {
      let message = err?.message || 'Invalid code'
      try { message = JSON.parse(message).error || message } catch {}
      setOtpError(message)
    } finally {
      setVerifying(false)
    }
  }

  const goBack = () => {
    if (codeSent) {
      Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => {
        setCodeSent(false)
        setOtpError('')
      })
    } else {
      router.back()
    }
  }

  const phoneDigits = phone.replace(/\D/g, '')
  const canSend = phoneDigits.length >= 7

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <CaretLeft size={20} color="#FFFFFF" weight="bold" />
        </TouchableOpacity>

        {!codeSent ? (
          <View style={styles.stepContainer}>
            <View style={styles.logoSection}>
              <View style={styles.logoBox}>
                <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
              </View>
            </View>

            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>

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

            <PressableScale
              scaleTo={0.97}
              onPress={handleSendCode}
              disabled={!canSend || sending}
              style={[styles.pillButton, !canSend && styles.pillButtonDisabled]}
            >
              {sending ? (
                <ActivityIndicator color="#0D0D0D" />
              ) : (
                <View style={styles.pillRow}>
                  <Text style={styles.pillText}>Send Code</Text>
                  <ArrowRight size={20} color="#0D0D0D" weight="bold" />
                </View>
              )}
            </PressableScale>

            <Text style={styles.hint}>We'll send a 6-digit verification code</Text>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.emailRow}>
              <EnvelopeSimple size={18} color="#6B6B6B" weight="regular" />
              <Text style={styles.emailText}>Continue with email</Text>
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>New to MΛINTΛINEX? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/welcome')}>
                <Text style={styles.footerLink}>Create account</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Animated.View style={[styles.stepContainer, { opacity: slideAnim, transform: [{ translateX: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }] }]}>
            <Text style={styles.title}>Enter the code</Text>
            <View style={styles.codeInfo}>
              <Text style={styles.subtitle}>Sent to {maskedPhone} </Text>
              <TouchableOpacity onPress={goBack}>
                <Text style={styles.wrongNumber}>Wrong number?</Text>
              </TouchableOpacity>
            </View>

            <OtpInput
              onComplete={handleVerify}
              error={otpError}
              loading={verifying}
            />

            <View style={styles.resendRow}>
              {resendTimer > 0 ? (
                <Text style={styles.resendDisabled}>Resend in {resendTimer}s</Text>
              ) : (
                <TouchableOpacity onPress={handleResend}>
                  <Text style={styles.resendActive}>Resend code</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  scrollContent: { padding: 24, paddingTop: 60, flexGrow: 1 },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#1C1C1C',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2E2E2E',
    marginBottom: 24,
  },

  logoSection: { alignItems: 'center', marginBottom: 28 },
  logoBox: {
    width: 72, height: 72, borderRadius: 18,
    backgroundColor: 'rgba(245,166,35,0.08)',
    borderWidth: 1.5, borderColor: '#F5A623',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#F5A623', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35, shadowRadius: 18, elevation: 8,
  },
  logo: { width: 48, height: 48 },

  stepContainer: { flex: 1 },
  title: { fontSize: 28, fontFamily: 'Outfit_700Bold', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 15, fontFamily: 'Outfit_400Regular', color: '#B3B3B3', marginBottom: 32 },

  phoneRow: {
    flexDirection: 'row', height: 56, borderRadius: 16,
    backgroundColor: '#1C1C1C', borderWidth: 1, borderColor: '#2E2E2E',
    overflow: 'hidden', marginBottom: 24,
  },
  phoneInput: {
    flex: 1, paddingHorizontal: 16, fontSize: 16, fontFamily: 'Outfit_500Medium',
    color: '#FFFFFF',
  },

  pillButton: {
    height: 56, borderRadius: 16, backgroundColor: '#F5A623',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#F5A623', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  pillButtonDisabled: { backgroundColor: '#2E2E2E', shadowOpacity: 0 },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pillText: { fontSize: 17, fontFamily: 'Outfit_700Bold', color: '#0D0D0D' },

  hint: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: '#6B6B6B', textAlign: 'center', marginTop: 12 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 28, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#2E2E2E' },
  dividerText: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: '#6B6B6B' },

  emailRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 16,
    backgroundColor: '#1C1C1C', borderWidth: 1, borderColor: '#2E2E2E',
  },
  emailText: { fontSize: 15, fontFamily: 'Outfit_500Medium', color: '#B3B3B3' },

  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerLabel: { fontSize: 14, fontFamily: 'Outfit_400Regular', color: '#B3B3B3' },
  footerLink: { fontSize: 14, fontFamily: 'Outfit_600SemiBold', color: '#F5A623' },

  codeInfo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 },
  wrongNumber: { fontSize: 14, fontFamily: 'Outfit_600SemiBold', color: '#F5A623' },

  resendRow: { alignItems: 'center', marginTop: 8 },
  resendDisabled: { fontSize: 14, fontFamily: 'Outfit_400Regular', color: '#6B6B6B' },
  resendActive: { fontSize: 14, fontFamily: 'Outfit_600SemiBold', color: '#F5A623' },
})
