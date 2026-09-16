import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { v3 } from '../../theme/v3/tokens'
import V3NavBar from '../../components/v3/V3NavBar'
import V3OTPInput from '../../components/v3/V3OTPInput'

export default function OtpScreen() {
  const router = useRouter()
  const { phone, maskedPhone } = useLocalSearchParams<{ phone?: string; maskedPhone?: string }>()
  const { otpLogin } = useAuth()

  const [verifying, setVerifying] = useState(false)
  const [resendTimer, setResendTimer] = useState(60)
  const [otpError, setOtpError] = useState('')

  useEffect(() => {
    if (resendTimer <= 0) return
    const interval = setInterval(() => setResendTimer((v) => v - 1), 1000)
    return () => clearInterval(interval)
  }, [resendTimer])

  const handleVerify = async (code: string) => {
    if (!phone) return
    setVerifying(true)
    setOtpError('')
    try {
      const user = await otpLogin(phone, code)
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

  const handleResend = () => {
    setResendTimer(60)
    setOtpError('')
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <V3NavBar
        title="Verify number"
        onBack={() => router.back()}
      />

      <View style={styles.content}>
        <Text style={styles.heading}>Enter the code</Text>
        <Text style={styles.subtitle}>
          Sent to {maskedPhone || phone || 'your number'}
        </Text>

        <View style={styles.otpWrap}>
          <V3OTPInput
            size="standard"
            onComplete={handleVerify}
            error={otpError}
            loading={verifying}
          />
        </View>

        <View style={styles.resendRow}>
          {resendTimer > 0 ? (
            <Text style={styles.resendDisabled}>Resend code in 00:{resendTimer.toString().padStart(2, '0')}</Text>
          ) : (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendActive}>Resend code</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: v3.colors.canvas,
  },
  content: {
    flex: 1,
    padding: 24,
    gap: 0,
  },
  heading: {
    fontSize: 28,
    fontFamily: 'Outfit_900Black',
    fontWeight: '900',
    color: v3.colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    fontWeight: '600',
    color: v3.colors.textSecondary,
    marginBottom: 32,
  },
  otpWrap: {
    alignItems: 'center',
    marginBottom: 32,
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  resendDisabled: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    fontWeight: '700',
    color: v3.colors.textSecondary,
  },
  resendActive: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    fontWeight: '700',
    color: v3.colors.textPrimary,
  },
})
