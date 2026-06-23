import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
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
          <Ionicons name="arrow-back" size={22} color={colors.amber} />
          <Text style={styles.backText}>{t('auth.register.back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('auth.register.createYourAccount')}</Text>
        <Text style={styles.subtitle}>{roleLabel}</Text>

        <View style={styles.form}>
          <Text style={styles.label}>{t('auth.register.name')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('auth.register.namePlaceholder')}
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>{t('auth.register.phone')}</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder={t('auth.register.phonePlaceholder')}
            keyboardType="phone-pad"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>{t('auth.register.email')}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.register.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>{t('auth.register.password')}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.register.passwordPlaceholder')}
            secureTextEntry
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>{t('auth.register.confirmPassword')}</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t('auth.register.confirmPasswordPlaceholder')}
            secureTextEntry
            placeholderTextColor={colors.muted}
          />

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setAgreeTerms(!agreeTerms)}
          >
            <View style={[styles.checkbox, agreeTerms && styles.checkboxActive]}>
              {agreeTerms && <Ionicons name="checkmark" size={14} color={colors.white} />}
            </View>
            <Text style={styles.checkboxLabel}>
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
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>{t('auth.register.next')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  scrollContent: { padding: 32, paddingTop: 60 },
  backButton: { marginBottom: 24 },
  backText: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.amber },
  title: { fontSize: 32, fontFamily: fonts.heading, color: colors.ink, marginBottom: 8 },
  subtitle: { fontSize: 16, fontFamily: fonts.body, color: colors.muted, marginBottom: 24 },
  form: { gap: 2 },
  label: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.ink, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  checkboxLabel: { flex: 1, fontSize: 13, fontFamily: fonts.body, color: colors.muted, lineHeight: 18 },
  termsLink: { fontFamily: fonts.bodyMedium, color: colors.amber },
  button: {
    backgroundColor: colors.amber,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 18, fontFamily: fonts.bodyMedium, color: colors.ink },
})
