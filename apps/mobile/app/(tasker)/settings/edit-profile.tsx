import { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Animated, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { fontSizes } from '../../../lib/tokens'
import { taskers, auth, upload, resolveImageUri } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'

export default function TaskerEditProfile() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { user, refreshUser } = useAuth()
  const verified = user?.identityStatus === 'VERIFIED' || user?.identityStatus === 'APPROVED'
  const nameLocked = !!verified
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [phone, setPhone] = useState('')
  const [profileImage, setProfileImage] = useState('')
  const [bio, setBio] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
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
    const loadTaskerProfile = async () => {
      try {
        const p = await taskers.getMyProfile()
        setBio(p.bio || '')
        setHourlyRate(p.hourlyRate != null ? String(p.hourlyRate) : '')
        if (p.profileImage) setProfileImage(p.profileImage)
        if (p.user?.nickname) setNickname(p.user.nickname)
      } catch { /* ignore */ }
    }
    loadTaskerProfile()
  }, [user])

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('common.error'), 'Camera roll permission is required')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })
    if (!result.canceled && result.assets[0]) {
      setUploading(true)
      try {
        const { url } = await upload.file(result.assets[0].uri, 'avatar')
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
      await taskers.updateProfile({
        name: nameLocked ? undefined : name.trim(),
        nickname: nickname.trim() || undefined,
        phone: phone.trim(),
        bio: bio.trim(),
        hourlyRate: hourlyRate.trim() ? Number(hourlyRate) : undefined,
        profileImage: profileImage || undefined,
      })
      await auth.updateProfile({ name: nameLocked ? undefined : name.trim(), phone: phone.trim(), profileImage: profileImage || undefined })
      await refreshUser()
      Alert.alert(t('common.success'), t('profile.editProfileHeader'))
      router.back()
    } catch {
      Alert.alert(t('common.error'), t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <Text style={styles.heading}>{t('tasker.editProfile')}</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              {resolveImageUri(profileImage) ? (
                <Image source={{ uri: resolveImageUri(profileImage)! }} style={{ width: 80, height: 80, borderRadius: 22 }} />
              ) : (
                <Text style={styles.avatarText}>{(name || 'T')[0]}</Text>
              )}
            </View>
            <TouchableOpacity onPress={pickImage} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                <Text style={styles.changePhoto}>{t('components.addPhoto')}</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.faceHint}>{t('profile.photoFaceHint')}</Text>
          </View>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{t('profile.fullName')}</Text>
            {nameLocked && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={12} color={colors.amber} />
                <Text style={styles.verifiedBadgeText}>{t('profile.nameLocked')}</Text>
              </View>
            )}
          </View>
          <View style={[styles.input, nameLocked && { backgroundColor: colors.surface, justifyContent: 'center' }]}>
            <Text style={{ fontSize: fontSizes.body, color: nameLocked ? colors.muted : colors.ink }}>{name}</Text>
          </View>
          {nameLocked && (
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4, fontFamily: fonts.body }}>{t('profile.nameLockedHint')}</Text>
          )}
          <Text style={styles.label}>{t('profile.nickname')}</Text>
          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder={t('profile.nicknamePlaceholder')}
            autoCorrect={false}
          />
          <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4, fontFamily: fonts.body }}>{t('profile.nicknameHint')}</Text>
          {user?.lastNameChangedAt && !nameLocked && (() => {
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
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder={t('auth.register.phonePlaceholder')} />
          <Text style={styles.label}>Hourly rate (LKR)</Text>
          <TextInput style={styles.input} value={hourlyRate} onChangeText={setHourlyRate} keyboardType="numeric" placeholder="e.g. 1500" />
          <Text style={styles.label}>About me</Text>
          <TextInput
            style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
            value={bio}
            onChangeText={setBio}
            multiline
            placeholder="Tell customers about your experience and services…"
          />
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.saveBtnText}>{t('common.save')}</Text>
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
  faceHint: { fontSize: 12, color: colors.muted, fontFamily: fonts.body, marginTop: 8, textAlign: 'center' },
  label: { fontSize: fontSizes.bodySmall, fontFamily: fonts.bodyMedium, color: colors.muted, marginBottom: 6, marginTop: 12 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 6 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.amberBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  verifiedBadgeText: { fontSize: 11, fontFamily: fonts.bodyMedium, color: colors.amberDark },
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
