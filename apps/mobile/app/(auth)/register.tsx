import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { LinearGradient } from 'expo-linear-gradient'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

export default function RegisterScreen() {
  const router = useRouter()
  const [role, setRole] = useState<'CUSTOMER' | 'TASKER'>('CUSTOMER')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!name || !email || !phone || !password) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        name, email, phone, password, role,
      }

      if (role === 'TASKER') {
        body.hourlyRate = 1000
        body.primaryDistrict = 'Colombo'
        body.serviceRadius = 25
        body.categoryIds = []
      }

      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        Alert.alert('Error', data.error || 'Registration failed')
        return
      }

      if (role === 'TASKER') {
        Alert.alert(
          'Account Created',
          'Your tasker account is pending verification. We'll notify you once approved.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
        )
      } else {
        const token = data.data?.token || ''
        if (token) await SecureStore.setItemAsync('session_token', token)
        await SecureStore.setItemAsync('user_data', JSON.stringify(data.data))
        router.replace('/(customer)')
      }
    } catch {
      Alert.alert('Error', 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.logo}>Maintain<Text style={styles.logoDark}>ex</Text></Text>
        <Text style={styles.subtitle}>Create your account</Text>
      </View>

      {/* Role Toggle */}
      <View style={styles.roleContainer}>
        <TouchableOpacity
          style={[styles.roleButton, role === 'CUSTOMER' && styles.roleButtonActive]}
          onPress={() => setRole('CUSTOMER')}
        >
          <Text style={[styles.roleText, role === 'CUSTOMER' && styles.roleTextActive]}>
            I need a service
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.roleButton, role === 'TASKER' && styles.roleButtonActive]}
          onPress={() => setRole('TASKER')}
        >
          <Text style={[styles.roleText, role === 'TASKER' && styles.roleTextActive]}>
            I want to work
          </Text>
        </TouchableOpacity>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="John Doe" />

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />

        <Text style={styles.label}>Phone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="07XXXXXXXX" keyboardType="phone-pad" />

        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Min 6 characters" secureTextEntry />

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Creating...' : `Create ${role === 'TASKER' ? 'Tasker' : 'Customer'} Account`}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.loginText}>Already have an account? <Text style={styles.loginLink}>Sign In</Text></Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  scroll: { padding: 24 },
  header: { alignItems: 'center', marginTop: 40, marginBottom: 30 },
  logo: { fontSize: 32, fontWeight: 'bold', color: '#4F46E5' },
  logoDark: { color: '#111827' },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 8 },
  roleContainer: { flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 12, padding: 4, marginBottom: 24 },
  roleButton: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  roleButtonActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  roleText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  roleTextActive: { color: '#4F46E5' },
  form: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 16, backgroundColor: '#FAFAFA' },
  button: { backgroundColor: '#4F46E5', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  loginText: { marginTop: 20, textAlign: 'center', color: '#6B7280', fontSize: 14 },
  loginLink: { color: '#4F46E5', fontWeight: '600' },
})
