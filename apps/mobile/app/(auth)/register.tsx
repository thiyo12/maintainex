import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../lib/auth'
import { colors } from '../../lib/colors'
import { fonts } from '../../lib/fonts'

export default function RegisterScreen() {
  const router = useRouter()
  const { role: paramRole } = useLocalSearchParams<{ role: string }>()
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

  const roleLabel = role === 'TASKER' ? 'Join as a tasker' : role === 'COMPANY' ? 'Register your company' : 'Join as a customer'

  const handleNext = async () => {
    if (!name || !phone || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match')
      return
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters')
      return
    }
    if (phone.replace(/\D/g, '').length < 9) {
      Alert.alert('Error', 'Please enter a valid phone number')
      return
    }
    if (!agreeTerms) {
      Alert.alert('Error', 'Please agree to the terms and conditions')
      return
    }

    setLoading(true)
    try {
      await register({ name, email, password, phone, role })
      setSignupData({ name, email, phone, password, role })
      router.push({ pathname: '/(auth)/otp', params: { phone, role } })
    } catch (err: any) {
      let message = err.message || 'Something went wrong'
      try {
        const parsed = JSON.parse(message)
        message = parsed.error || message
      } catch {}
      Alert.alert('Registration Failed', message)
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
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>{roleLabel}</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="0712345678"
            keyboardType="phone-pad"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Create a password"
            secureTextEntry
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm your password"
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
              I agree to the{' '}
              <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>
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
              <Text style={styles.buttonText}>Next</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
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
  termsLink: { fontFamily: fonts.headingBold, color: colors.amber },
  button: {
    backgroundColor: colors.amber,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.ink },
})
