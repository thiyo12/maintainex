import { useState } from 'react'
import {
  View, Text, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { auth } from '../../lib/api'
import { v3 } from '../../theme/v3/tokens'
import AuthShell from '../../components/v3/AuthShell'
import V3NavBar from '../../components/v3/V3NavBar'
import V3ListRow from '../../components/v3/V3ListRow'
import V3Button from '../../components/v3/V3Button'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (!phone.trim()) {
      Alert.alert('Error', 'Please enter your mobile number')
      return
    }
    setLoading(true)
    try {
      await auth.forgotPassword({ email: phone.trim() })
      router.push({
        pathname: '/(auth)/reset-password',
        params: { phone: phone.trim() },
      })
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell bg={v3.colors.canvas}>
      <V3NavBar
        title="Reset access"
        onBack={() => router.back()}
      />

      <View style={styles.content}>
        <Text style={styles.title}>Forgot your password?</Text>
        <Text style={styles.subtitle}>
          Enter the mobile number on your MaintainEX account.
        </Text>

        <View style={styles.rows}>
          <V3ListRow
            number={1}
            title="Mobile number"
            subtitle={phone ? `+94 ${phone}` : '+94 77 123 4567'}
          />
          <V3ListRow
            number={2}
            title="Verification"
            subtitle="We will send a one-time code"
          />
        </View>

        <View style={styles.bottom}>
          <V3Button
            label="Send verification code"
            onPress={handleSend}
            loading={loading}
            disabled={!phone.trim()}
          />
        </View>
      </View>
    </AuthShell>
  )
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 18,
    gap: 0,
  },
  title: {
    fontSize: 25,
    fontFamily: 'Outfit_900Black',
    fontWeight: '900',
    color: v3.colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 10.2,
    fontFamily: 'Outfit_500Medium',
    fontWeight: '600',
    color: v3.colors.textSecondary,
    marginBottom: 20,
  },
  rows: {
    gap: 10,
  },
  bottom: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 16,
  },
})
