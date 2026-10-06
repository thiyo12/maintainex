import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import { CaretRight } from 'phosphor-react-native'
import { useRouter } from 'expo-router'

import { auth } from '@/api/auth'
import { v3 } from '@/theme/v3/tokens'
import AuthShell from '@/components/v3/AuthShell'
import V3NavBar from '@/components/v3/V3NavBar'
import V3Button from '@/components/v3/V3Button'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    const normalized = email.trim().toLowerCase()
    if (!normalized || !normalized.includes('@')) {
      Alert.alert('Check your email', 'Enter the email address on your MaintainEX account.')
      return
    }

    setLoading(true)
    try {
      await auth.forgotPassword({ email: normalized })
      router.push({
        pathname: '/(auth)/otp',
        params: {
          purpose: 'reset',
          email: normalized,
          maskedPhone: normalized.replace(/^(.{2}).*(@.*)$/, '$1••••$2'),
        },
      } as any)
    } catch (err: any) {
      let message = err?.message || 'Could not send a reset code.'
      try { message = JSON.parse(message).error || message } catch {}
      Alert.alert('Unable to continue', message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AuthShell bg={v3.colors.canvas}>
        <V3NavBar title="Reset access" onBack={() => router.back()} />

        <View style={styles.content}>
          <Text style={styles.title}>Forgot your password?</Text>
          <Text style={styles.subtitle}>Enter the email address on your MaintainEX account.</Text>

          <View style={styles.row}>
            <View style={styles.number}><Text style={styles.numberText}>1</Text></View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Account email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={v3.colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                style={styles.input}
              />
            </View>
            <CaretRight size={16} color={v3.colors.ink} />
          </View>

          <View style={styles.row}>
            <View style={styles.number}><Text style={styles.numberText}>2</Text></View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Verification</Text>
              <Text style={styles.rowSubtitle}>We will send a one-time reset code</Text>
            </View>
            <CaretRight size={16} color={v3.colors.ink} />
          </View>

          <Text style={styles.backendNote}>Password reset currently uses the verified account email.</Text>

          <View style={styles.bottom}>
            <V3Button label="Send verification code" onPress={handleSend} loading={loading} disabled={!email.trim()} />
          </View>
        </View>
      </AuthShell>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: v3.colors.canvas },
  content: { flex: 1, paddingHorizontal: 18, paddingTop: 8 },
  title: { fontSize: 25, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  subtitle: { marginTop: 8, marginBottom: 20, fontSize: 10.2, lineHeight: 15, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  row: { minHeight: 66, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, marginBottom: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  number: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F1F1F1', alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 10, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  rowCopy: { flex: 1 },
  rowTitle: { fontSize: 11.2, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  rowSubtitle: { marginTop: 3, fontSize: 8.8, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  input: { marginTop: 1, paddingVertical: 1, fontSize: 9.5, fontFamily: 'Outfit_600SemiBold', color: v3.colors.ink },
  backendNote: { marginTop: 4, fontSize: 8.7, lineHeight: 13, fontFamily: 'Outfit_500Medium', color: v3.colors.textMuted },
  bottom: { flex: 1, justifyContent: 'flex-end', paddingBottom: 16 },
})
