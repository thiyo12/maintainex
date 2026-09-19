import { useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'

import { auth } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { v3 } from '../../theme/v3/tokens'
import V3NavBar from '../../components/v3/V3NavBar'
import V3OTPInput from '../../components/v3/V3OTPInput'
import V3Button from '../../components/v3/V3Button'

export default function OtpScreen() {
  const router = useRouter()
  const { phone, email, maskedPhone, purpose } = useLocalSearchParams<{
    phone?: string
    email?: string
    maskedPhone?: string
    purpose?: 'login' | 'reset'
  }>()
  const { otpLogin, sendLoginOtp } = useAuth()

  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendTimer, setResendTimer] = useState(60)
  const [otpError, setOtpError] = useState('')

  const isReset = purpose === 'reset'
  const target = isReset ? email : phone

  useEffect(() => {
    if (resendTimer <= 0) return
    const interval = setInterval(() => setResendTimer(v => v - 1), 1000)
    return () => clearInterval(interval)
  }, [resendTimer])

  const handleVerify = async (candidate = code) => {
    if (candidate.length !== 6) return
    if (!target) {
      setOtpError('Verification destination is missing. Go back and request a new code.')
      return
    }

    if (isReset) {
      router.push({ pathname: '/(auth)/reset-password', params: { email: target, code: candidate } } as any)
      return
    }

    if (!phone) return
    setVerifying(true)
    setOtpError('')
    try {
      const user = await otpLogin(phone, candidate)
      if (user.role === 'TASKER') {
        const identity = (user.identityStatus || 'NOT_SUBMITTED').toUpperCase()
        const identityReady = identity === 'VERIFIED' || identity === 'APPROVED'
        if (user.needsOnboarding || user.taskerOnboardingStage === 'SERVICES') {
          router.replace('/(auth)/onboarding/tasker-services')
        } else if (user.taskerOnboardingStage === 'IDENTITY' || (!identityReady && (identity === 'NOT_SUBMITTED' || identity === 'REJECTED'))) {
          router.replace({ pathname: '/(tasker)/identity', params: { onboarding: '1' } } as any)
        } else if (user.taskerOnboardingStage === 'PENDING_APPROVAL' || !identityReady) {
          router.replace('/(auth)/pending-approval')
        } else {
          router.replace('/(tasker)')
        }
      } else if (user.role === 'COMPANY') {
        if (user.needsOnboarding) router.replace('/(auth)/onboarding/company-setup')
        else router.replace('/(company)')
      } else router.replace('/(customer)')
    } catch (err: any) {
      let message = err?.message || 'Invalid code'
      try { message = JSON.parse(message).error || message } catch {}
      setOtpError(message)
      setCode('')
    } finally {
      setVerifying(false)
    }
  }

  const handleResend = async () => {
    if (!target || resendTimer > 0 || resending) return
    setResending(true)
    setOtpError('')
    setCode('')
    try {
      if (isReset) await auth.forgotPassword({ email: target })
      else if (phone) await sendLoginOtp(phone)
      setResendTimer(60)
    } catch (err: any) {
      let message = err?.message || 'Could not resend the code.'
      try { message = JSON.parse(message).error || message } catch {}
      Alert.alert('Unable to resend', message)
    } finally {
      setResending(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <V3NavBar title="Verify number" onBack={() => router.back()} />
      <View style={styles.content}>
        <Text style={styles.heading}>Enter the code</Text>
        <Text style={styles.subtitle}>Sent to {maskedPhone || target || 'your account'}</Text>

        <View style={styles.otpWrap}>
          <V3OTPInput
            size="standard"
            autoSubmit={false}
            onChangeCode={setCode}
            onComplete={handleVerify}
            error={otpError}
            loading={verifying}
          />
        </View>

        <V3Button label="Verify" onPress={() => handleVerify()} loading={verifying} disabled={code.length !== 6} />

        <View style={styles.resendRow}>
          {resendTimer > 0 ? (
            <Text style={styles.resendDisabled}>Resend code in 00:{resendTimer.toString().padStart(2, '0')}</Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={resending}>
              <Text style={styles.resendActive}>{resending ? 'Resending…' : 'Resend code'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  heading: { fontSize: 28, fontFamily: 'Outfit_900Black', color: v3.colors.ink, marginBottom: 8 },
  subtitle: { fontSize: 12, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary, marginBottom: 32 },
  otpWrap: { alignItems: 'center', marginBottom: 28 },
  resendRow: { alignItems: 'center', marginTop: 22 },
  resendDisabled: { fontSize: 11, fontFamily: 'Outfit_700Bold', color: v3.colors.textSecondary },
  resendActive: { fontSize: 11, fontFamily: 'Outfit_700Bold', color: v3.colors.ink },
})
