import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../../lib/auth'
import { auth } from '../../../lib/api'
import { v3 } from '../../../theme/v3/tokens'
import V3PageHeader from '../../../components/v3/V3PageHeader'

export default function EditProfileScreen() {
  const { user, refreshUser } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(user?.name || '')
    setEmail(user?.email || '')
    setPhone(user?.phone || '')
  }, [user])

  const save = async () => {
    if (name.trim().length < 2) return Alert.alert('Name required', 'Enter your full name.')
    setSaving(true)
    try {
      await auth.updateProfile({ name: name.trim(), email: email.trim(), phone: phone.trim() })
      await refreshUser()
      Alert.alert('Saved', 'Your profile is up to date.')
    } catch (error: any) {
      Alert.alert('Could not save', error?.message || 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <V3PageHeader title="Edit profile" subtitle="Your phone stays private until a booking needs it." />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>PROFILE</Text>
        <Text style={styles.hero}>Keep your details current.</Text>

        {[
          ['FULL NAME', name, setName, 'default'],
          ['MOBILE', phone, setPhone, 'phone-pad'],
          ['EMAIL', email, setEmail, 'email-address'],
        ].map(([label, value, setter, keyboard]: any) => (
          <View key={label} style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              value={value}
              onChangeText={setter}
              keyboardType={keyboard}
              autoCapitalize={label === 'EMAIL' ? 'none' : 'words'}
              style={styles.input}
              placeholderTextColor={v3.colors.textPlaceholder}
            />
          </View>
        ))}

        <TouchableOpacity activeOpacity={0.82} onPress={save} disabled={saving} style={[styles.primary, saving && { opacity: 0.5 }]}>
          {saving ? <ActivityIndicator color={v3.colors.paper} /> : <Text style={styles.primaryText}>Save changes</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  content: { paddingHorizontal: 18, paddingBottom: 36 },
  eyebrow: { fontFamily: 'Outfit_800ExtraBold', fontSize: 10, color: v3.colors.textMuted, letterSpacing: 0.9 },
  hero: { marginTop: 6, marginBottom: 20, fontFamily: 'Outfit_900Black', fontSize: 26, color: v3.colors.ink },
  field: { marginBottom: 12 },
  label: { marginBottom: 6, fontFamily: 'Outfit_800ExtraBold', fontSize: 10, color: v3.colors.textMuted, letterSpacing: 0.7 },
  input: { height: 54, borderRadius: 14, paddingHorizontal: 14, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: v3.colors.ink },
  primary: { marginTop: 10, height: 56, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: v3.colors.paper },
})
