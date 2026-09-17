import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import { CaretRight } from 'phosphor-react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'

import { auth } from '../../lib/api'
import { v3 } from '../../theme/v3/tokens'
import AuthShell from '../../components/v3/AuthShell'
import V3NavBar from '../../components/v3/V3NavBar'
import V3Button from '../../components/v3/V3Button'

export default function ResetPasswordScreen() {
  const router = useRouter()
  const { email, code } = useLocalSearchParams<{ email?: string; code?: string }>()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const canSubmit = !!email && !!code && newPassword.length >= 8 && newPassword === confirmPassword

  const handleReset = async () => {
    if (!email || !code) {
      Alert.alert('Reset code missing', 'Request a new password reset code and try again.')
      return
    }
    if (newPassword.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Enter the same password in both fields.')
      return
    }

    setLoading(true)
    try {
      await auth.resetPassword({ email, code, newPassword })
      Alert.alert('Password updated', 'Sign in again with your new password.', [
        { text: 'Sign in', onPress: () => router.replace('/(auth)/login') },
      ])
    } catch (err: any) {
      let message = err?.message || 'Failed to reset password'
      try { message = JSON.parse(message).error || message } catch {}
      Alert.alert('Unable to reset password', message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AuthShell bg={v3.colors.canvas}>
        <V3NavBar title="New password" onBack={() => router.back()} />

        <View style={styles.content}>
          <Text style={styles.title}>Create a new password.</Text>
          <Text style={styles.subtitle}>Use a strong password you have not used before.</Text>

          <View style={styles.row}>
            <View style={styles.number}><Text style={styles.numberText}>1</Text></View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>New password</Text>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="••••••••••••"
                placeholderTextColor={v3.colors.textMuted}
                secureTextEntry
                textContentType="newPassword"
                style={styles.input}
              />
            </View>
            <CaretRight size={16} color={v3.colors.ink} />
          </View>

          <View style={styles.row}>
            <View style={styles.number}><Text style={styles.numberText}>2</Text></View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Confirm password</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••••••"
                placeholderTextColor={v3.colors.textMuted}
                secureTextEntry
                textContentType="newPassword"
                style={styles.input}
              />
            </View>
            <CaretRight size={16} color={v3.colors.ink} />
          </View>

          <View style={styles.row}>
            <View style={styles.number}><Text style={styles.numberText}>3</Text></View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Security</Text>
              <Text style={styles.rowSubtitle}>All other sessions will be signed out</Text>
            </View>
            <CaretRight size={16} color={v3.colors.ink} />
          </View>

          {!email || !code ? <Text style={styles.warning}>This reset session is incomplete. Go back and request a new code.</Text> : null}

          <View style={styles.bottom}>
            <V3Button label="Save new password" onPress={handleReset} loading={loading} disabled={!canSubmit} />
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
  input: { marginTop: 1, paddingVertical: 1, fontSize: 10, fontFamily: 'Outfit_600SemiBold', color: v3.colors.ink },
  warning: { marginTop: 4, fontSize: 9, lineHeight: 13, fontFamily: 'Outfit_600SemiBold', color: v3.colors.error },
  bottom: { flex: 1, justifyContent: 'flex-end', paddingBottom: 16 },
})
