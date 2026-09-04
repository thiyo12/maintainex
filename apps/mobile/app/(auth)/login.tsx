import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { EnvelopeSimple, ShieldCheck, ArrowRight, CaretLeft, Phone } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../lib/auth'
import { useColors } from '../../lib/ThemeContext'
import { fonts } from '../../lib/fonts'

export default function LoginScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { t } = useTranslation()
  const { sendLoginOtp, otpLogin } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [codes, setCodes] = useState<string[]>(Array(6).fill(''))
  const [codeSent, setCodeSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const inputRefs = useRef<(TextInput | null)[]>([])

  const isEmail = identifier.includes('@')

  useEffect(() => {
    if (resendTimer <= 0) return
    const interval = setInterval(() => setResendTimer((v) => v - 1), 1000)
    return () => clearInterval(interval)
  }, [resendTimer])

  const redirectByRole = (role: string) => {
    if (role === 'TASKER') router.replace('/(tasker)')
    else if (role === 'COMPANY') router.replace('/(company)')
    else router.replace('/(customer)')
  }

  const getErrorMessage = (err: any) => {
    let message = err?.message || t('common.error')
    try {
      const parsed = JSON.parse(message)
      message = parsed.error || message
    } catch {}
    return message
  }

  const handleSendCode = async () => {
    if (!identifier.trim()) {
      Alert.alert(t('common.error'), t('errors.fillAllFields'))
      return
    }
    setSending(true)
    try {
      await sendLoginOtp(identifier)
      setCodes(Array(6).fill(''))
      setCodeSent(true)
      setResendTimer(60)
    } catch (err: any) {
      Alert.alert(t('common.error'), getErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  const handleResend = () => {
    setResendTimer(60)
    handleSendCode()
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
    setVerifying(true)
    try {
      const user = await otpLogin(identifier, code)
      redirectByRole(user.role)
    } catch (err: any) {
      Alert.alert(t('common.error'), getErrorMessage(err))
    } finally {
      setVerifying(false)
    }
  }

  const allFilled = codes.every((c) => c !== '')

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <CaretLeft size={20} color={colors.ink} weight="bold" />
        </TouchableOpacity>

        <View style={styles.headerSection}>
          <ShieldCheck size={36} color={colors.amber} weight="fill" />
          <Text style={styles.title}>{t('auth.login.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.fieldWrap}>
            {isEmail ? (
              <EnvelopeSimple size={18} color={colors.muted} weight="regular" style={styles.fieldIcon} />
            ) : (
              <Phone size={18} color={colors.muted} weight="regular" style={styles.fieldIcon} />
            )}
            <TextInput
              style={[styles.input, { color: colors.ink, borderColor: colors.border }]}
              value={identifier}
              onChangeText={setIdentifier}
              placeholder={t('auth.login.emailOrPhone')}
              keyboardType={isEmail ? 'email-address' : identifier ? 'phone-pad' : 'default'}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!sending}
              placeholderTextColor={colors.muted}
            />
          </View>

          {codeSent && (
            <View style={styles.codeSection}>
              <Text style={styles.codeHint}>{t('auth.login.codeSentTo')} {identifier}</Text>
              <Text style={styles.codeLabel}>{t('auth.login.enterCode')}</Text>
              <View style={styles.codeRow}>
                {codes.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(ref) => { inputRefs.current[i] = ref }}
                    style={[
                      styles.codeBox,
                      { borderColor: digit ? colors.amber : colors.border, color: colors.ink },
                    ]}
                    value={digit}
                    onChangeText={(text) => handleCodeChange(text, i)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectionColor={colors.amber}
                  />
                ))}
              </View>

              <TouchableOpacity
                onPress={handleResend}
                disabled={resendTimer > 0 || sending}
                style={styles.resendButton}
              >
                <Text style={[styles.resendText, { color: colors.amber }, (resendTimer > 0 || sending) && { color: colors.muted }]}>
                  {sending ? t('auth.login.sending') : resendTimer > 0 ? `${t('auth.login.resendIn')}${resendTimer}s` : t('auth.login.resend')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!codeSent ? (
            <TouchableOpacity
              style={[styles.button, sending && styles.buttonDisabled]}
              onPress={handleSendCode}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <View style={styles.buttonInner}>
                  <Text style={styles.buttonText}>{t('auth.login.sendCode')}</Text>
                  <ArrowRight size={18} color="#111827" weight="bold" />
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, (!allFilled || verifying) && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={!allFilled || verifying}
            >
              {verifying ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <View style={styles.buttonInner}>
                  <Text style={styles.buttonText}>{t('auth.login.verify')}</Text>
                  <ArrowRight size={18} color="#111827" weight="bold" />
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={() => router.push('/(auth)/welcome')} style={styles.footerWrap}>
          <Text style={styles.footerText}>
            {t('auth.login.noAccount')} <Text style={styles.footerLink}>{t('auth.login.signUp')}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 24, paddingTop: 60 },
  backButton: { marginBottom: 24, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  headerSection: { alignItems: 'center', marginBottom: 32, gap: 8 },
  title: { fontSize: 28, fontFamily: fonts.heading, color: colors.ink, textAlign: 'center' },
  subtitle: { fontSize: 15, fontFamily: fonts.body, color: colors.muted, textAlign: 'center', lineHeight: 22 },

  formCard: { borderRadius: 24, padding: 24, borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  fieldWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, marginBottom: 20, shadowColor: colors.amber, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.08, shadowRadius: 8 },
  fieldIcon: { paddingLeft: 16 },
  input: { flex: 1, padding: 16, fontSize: 15, fontFamily: fonts.body },

  codeSection: { marginBottom: 20 },
  codeHint: { fontSize: 13, fontFamily: fonts.body, color: colors.muted, textAlign: 'center', marginBottom: 16 },
  codeLabel: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.ink, marginBottom: 10 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  codeBox: {
    flex: 1, height: 52, borderRadius: 14, borderWidth: 1.5,
    textAlign: 'center', fontSize: 20, fontFamily: fonts.heading, backgroundColor: colors.white,
  },
  resendButton: { alignItems: 'center', paddingVertical: 4 },
  resendText: { fontSize: 13, fontFamily: fonts.bodyMedium },

  button: { backgroundColor: colors.amber, paddingVertical: 16, borderRadius: 100, alignItems: 'center', shadowColor: colors.amber, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  buttonDisabled: { opacity: 0.5 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { fontSize: 17, fontFamily: fonts.bodySemiBold, color: '#111827' },

  footerWrap: { marginTop: 32, alignItems: 'center' },
  footerText: { fontSize: 14, fontFamily: fonts.body, color: colors.muted, textAlign: 'center' },
  footerLink: { fontFamily: fonts.bodyMedium, color: colors.amber },
})