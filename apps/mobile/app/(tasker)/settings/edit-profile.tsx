import { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Animated, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Shield, CaretLeft, Camera } from 'phosphor-react-native'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'
import { fonts } from '../../../lib/fonts'
import { fontSizes } from '../../../lib/tokens'
import { taskers, auth, upload, resolveImageUri } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { v3 } from '../../../theme/v3/tokens'

export default function TaskerEditProfile() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user, refreshUser } = useAuth()
  const verified = user?.identityStatus === 'VERIFIED' || user?.identityStatus === 'APPROVED'
  const nameLocked = !!verified
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [phone, setPhone] = useState('')
  const [profileImage, setProfileImage] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [address, setAddress] = useState('')
  const [experienceSummary, setExperienceSummary] = useState('')
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
        setDateOfBirth(p.dateOfBirth || '')
        setAddress(p.address || '')
        setExperienceSummary(p.experienceSummary || '')
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
        dateOfBirth: dateOfBirth.trim() || undefined,
        address: address.trim() || undefined,
        experienceSummary: experienceSummary.trim() || undefined,
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View style={[styles.animated, { opacity: fadeAnim }]}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.72} onPress={() => router.back()}>
            <CaretLeft size={17} color={v3.colors.ink} weight="bold" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Edit Tasker profile</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.hero}>Keep your profile clear</Text>
          <Text style={styles.subtitle}>Customers use these details when they compare Taskers and quotes.</Text>

          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              {resolveImageUri(profileImage) ? (
                <Image source={{ uri: resolveImageUri(profileImage)! }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{(name || 'T').charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <TouchableOpacity style={styles.photoButton} activeOpacity={0.72} onPress={pickImage} disabled={uploading}>
              {uploading ? <ActivityIndicator size="small" color={v3.colors.ink} /> : <><Camera size={15} color={v3.colors.ink} weight="bold" /><Text style={styles.photoButtonText}>Change photo</Text></>}
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>NAME</Text>
          <View style={[styles.fieldCard, nameLocked && styles.lockedCard]}>
            <TextInput
              style={[styles.fieldInput, nameLocked && styles.lockedText]}
              value={name}
              onChangeText={setName}
              editable={!nameLocked}
              placeholder="Full name"
              placeholderTextColor={v3.colors.textPlaceholder}
            />
            {nameLocked ? <Shield size={16} color={v3.colors.success} weight="fill" /> : null}
          </View>
          {nameLocked ? <Text style={styles.fieldHint}>Verified legal names are locked for account safety.</Text> : null}

          <Text style={styles.sectionLabel}>HEADLINE</Text>
          <View style={styles.fieldCard}>
            <TextInput
              style={styles.fieldInput}
              value={nickname}
              onChangeText={setNickname}
              placeholder="e.g. Electrician · 8 years experience"
              placeholderTextColor={v3.colors.textPlaceholder}
            />
          </View>

          <Text style={styles.sectionLabel}>CONTACT</Text>
          <View style={styles.fieldCard}>
            <TextInput
              style={styles.fieldInput}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="Phone number"
              placeholderTextColor={v3.colors.textPlaceholder}
            />
          </View>

          <Text style={styles.sectionLabel}>DATE OF BIRTH</Text>
          <View style={styles.fieldCard}>
            <TextInput
              style={styles.fieldInput}
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={v3.colors.textPlaceholder}
            />
          </View>

          <Text style={styles.sectionLabel}>ADDRESS</Text>
          <View style={styles.fieldCard}>
            <TextInput
              style={styles.fieldInput}
              value={address}
              onChangeText={setAddress}
              placeholder="Street, area, city"
              placeholderTextColor={v3.colors.textPlaceholder}
            />
          </View>

          <Text style={styles.sectionLabel}>EXPERIENCE</Text>
          <View style={styles.bioCard}>
            <TextInput
              style={styles.bioInput}
              value={experienceSummary}
              onChangeText={setExperienceSummary}
              multiline
              textAlignVertical="top"
              placeholder="Tell us about your work experience and the jobs you have handled."
              placeholderTextColor={v3.colors.textPlaceholder}
            />
          </View>

          <Text style={styles.sectionLabel}>HOURLY RATE</Text>
          <View style={styles.moneyCard}>
            <Text style={styles.currency}>LKR</Text>
            <TextInput
              style={styles.moneyInput}
              value={hourlyRate}
              onChangeText={setHourlyRate}
              keyboardType="numeric"
              placeholder="1500"
              placeholderTextColor={v3.colors.textPlaceholder}
            />
          </View>

          <Text style={styles.sectionLabel}>BIO</Text>
          <View style={styles.bioCard}>
            <TextInput
              style={styles.bioInput}
              value={bio}
              onChangeText={setBio}
              multiline
              textAlignVertical="top"
              placeholder="Tell customers about your experience, skills and the work you do."
              placeholderTextColor={v3.colors.textPlaceholder}
            />
          </View>

          <View style={styles.infoCard}>
            <Shield size={15} color={v3.colors.info} weight="fill" />
            <Text style={styles.infoText}>Only public profile information is shown to customers. Verification documents and account details remain private.</Text>
          </View>

          <TouchableOpacity style={[styles.saveButton, saving && styles.disabled]} activeOpacity={0.78} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={v3.colors.paper} /> : <Text style={styles.saveText}>Save profile</Text>}
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  animated: { flex: 1 },
  topBar: { height: 70, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  placeholder: { width: 38, height: 38 },
  topTitle: { fontSize: 14, fontFamily: fonts.headingBold, color: v3.colors.ink },
  content: { paddingHorizontal: 20, paddingBottom: 34 },
  hero: { marginTop: 8, fontSize: 27, lineHeight: 33, fontFamily: fonts.heading, color: v3.colors.ink, letterSpacing: -0.35 },
  subtitle: { marginTop: 6, maxWidth: 330, fontSize: 10.5, lineHeight: 16, fontFamily: fonts.bodySemiBold, color: v3.colors.textSecondary },
  avatarRow: { minHeight: 82, marginTop: 22, flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#D9D9D9', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 64, height: 64 },
  avatarText: { fontSize: 18, fontFamily: fonts.headingBold, color: v3.colors.ink },
  photoButton: { height: 42, marginLeft: 12, paddingHorizontal: 14, borderRadius: 13, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  photoButtonText: { fontSize: 9.5, fontFamily: fonts.headingBold, color: v3.colors.ink },
  sectionLabel: { marginTop: 22, marginBottom: 8, fontSize: 9, letterSpacing: 0.6, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  fieldCard: { height: 56, borderRadius: 16, paddingHorizontal: 14, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  fieldInput: { flex: 1, paddingVertical: 0, fontSize: 11.5, fontFamily: fonts.bodyMedium, color: v3.colors.ink },
  lockedCard: { backgroundColor: v3.colors.surfaceGray },
  lockedText: { color: v3.colors.textSecondary },
  fieldHint: { marginTop: 5, fontSize: 8.5, lineHeight: 13, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted },
  moneyCard: { height: 56, borderRadius: 16, paddingHorizontal: 14, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  currency: { fontSize: 11, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  moneyInput: { flex: 1, marginLeft: 7, paddingVertical: 0, fontSize: 16, fontFamily: fonts.heading, color: v3.colors.ink },
  bioCard: { minHeight: 120, borderRadius: 16, padding: 14, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line },
  bioInput: { minHeight: 90, padding: 0, fontSize: 11, lineHeight: 18, fontFamily: fonts.bodyMedium, color: v3.colors.ink },
  infoCard: { minHeight: 64, marginTop: 18, borderRadius: 15, padding: 13, backgroundColor: v3.colors.infoSoft, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoText: { flex: 1, fontSize: 8.8, lineHeight: 14, fontFamily: fonts.bodySemiBold, color: '#4F4F4F' },
  saveButton: { height: 54, marginTop: 24, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  saveText: { fontSize: 13, fontFamily: fonts.headingBold, color: v3.colors.paper },
})
