import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { EnvelopeSimple, Lock, ArrowRight, Eye, EyeSlash, CaretLeft } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../lib/auth'
import { useColors } from '../../lib/ThemeContext'
import { fonts } from '../../lib/fonts'

export default function LoginScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { t } = useTranslation()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const redirectByRole = (role: string) => {
    if (role === 'TASKER') router.replace('/(tasker)')
    else if (role === 'COMPANY') router.replace('/(company)')
    else router.replace('/(customer)')
  }

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('errors.fillAllFields'))
      return
    }
    setLoading(true)
    try {
      const user = await login(email, password)
      redirectByRole(user.role)
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('auth.login.title'))
    } finally {
      setLoading(false)
    }
  }

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
          <Lock size={36} color={colors.amber} weight="fill" />
          <Text style={styles.title}>{t('auth.login.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.fieldWrap}>
            <EnvelopeSimple size={18} color={colors.muted} weight="regular" style={styles.fieldIcon} />
            <TextInput
              style={[styles.input, { color: colors.ink, borderColor: colors.border }]}
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={styles.fieldWrap}>
            <Lock size={18} color={colors.muted} weight="regular" style={styles.fieldIcon} />
            <TextInput
              style={[styles.input, { color: colors.ink, borderColor: colors.border }]}
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.login.password')}
              secureTextEntry={!showPw}
              placeholderTextColor={colors.muted}
            />
            <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
              {showPw ? <EyeSlash size={18} color={colors.muted} weight="regular" /> : <Eye size={18} color={colors.muted} weight="regular" />}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.forgotRow} onPress={() => router.push('/(auth)/otp')}>
            <Text style={styles.forgotText}>{t('auth.login.loginWithOtp')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#111827" />
            ) : (
              <View style={styles.buttonInner}>
                <Text style={styles.buttonText}>{t('auth.login.button')}</Text>
                <ArrowRight size={18} color="#111827" weight="bold" />
              </View>
            )}
          </TouchableOpacity>
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
  fieldWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, marginBottom: 14, shadowColor: colors.amber, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.08, shadowRadius: 8 },
  fieldIcon: { paddingLeft: 16 },
  input: { flex: 1, padding: 16, fontSize: 15, fontFamily: fonts.body },
  eyeBtn: { paddingRight: 16 },

  forgotRow: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotText: { color: colors.amber, fontSize: 13, fontFamily: fonts.bodyMedium },

  button: { backgroundColor: colors.amber, paddingVertical: 16, borderRadius: 100, alignItems: 'center', shadowColor: colors.amber, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  buttonDisabled: { opacity: 0.5 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { fontSize: 17, fontFamily: fonts.bodySemiBold, color: '#111827' },

  footerWrap: { marginTop: 32, alignItems: 'center' },
  footerText: { fontSize: 14, fontFamily: fonts.body, color: colors.muted, textAlign: 'center' },
  footerLink: { fontFamily: fonts.bodyMedium, color: colors.amber },
})
