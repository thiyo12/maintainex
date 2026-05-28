import { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../lib/colors'
import { auth } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'

export default function TaskerEditProfile() {
  const router = useRouter()
  const { user, refreshUser } = useAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()
    if (user) {
      setName(user.name || '')
      setPhone(user.phone || '')
    }
  }, [user])

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required')
      return
    }
    setSaving(true)
    try {
      await auth.updateProfile({ name: name.trim(), phone: phone.trim() })
      await refreshUser()
      Alert.alert('Saved', 'Profile updated successfully')
      router.back()
    } catch {
      Alert.alert('Error', 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <Text style={styles.heading}>Edit profile</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(name || 'T')[0]}</Text>
            </View>
            <TouchableOpacity>
              <Text style={styles.changePhoto}>Change photo</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" />
          <Text style={styles.label}>Email</Text>
          <View style={[styles.input, { backgroundColor: '#F3F4F6', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 15, color: colors.gray }}>{user?.email || ''}</Text>
          </View>
          <Text style={styles.label}>Phone</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0712345678" />
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.saveBtnText}>Save changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark, paddingHorizontal: 24, marginBottom: 16 },
  scroll: { paddingHorizontal: 24 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.teal,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: colors.white },
  changePhoto: { fontSize: 14, color: colors.teal, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '700', color: colors.gray, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.white, borderRadius: 12, padding: 14, fontSize: 15,
    borderWidth: 1.5, borderColor: colors.lightGray, color: colors.dark,
  },
  saveBtn: {
    backgroundColor: colors.teal, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 28, marginBottom: 40,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
})
