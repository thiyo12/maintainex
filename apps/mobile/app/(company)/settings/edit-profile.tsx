import { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Animated, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Camera } from 'phosphor-react-native'
import * as ImagePicker from 'expo-image-picker'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { fontSizes } from '../../../lib/tokens'
import { auth, upload, company as companyApi } from '../../../lib/api'
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
  const [companyName, setCompanyName] = useState('')
  const [profileImage, setProfileImage] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()
    if (user) {
      setName(user.name || '')
      setPhone(user.phone || '')
      setProfileImage(user.profileImage || '')
    }
    ;(async () => {
      try {
        const res = await companyApi.profile.get()
        if (res?.companyName) setCompanyName(res.companyName)
      } catch {}
    })()
  }, [user])

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('common.error'), 'Camera roll permission is required')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      setUploading(true)
      try {
        const { url } = await upload.file(result.assets[0].uri)
        setProfileImage(url)
      } catch {
        Alert.alert(t('common.error'), 'Failed to upload image')
      } finally {
        setUploading(false)
      }
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('tasker.nameRequired'))
      return
    }
    setSaving(true)
    try {
      await auth.updateProfile({ name: name.trim(), phone: phone.trim(), profileImage: profileImage || undefined })
      if (companyName.trim()) {
        await companyApi.profile.update({ companyName: companyName.trim() })
      }
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
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={{ width: 80, height: 80, borderRadius: 22 }} />
              ) : (
                <Text style={styles.avatarText}>{(name || 'C')[0]}</Text>
              )}
            </View>
            <TouchableOpacity onPress={pickImage} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                <Text style={styles.changePhoto}>{t('components.addPhoto')}</Text>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>{t('company.companyName') || 'Company Name'}</Text>
          <TextInput style={styles.input} value={companyName} onChangeText={setCompanyName} placeholder='My Company' />
          <Text style={styles.label}>{t('profile.fullName')}</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t('auth.register.namePlaceholder')} />
          {user?.lastNameChangedAt && (() => {
            const d = Math.floor((Date.now() - new Date(user.lastNameChangedAt).getTime()) / (1000 * 60 * 60 * 24))
            if (d < 30) {
              const a = new Date(user.lastNameChangedAt); a.setDate(a.getDate() + 30)
              return <Text style={{ fontSize: 11, color: '#EF4444', marginTop: 4, fontFamily: fonts.body }}>Name can be changed again on {a.toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            }
            return null
          })()}
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
