import { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { fontSizes } from '../../../lib/tokens'
import { auth } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { useTranslation } from 'react-i18next'

export default function CompanyEditProfile() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
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
      Alert.alert(t('common.error'), t('tasker.nameRequired'))
      return
    }
    setSaving(true)
    try {
      await auth.updateProfile({ name: name.trim(), phone: phone.trim() })
      await refreshUser()
      Alert.alert(t('common.success'), t('profile.editProfileHeader') + ' ' + t('common.success'))
      router.back()
    } catch {
      Alert.alert(t('common.error'), t('company.editProfile') + ' ' + t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <Text style={styles.heading}>{t('company.editProfile')}</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(name || 'C')[0]}</Text>
            </View>
            <TouchableOpacity>
              <Text style={styles.changePhoto}>{t('components.addPhoto')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>{t('profile.fullName')}</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t('auth.register.namePlaceholder')} />
          <Text style={styles.label}>{t('profile.email')}</Text>
          <View style={[styles.input, { backgroundColor: colors.surface, justifyContent: 'center' }]}>
            <Text style={{ fontSize: fontSizes.body, color: colors.muted }}>{user?.email || ''}</Text>
          </View>
          <Text style={styles.label}>{t('profile.phone')}</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0712345678" />
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.saveBtnText}>{t('common.saveChanges')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  heading: { fontSize: fontSizes.h2, fontFamily: fonts.heading, color: colors.ink, paddingHorizontal: 24, marginBottom: 16 },
  scroll: { paddingHorizontal: 24 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 22, backgroundColor: colors.amber,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  avatarText: { fontSize: 32, fontFamily: fonts.heading, color: colors.white },
  changePhoto: { fontSize: fontSizes.bodySmall, color: colors.muted, fontFamily: fonts.bodyMedium },
  label: { fontSize: fontSizes.bodySmall, fontFamily: fonts.bodyMedium, color: colors.muted, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.white, borderRadius: 14, padding: 14, fontSize: fontSizes.body,
    borderWidth: 1, borderColor: colors.border, color: colors.ink,
  },
  saveBtn: {
    backgroundColor: colors.amber, borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 28, marginBottom: 40,
  },
  saveBtnText: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, color: '#111827' },
})
