import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Lock, Eye, EyeSlash } from 'phosphor-react-native'
import { auth } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useColors } from '../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { fonts } from '../../lib/fonts'
import { fontSizes } from '../../lib/tokens'
import { spacing, borderRadius } from '../../lib/tokens'

export default function ResetPasswordScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { email } = useLocalSearchParams<{ email: string }>()
  const { t } = useTranslation()

  const [code, setCode] = useState<string[]>(Array(6).fill(''))
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(60)
  const inputRefs = useRef<(TextInput | null)[]>([])

  useEffect(() => {
    if (resendTimer <= 0) return
    const interval = setInterval(() => setResendTimer((t) => t - 1), 1000)
    return () => clearInterval(interval)
  }, [resendTimer])

  const handleResend = async () => {
    setResendTimer(60)
    try {
      await auth.forgotPassword({ email: email || '' })
    } catch {}
  }

  const handleCodeChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1)
    const newCodes = [...code]
    newCodes[index] = digit
    setCode(newCodes)
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleReset = async () => {
    const codeStr = code.join('')
    if (codeStr.length < 6) {
      Alert.alert(t('common.error'), t('errors.enterCompleteCode'))
      return
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert(t('common.error'), t('errors.passwordMinLength'))
      return
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('errors.passwordsDoNotMatch'))
      return
    }

    setLoading(true)
    try {
      await auth.resetPassword({ email: email || '', code: codeStr, newPassword })
      Alert.alert(t('auth.resetPassword.success'), t('auth.resetPassword.successMessage'), [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ])
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('errors.invalidCode'))
    } finally {
      setLoading(false)
    }
  }

  const allFilled = code.every((c) => c !== '')

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={[styles.backText, { color: colors.primary }]}>{'\u2190'} {t('common.back')}</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: colors.ink }]}>{t('auth.resetPassword.title')}</Text>
      <Text style={[styles.subtitle, { color: colors.inkLight }]}>
        {t('auth.resetPassword.description')} {email}
      </Text>

      <View style={styles.codeRow}>
        {code.map((digit, i) => (
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

      <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0} style={styles.resendButton}>
        <Text style={[styles.resendText, { color: colors.primary }, resendTimer > 0 && { color: colors.muted }]}>
          {resendTimer > 0 ? `${t('auth.otp.resendIn')}${resendTimer}s` : t('auth.otp.resend')}
        </Text>
      </TouchableOpacity>

      <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Lock size={18} color={colors.muted} weight="regular" style={styles.inputIcon} />
        <TextInput
          style={[styles.input, { color: colors.ink }]}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder={t('auth.register.passwordPlaceholder')}
          secureTextEntry={!showPw}
          placeholderTextColor={colors.muted}
        />
        <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
          {showPw ? <EyeSlash size={18} color={colors.muted} /> : <Eye size={18} color={colors.muted} />}
        </TouchableOpacity>
      </View>

      <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Lock size={18} color={colors.muted} weight="regular" style={styles.inputIcon} />
        <TextInput
          style={[styles.input, { color: colors.ink }]}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder={t('auth.register.confirmPasswordPlaceholder')}
          secureTextEntry={!showPw}
          placeholderTextColor={colors.muted}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }, (!allFilled || !newPassword || !confirmPassword || loading) && { opacity: 0.5 }]}
        onPress={handleReset}
        disabled={!allFilled || !newPassword || !confirmPassword || loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>{t('auth.resetPassword.button')}</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, padding: spacing.xxxl, paddingTop: 60 },
  backButton: { marginBottom: spacing.xxxl },
  backText: { fontSize: fontSizes.body, fontFamily: fonts.label },
  title: { fontSize: fontSizes.h1, fontFamily: fonts.headingBold, marginBottom: spacing.sm },
  subtitle: { fontSize: fontSizes.bodySmall, fontFamily: fonts.body, marginBottom: spacing.sm, lineHeight: 24 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.lg },
  codeBox: { width: 48, height: 56, borderRadius: borderRadius.md, borderWidth: 1.5, textAlign: 'center', fontSize: fontSizes.h2, fontFamily: fonts.headingBold },
  resendButton: { alignItems: 'center', marginBottom: spacing.xxxxl },
  resendText: { fontSize: fontSizes.bodySmall, fontFamily: fonts.label },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.md, borderWidth: 1.5, marginBottom: 12 },
  inputIcon: { paddingLeft: 16 },
  input: { flex: 1, padding: 15, fontSize: fontSizes.body, fontFamily: fonts.body },
  eyeBtn: { paddingRight: 16 },
  button: { paddingVertical: spacing.lg, borderRadius: borderRadius.lg, alignItems: 'center', marginTop: spacing.md },
  buttonText: { fontSize: fontSizes.h3, fontFamily: fonts.button, color: '#FFFFFF' },
})
