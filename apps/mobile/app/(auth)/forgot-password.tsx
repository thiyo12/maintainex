import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { EnvelopeSimple, ArrowRight, CaretLeft } from 'phosphor-react-native'
import { auth } from '../../lib/api'
import { useColors } from '../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { fonts } from '../../lib/fonts'
import { fontSizes } from '../../lib/tokens'
import { spacing, borderRadius } from '../../lib/tokens'

export default function ForgotPasswordScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { t } = useTranslation()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSend = async () => {
    if (!email.trim()) {
      Alert.alert(t('common.error'), t('errors.fillAllFields'))
      return
    }

    setLoading(true)
    try {
      await auth.forgotPassword({ email: email.trim().toLowerCase() })
      setSent(true)
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.centerContent}>
          <Text style={[styles.title, { color: colors.ink }]}>{t('auth.forgotPassword.checkEmail')}</Text>
          <Text style={[styles.subtitle, { color: colors.inkLight }]}>
            {t('auth.forgotPassword.codeSentTo')} {email}
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.push({ pathname: '/(auth)/reset-password', params: { email } })}
          >
            <Text style={styles.buttonText}>{t('auth.forgotPassword.enterCode')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSent(false)} style={styles.linkButton}>
            <Text style={[styles.linkText, { color: colors.primary }]}>{t('auth.forgotPassword.tryDifferentEmail')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <CaretLeft size={20} color={colors.ink} weight="bold" />
      </TouchableOpacity>

      <Text style={[styles.title, { color: colors.ink }]}>{t('auth.forgotPassword.title')}</Text>
      <Text style={[styles.subtitle, { color: colors.inkLight }]}>
        {t('auth.forgotPassword.description')}
      </Text>

      <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <EnvelopeSimple size={18} color={colors.muted} weight="regular" style={styles.inputIcon} />
        <TextInput
          style={[styles.input, { color: colors.ink }]}
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.register.emailPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={colors.muted}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }, (!email || loading) && { opacity: 0.5 }]}
        onPress={handleSend}
        disabled={!email || loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <View style={styles.buttonInner}>
            <Text style={styles.buttonText}>{t('auth.forgotPassword.sendCode')}</Text>
            <ArrowRight size={18} color="#FFFFFF" weight="bold" />
          </View>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, padding: spacing.xxxl, paddingTop: 60 },
  backButton: { marginBottom: spacing.xxxl, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  title: { fontSize: fontSizes.h1, fontFamily: fonts.headingBold, marginBottom: spacing.sm },
  subtitle: { fontSize: fontSizes.bodySmall, fontFamily: fonts.body, marginBottom: spacing.xxxxl, lineHeight: 24 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.md, borderWidth: 1.5, marginBottom: spacing.xl, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  inputIcon: { paddingLeft: 16 },
  input: { flex: 1, padding: 15, fontSize: fontSizes.body, fontFamily: fonts.body },
  button: { paddingVertical: spacing.lg, borderRadius: borderRadius.lg, alignItems: 'center' },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { fontSize: fontSizes.h3, fontFamily: fonts.button, color: '#FFFFFF' },
  linkButton: { marginTop: spacing.lg },
  linkText: { fontSize: fontSizes.bodySmall, fontFamily: fonts.label },
})
