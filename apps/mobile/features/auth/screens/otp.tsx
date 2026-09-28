import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useAuth } from '@/features/auth/context/auth'
import { auth } from '@/api/auth'
import { useColors } from '@/lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { fonts } from '@/lib/fonts'
import { fontSizes } from '@/lib/tokens'
import { spacing, borderRadius } from '@/lib/tokens'

// TODO: replace with SMS OTP once provider is configured
export default function OtpScreen() {
  const colors = useColors()
    const styles = makeStyles(colors)
  const router = useRouter()
  const { email, phone, role } = useLocalSearchParams<{ email?: string; phone?: string; role?: string }>()
  const { t } = useTranslation()
  const { register } = useAuth()

  const target = phone || email || ''
  const resendDisabled = !target

  const [codes, setCodes] = useState<string[]>(Array(6).fill(''))
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(true)
  const [resendTimer, setResendTimer] = useState(60)
  const inputRefs = useRef<(TextInput | null)[]>([])

  useEffect(() => {
    if (target) sendOtp()
  }, [target])

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
    if (!target) return
    setSending(true)
    try {
      if (email) {
        await auth.sendOtp({ email })
      }
    } catch (err: any) {
      Alert.alert(t('common.error'), t('errors.failedToSendCode'))
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
      Alert.alert(t('common.error'), t('errors.enterCompleteCode'))
      return
    }

    setLoading(true)
    try {
      if (email) {
        await auth.verifyOtp({ email, code })
      } else if (code === '000000') {
      }

      const userRole = role || 'CUSTOMER'
      if (userRole === 'TASKER') router.replace('/(auth)/onboarding/tasker-services')
      else if (userRole === 'COMPANY') router.replace('/(auth)/onboarding/company-setup')
      else router.replace('/(customer)')
    } catch (err: any) {
      Alert.alert(t('auth.otp.verificationFailed'), t('errors.invalidCode'))
    } finally {
      setLoading(false)
    }
  }

  const allFilled = codes.every((c) => c !== '')

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={[styles.backText, { color: colors.primary }]}>{'\u2190'} {t('common.back')}</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: colors.ink }]}>{t('auth.otp.title')}</Text>
      <Text style={[styles.subtitle, { color: colors.inkLight }]}>
        {t('auth.otp.description')}{target}
      </Text>

      <Text style={[styles.inputLabel, { color: colors.inkLight }]}>{t('auth.otp.inputLabel')}</Text>

      <View style={styles.codeRow}>
        {codes.map((digit, i) => (
          <TextInput
            key={i}
            ref={(ref) => { inputRefs.current[i] = ref }}
            style={[
              styles.codeBox,
              {
                borderColor: digit ? colors.primary : colors.border,
                backgroundColor: digit ? colors.primaryLight : colors.surface,
                color: colors.ink,
              },
            ]}
            value={digit}
            onChangeText={(t) => handleCodeChange(t, i)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
            keyboardType="number-pad"
            maxLength={1}
            selectionColor={colors.primary}
          />
        ))}
      </View>

      <TouchableOpacity
        onPress={handleResend}
        disabled={resendTimer > 0 || sending || resendDisabled}
        style={styles.resendButton}
      >
        <Text style={[styles.resendText, { color: colors.primary }, (resendTimer > 0 || sending || resendDisabled) && { color: colors.muted }]}>
          {sending ? t('auth.otp.sending') : resendTimer > 0 ? `${t('auth.otp.resendIn')}${resendTimer}s` : t('auth.otp.resend')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.verifyButton,
          { backgroundColor: colors.primary },
          (!allFilled || loading) && { opacity: 0.6 },
        ]}
        onPress={handleVerify}
        disabled={!allFilled || loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.verifyText}>{t('auth.otp.button')}</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xxxl,
    paddingTop: 60,
  },
  backButton: { marginBottom: spacing.xxxl },
  backText: { fontSize: fontSizes.body, fontFamily: fonts.label },
  title: { fontSize: fontSizes.h1, fontFamily: fonts.headingBold, marginBottom: spacing.sm },
  subtitle: { fontSize: fontSizes.bodySmall, fontFamily: fonts.body, marginBottom: spacing.sm, lineHeight: 24 },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xxxl,
  },
  inputLabel: {
    fontSize: fontSizes.bodySmall,
    fontFamily: fonts.body,
    marginBottom: spacing.sm,
  },
  codeBox: {
    width: 48,
    height: 56,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: fontSizes.h2,
    fontFamily: fonts.headingBold,
  },
  resendButton: { alignItems: 'center', marginBottom: spacing.xxxxl },
  resendText: { fontSize: fontSizes.bodySmall, fontFamily: fonts.label },
  verifyButton: {
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  verifyText: { fontSize: fontSizes.h3, fontFamily: fonts.button, color: '#FFFFFF' },
})
