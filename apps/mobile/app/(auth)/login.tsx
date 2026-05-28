import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { colors } from '../../lib/colors'

export default function LoginScreen() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const redirectByRole = (role: string) => {
    if (role === 'ADMIN') router.replace('/(admin)')
    else if (role === 'TASKER') router.replace('/(tasker)')
    else if (role === 'COMPANY') router.replace('/(company)')
    else router.replace('/(customer)')
  }

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }
    setLoading(true)
    try {
      const user = await login(email, password)
      redirectByRole(user.role)
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials')
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
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.forgotPassword}
            onPress={() => router.push('/(auth)/otp')}
          >
            <Text style={styles.forgotText}>Login with OTP instead</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.dark} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/(auth)/welcome')}>
          <Text style={styles.footerText}>
            Don't have an account? <Text style={styles.footerLink}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 32, paddingTop: 60 },
  backButton: { marginBottom: 32 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  title: { fontSize: 32, fontWeight: '800', color: colors.dark, marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.gray, marginBottom: 40 },
  form: { gap: 4 },
  label: { fontSize: 14, fontWeight: '600', color: colors.dark, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.dark,
  },
  forgotPassword: { alignSelf: 'flex-end', marginTop: 12, marginBottom: 24 },
  forgotText: { color: colors.primary, fontSize: 14, fontWeight: '500' },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 18, fontWeight: '700', color: colors.dark },
  footerText: { textAlign: 'center', marginTop: 40, fontSize: 14, color: colors.gray },
  footerLink: { color: colors.primary, fontWeight: '600' },
})
