import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { auth } from '../../lib/api'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  background: '#F9FAFB',
  white: '#FFFFFF',
}

export default function OtpScreen() {
  const router = useRouter()
  const { loginWithOtp } = useAuth()
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [loading, setLoading] = useState(false)

  const handleSendOtp = async () => {
    if (!phone || phone.replace(/\D/g, '').length < 9) {
      Alert.alert('Error', 'Please enter a valid phone number')
      return
    }
    setLoading(true)
    try {
      await auth.requestOtp(phone)
      setStep('otp')
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 4) {
      Alert.alert('Error', 'Please enter the OTP code')
      return
    }
    setLoading(true)
    try {
      await loginWithOtp(phone, otp)
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableOpacity onPress={() => step === 'otp' ? setStep('phone') : router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>
        {step === 'phone' ? 'Login with OTP' : 'Enter OTP'}
      </Text>
      <Text style={styles.subtitle}>
        {step === 'phone'
          ? 'Enter your phone number to receive a code'
          : `Enter the code sent to ${phone}`}
      </Text>

      {step === 'phone' ? (
        <View style={styles.form}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="0712345678"
            keyboardType="phone-pad"
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSendOtp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.dark} />
            ) : (
              <Text style={styles.buttonText}>Send OTP</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>OTP Code</Text>
          <TextInput
            style={[styles.input, styles.otpInput]}
            value={otp}
            onChangeText={setOtp}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerifyOtp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.dark} />
            ) : (
              <Text style={styles.buttonText}>Verify & Login</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSendOtp} style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '500' }}>
              Resend Code
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 32, paddingTop: 60 },
  backButton: { marginBottom: 32 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  title: { fontSize: 32, fontWeight: '800', color: colors.dark, marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.gray, marginBottom: 40 },
  form: { gap: 4 },
  label: { fontSize: 14, fontWeight: '600', color: colors.dark, marginBottom: 6 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.dark,
  },
  otpInput: { fontSize: 24, textAlign: 'center', letterSpacing: 8, fontWeight: '700' },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 18, fontWeight: '700', color: colors.dark },
})
