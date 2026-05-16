import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  background: '#F9FAFB',
  white: '#FFFFFF',
  green: '#10B981',
}

export default function RegisterScreen() {
  const router = useRouter()
  const { register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'CUSTOMER' | 'TASKER'>('CUSTOMER')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!name || !email || !phone || !password) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }
    setLoading(true)
    try {
      await register({ name, email, password, phone, role })
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Something went wrong')
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

        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join as a customer or tasker</Text>

        <View style={styles.roleSelector}>
          <TouchableOpacity
            style={[styles.roleOption, role === 'CUSTOMER' && styles.roleActive]}
            onPress={() => setRole('CUSTOMER')}
          >
            <Text style={[styles.roleText, role === 'CUSTOMER' && styles.roleTextActive]}>
              Customer
            </Text>
            <Text style={styles.roleDesc}>I need services</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleOption, role === 'TASKER' && styles.roleActive]}
            onPress={() => setRole('TASKER')}
          >
            <Text style={[styles.roleText, role === 'TASKER' && styles.roleTextActive]}>
              Tasker
            </Text>
            <Text style={styles.roleDesc}>I offer services</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="0712345678"
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Create a password"
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.dark} />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.footerText}>
            Already have an account? <Text style={styles.footerLink}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 32, paddingTop: 60 },
  backButton: { marginBottom: 24 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  title: { fontSize: 32, fontWeight: '800', color: colors.dark, marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.gray, marginBottom: 32 },
  roleSelector: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  roleOption: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.lightGray,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  roleActive: { borderColor: colors.primary, backgroundColor: '#FFFBEB' },
  roleText: { fontSize: 16, fontWeight: '700', color: colors.dark, marginBottom: 4 },
  roleTextActive: { color: colors.primary },
  roleDesc: { fontSize: 12, color: colors.gray },
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
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 18, fontWeight: '700', color: colors.dark },
  footerText: { textAlign: 'center', marginTop: 32, fontSize: 14, color: colors.gray },
  footerLink: { color: colors.primary, fontWeight: '600' },
})
