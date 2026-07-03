import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { User, Phone, EnvelopeSimple, Lock, Eye, EyeSlash, CaretLeft, CheckCircle, ArrowRight } from 'phosphor-react-native'
import { useAuth } from '../../lib/auth'
import { useColors } from '../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { fonts } from '../../lib/fonts'

export default function RegisterScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { role: paramRole } = useLocalSearchParams<{ role: string }>()
  const { t } = useTranslation()
  const { register, setSignupData } = useAuth()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [loading, setLoading] = useState(false)

  const role = paramRole || 'CUSTOMER'
  const allFilled = name && phone && email && password && confirmPassword && agreeTerms

  const roleLabel = role === 'TASKER' ? t('auth.register.joinAsTasker') : role === 'COMPANY' ? t('auth.register.registerCompany') : t('auth.register.joinAsCustomer')

  const handleNext = async () => {
    if (!name || !phone || !email || !password || !confirmPassword) {
      Alert.alert(t('common.error'), t('errors.fillAllFields'))
      return
    }
    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('errors.passwordsDoNotMatch'))
      return
    }
    if (password.length < 6) {
      Alert.alert(t('common.error'), t('errors.passwordMinLength'))
      return
    }
    if (phone.replace(/\D/g, '').length < 9) {
      Alert.alert(t('common.error'), t('errors.invalidPhone'))
      return
    }
    if (!agreeTerms) {
      Alert.alert(t('common.error'), t('errors.agreeTerms'))
      return
    }

    setLoading(true)
    try {
      await register({ name, email, password, phone, role })
      setSignupData({ name, email, phone, password, role })
      router.push({ pathname: '/(auth)/otp', params: { phone, role } })
    } catch (err: any) {
      let message = err.message || t('errors.generic')
      try {
        const parsed = JSON.parse(message)
        message = parsed.error || message
      } catch {}
      Alert.alert(t('errors.registrationFailed'), message)
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
          <User size={36} color={colors.amber} weight="fill" />
          <Text style={styles.title}>{t('auth.register.createYourAccount')}</Text>
          <Text style={styles.subtitle}>{roleLabel}</Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.fieldWrap}>
            <User size={18} color={colors.muted} weight="regular" style={styles.fieldIcon} />
            <TextInput
              style={[styles.input, { color: colors.ink, borderColor: colors.border }]}
              value={name}
              onChangeText={setName}
              placeholder={t('auth.register.namePlaceholder')}
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={styles.fieldWrap}>
            <Phone size={18} color={colors.muted} weight="regular" style={styles.fieldIcon} />
            <TextInput
              style={[styles.input, { color: colors.ink, borderColor: colors.border }]}
              value={phone}
              onChangeText={setPhone}
              placeholder={t('auth.register.phonePlaceholder')}
              keyboardType="phone-pad"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={styles.fieldWrap}>
            <EnvelopeSimple size={18} color={colors.muted} weight="regular" style={styles.fieldIcon} />
            <TextInput
              style={[styles.input, { color: colors.ink, borderColor: colors.border }]}
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.register.emailPlaceholder')}
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
              placeholder={t('auth.register.passwordPlaceholder')}
              secureTextEntry={!showPw}
              placeholderTextColor={colors.muted}
            />
            <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
              {showPw ? <EyeSlash size={18} color={colors.muted} weight="regular" /> : <Eye size={18} color={colors.muted} weight="regular" />}
            </TouchableOpacity>
          </View>

          <View style={styles.fieldWrap}>
            <Lock size={18} color={colors.muted} weight="regular" style={styles.fieldIcon} />
            <TextInput
              style={[styles.input, { color: colors.ink, borderColor: colors.border }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t('auth.register.confirmPasswordPlaceholder')}
              secureTextEntry={!showConfirmPw}
              placeholderTextColor={colors.muted}
            />
            <TouchableOpacity onPress={() => setShowConfirmPw(!showConfirmPw)} style={styles.eyeBtn}>
              {showConfirmPw ? <EyeSlash size={18} color={colors.muted} weight="regular" /> : <Eye size={18} color={colors.muted} weight="regular" />}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreeTerms(!agreeTerms)}>
            <View style={[styles.checkbox, { borderColor: colors.border }, agreeTerms && { backgroundColor: colors.amber, borderColor: colors.amber }]}>
              {agreeTerms && <CheckCircle size={14} color="#111827" weight="fill" />}
            </View>
            <Text style={[styles.checkboxLabel, { color: colors.muted }]}>
              {t('auth.register.agreeTerms')}
              <Text style={styles.termsLink}>{t('auth.register.termsOfService')}</Text>
              {t('auth.register.and')}
              <Text style={styles.termsLink}>{t('auth.register.privacyPolicy')}</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, (!allFilled || loading) && styles.buttonDisabled]}
            onPress={handleNext}
            disabled={!allFilled || loading}
          >
            {loading ? (
              <ActivityIndicator color="#111827" />
            ) : (
              <View style={styles.buttonInner}>
                <Text style={styles.buttonText}>{t('auth.register.next')}</Text>
                <ArrowRight size={18} color="#111827" weight="bold" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 24, paddingTop: 60 },
  backButton: { marginBottom: 24, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  headerSection: { alignItems: 'center', marginBottom: 28, gap: 8 },
  title: { fontSize: 28, fontFamily: fonts.heading, color: colors.ink, textAlign: 'center' },
  subtitle: { fontSize: 15, fontFamily: fonts.body, color: colors.muted, textAlign: 'center', lineHeight: 22 },

  formCard: { borderRadius: 24, padding: 24, borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  fieldWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, marginBottom: 12, shadowColor: colors.amber, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.08, shadowRadius: 8 },
  fieldIcon: { paddingLeft: 16 },
  input: { flex: 1, padding: 15, fontSize: 15, fontFamily: fonts.body },
  eyeBtn: { paddingRight: 16 },

  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 20, gap: 10 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  checkboxLabel: { flex: 1, fontSize: 13, fontFamily: fonts.body, lineHeight: 18 },
  termsLink: { fontFamily: fonts.bodyMedium, color: colors.amber },

  button: { backgroundColor: colors.amber, paddingVertical: 16, borderRadius: 100, alignItems: 'center', shadowColor: colors.amber, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  buttonDisabled: { opacity: 0.5 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { fontSize: 17, fontFamily: fonts.bodySemiBold, color: '#111827' },
})
