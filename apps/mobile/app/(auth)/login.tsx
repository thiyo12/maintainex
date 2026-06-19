import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
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
          <Ionicons name="arrow-back" size={22} color={colors.amber} />
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('auth.login.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>

        <View style={styles.form}>
          <Text style={styles.label}>{t('auth.login.email')}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>{t('auth.login.password')}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.login.password')}
            secureTextEntry
            placeholderTextColor={colors.muted}
          />

          <TouchableOpacity
            style={styles.forgotPassword}
            onPress={() => router.push('/(auth)/otp')}
          >
            <Text style={styles.forgotText}>{t('auth.login.loginWithOtp')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Text style={styles.buttonText}>{t('auth.login.button')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/(auth)/welcome')}>
          <Text style={styles.footerText}>
            {t('auth.login.noAccount')} <Text style={styles.footerLink}>{t('auth.login.signUp')}</Text>
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  scrollContent: { padding: 32, paddingTop: 60 },
  backButton: { marginBottom: 32 },
  backText: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.amber },
  title: { fontSize: 32, fontFamily: fonts.heading, color: colors.ink, marginBottom: 8 },
  subtitle: { fontSize: 16, fontFamily: fonts.body, color: colors.muted, marginBottom: 40 },
  form: { gap: 4 },
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
  forgotPassword: { alignSelf: 'flex-end', marginTop: 12, marginBottom: 24 },
  forgotText: { color: colors.amber, fontSize: 14, fontFamily: fonts.bodyMedium },
  button: {
    backgroundColor: colors.amber,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 18, fontFamily: fonts.bodyMedium, color: colors.ink },
  footerText: { textAlign: 'center', marginTop: 40, fontSize: 14, fontFamily: fonts.body, color: colors.muted },
  footerLink: { fontFamily: fonts.bodyMedium, color: colors.amber },
})
