import { useState } from 'react'
import {
  View, Text, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { auth } from '../../lib/api'
import { v3 } from '../../theme/v3/tokens'
import AuthShell from '../../components/v3/AuthShell'
import V3NavBar from '../../components/v3/V3NavBar'
import V3ListRow from '../../components/v3/V3ListRow'
import V3Button from '../../components/v3/V3Button'

export default function ResetPasswordScreen() {
  const router = useRouter()
  const { phone } = useLocalSearchParams<{ phone?: string }>()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const canSubmit = newPassword.length >= 6 && confirmPassword.length >= 6 && newPassword === confirmPassword

  const handleReset = async () => {
    if (!canSubmit) {
      if (newPassword.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters')
        return
      }
      if (newPassword !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match')
        return
      }
    }

    setLoading(true)
    try {
      await auth.resetPassword({
        email: phone || '',
        code: '',
        newPassword,
      })
      Alert.alert('Success', 'Your password has been reset', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ])
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  const maskedPw = (len: number) => '•'.repeat(Math.min(len, 12))

  return (
    <AuthShell bg={v3.colors.canvas}>
      <V3NavBar
        title="New password"
        onBack={() => router.back()}
      />

      <View style={styles.content}>
        <Text style={styles.title}>Create a new password.</Text>
        <Text style={styles.subtitle}>
          Use a strong password you have not used before.
        </Text>

        <View style={styles.fields}>
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>New password</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor={v3.colors.textPlaceholder}
                secureTextEntry
              />
            </View>
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Confirm password</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm password"
                placeholderTextColor={v3.colors.textPlaceholder}
                secureTextEntry
              />
            </View>
          </View>
        </View>

        <View style={styles.rows}>
          <V3ListRow
            number={3}
            title="Security"
            subtitle="All other sessions can be signed out"
          />
        </View>

        <View style={styles.bottom}>
          <V3Button
            label="Save new password"
            onPress={handleReset}
            loading={loading}
            disabled={!canSubmit}
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
  fields: {
    gap: 12,
    marginBottom: 16,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    fontWeight: '800',
    color: '#4F4F4F',
    marginLeft: 2,
  },
  inputRow: {
    height: v3.components.input.height,
    borderRadius: v3.components.input.borderRadius,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  input: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    fontWeight: '600',
    color: v3.colors.textPrimary,
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
