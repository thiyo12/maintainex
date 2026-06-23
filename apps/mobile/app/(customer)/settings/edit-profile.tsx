import { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Animated, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../../lib/auth'
import { auth } from '../../../lib/api'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../lib/ThemeContext'

export default function EditProfileScreen() {
  const colors = useColors()
  const { t } = useTranslation()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { user, refreshUser } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()
    if (user) {
      setName(user.name || '')
      setEmail(user.email || '')
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
      await auth.updateProfile({ name, phone })
      await refreshUser()
      Alert.alert(t('common.success'), t('common.success'))
      router.back()
    } catch (e: any) {
      let msg = t('errors.generic')
      try { msg = JSON.parse(e.message).error || msg } catch {}
      Alert.alert(t('common.error'), msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <Text style={styles.heading}>{t('profile.edit')}</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{name.charAt(0) || 'U'}</Text>
            </View>
            <TouchableOpacity style={styles.changePhotoBtn}>
              <Ionicons name="camera-outline" size={16} color={colors.customerAccent} />
              <Text style={styles.changePhotoText}> {t('common.edit')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>{t('profile.fullName')}</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t('profile.fullName')} />

          <Text style={styles.label}>{t('profile.email')}</Text>
          <View style={[styles.input, { backgroundColor: '#F3F4F6', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 15, color: colors.gray }}>{email}</Text>
          </View>

          <Text style={styles.label}>{t('profile.phone')}</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder={t('profile.phone')} />

          <Text style={styles.label}>{t('jobDetail.location')}</Text>
          <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder={t('jobDetail.location')} />
        </ScrollView>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={colors.white} />
              <Text style={styles.saveBtnText}> {t('common.saveChanges')}</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark, paddingHorizontal: 24, marginBottom: 16 },
  scroll: { paddingHorizontal: 24 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.customerAccent,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: colors.white },
  changePhotoBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.customerAccent,
    paddingHorizontal: 20, paddingVertical: 6, borderRadius: 20,
  },
  changePhotoText: { fontSize: 13, fontWeight: '600', color: colors.customerAccent, marginLeft: 4 },
  label: { fontSize: 14, fontWeight: '700', color: colors.dark, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lightGray,
    borderRadius: 12, padding: 14, fontSize: 15, color: colors.dark,
  },
  saveBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.customerAccent, marginHorizontal: 24, marginBottom: 32,
    paddingVertical: 16, borderRadius: 14,
  },
  saveBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
})
