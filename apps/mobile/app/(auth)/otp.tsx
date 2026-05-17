import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { auth } from '../../lib/api'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  background: '#F9FAFB',
  white: '#FFFFFF',
  green: '#10B981',
}

export default function OtpScreen() {
  const router = useRouter()
  const { phone, role } = useLocalSearchParams<{ phone: string; role: string }>()
  const { register } = useAuth()

  const [codes, setCodes] = useState<string[]>(Array(6).fill(''))
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(true)
  const [resendTimer, setResendTimer] = useState(60)
  const [devCode, setDevCode] = useState('')
  const inputRefs = useRef<(TextInput | null)[]>([])

  useEffect(() => {
    if (phone) sendOtp()
  }, [phone])

  useEffect(() => {
    if (resendTimer <= 0) return
    const interval = setInterval(() => setResendTimer((t) => t - 1), 1000)
    return () => clearInterval(interval)
  }, [resendTimer])

  const fillCode = (code: string) => {
    const digits = code.split('')
    setCodes(digits)
  }

  const sendOtp = async () => {
    setSending(true)
    try {
      const res = await auth.sendOtp({ phone: phone || '' })
      if (res.devCode) {
        setDevCode(res.devCode)
        fillCode(res.devCode)
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to send verification code')
    } finally {
      setSending(false)
    }
  }

  const handleResend = () => {
    setResendTimer(60)
    sendOtp()
  }

  const handleCodeChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1)
    const newCodes = [...codes]
    newCodes[index] = digit
    setCodes(newCodes)

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !codes[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerify = async () => {
    const code = codes.join('')
    if (code.length < 6) {
      Alert.alert('Error', 'Please enter the complete code')
      return
    }

    setLoading(true)
    try {
      await auth.verifyOtp({ phone: phone || '', code })

      const userRole = role || 'CUSTOMER'
      if (userRole === 'TASKER') router.replace('/(tasker)')
      else router.replace('/(customer)')
    } catch (err: any) {
      Alert.alert('Verification Failed', 'Invalid or expired code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const allFilled = codes.every((c) => c !== '')

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Verify your phone</Text>
      <Text style={styles.subtitle}>
        We sent a 6 digit code to {phone || 'your phone'}
      </Text>

      {devCode ? (
        <Text style={styles.devHint}>Dev code: {devCode} (auto-filled)</Text>
      ) : null}

      <View style={styles.codeRow}>
        {codes.map((digit, i) => (
          <TextInput
            key={i}
            ref={(ref) => { inputRefs.current[i] = ref }}
            style={[styles.codeBox, digit ? styles.codeBoxFilled : null]}
            value={digit}
            onChangeText={(t) => handleCodeChange(t, i)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
            keyboardType="number-pad"
            maxLength={1}
          />
        ))}
      </View>

      <TouchableOpacity
        onPress={handleResend}
        disabled={resendTimer > 0 || sending}
        style={styles.resendButton}
      >
        <Text style={[styles.resendText, (resendTimer > 0 || sending) && styles.resendTextDisabled]}>
          {sending ? 'Sending...' : resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.verifyButton, (!allFilled || loading) && styles.verifyButtonDisabled]}
        onPress={handleVerify}
        disabled={!allFilled || loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.verifyText}>Verify</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 32,
    paddingTop: 60,
  },
  backButton: { marginBottom: 32 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  title: { fontSize: 32, fontWeight: '800', color: colors.dark, marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.gray, marginBottom: 8, lineHeight: 24 },
  devHint: {
    fontSize: 14,
    color: colors.green,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
    backgroundColor: '#ECFDF5',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 32,
  },
  codeBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    backgroundColor: colors.white,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: colors.dark,
  },
  codeBoxFilled: {
    borderColor: colors.primary,
    backgroundColor: '#FFFBEB',
  },
  resendButton: { alignItems: 'center', marginBottom: 40 },
  resendText: { fontSize: 15, color: colors.primary, fontWeight: '500' },
  resendTextDisabled: { color: colors.gray },
  verifyButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  verifyButtonDisabled: { opacity: 0.6 },
  verifyText: { fontSize: 18, fontWeight: '700', color: colors.white },
})
