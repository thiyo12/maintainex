import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, ScrollView, StyleSheet, Alert, ActivityIndicator, Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Camera, ShieldCheck, CheckCircle, CalendarBlank } from 'phosphor-react-native'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '../../../lib/auth'
import { auth, upload } from '../../../lib/api'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import PressableScale from '../../../components/ui/PressableScale'

const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const
const LANGUAGES = ['EN', 'TA', 'SI'] as const

export default function EditProfileScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user, refreshUser } = useAuth()

  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [profileImage, setProfileImage] = useState(user?.profileImage || '')
  const [birthday, setBirthday] = useState(user?.birthday || '')
  const [gender, setGender] = useState<string | undefined>(user?.gender)
  const [language, setLanguage] = useState<string | undefined>(user?.language)
  const [emergencyContact, setEmergencyContact] = useState(user?.emergencyContact || '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name ?? '')
      setPhone(user.phone ?? '')
      setProfileImage(user.profileImage ?? '')
      setBirthday(user.birthday ?? '')
      setGender(user.gender)
      setLanguage(user.language ?? 'EN')
      setEmergencyContact(user.emergencyContact ?? '')
    }
  }, [user])

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('common.error'), t('common.permissionDenied'))
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
    })
    if (!result.canceled && result.assets[0]) {
      setUploading(true)
      try {
        const { url } = await upload.file(result.assets[0].uri)
        setProfileImage(url)
      } catch {
        Alert.alert(t('common.error'), t('errors.upload'))
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
    if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      Alert.alert(t('common.error'), t('profile.dobPlaceholder'))
      return
    }
    setSaving(true)
    try {
      const res = await auth.updateProfile({
        name: name.trim(),
        phone,
        profileImage: profileImage || undefined,
        birthday: birthday || undefined,
        gender,
        language,
        emergencyContact,
      })
      await refreshUser()
      Alert.alert(t('common.success'), t('common.success'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ])
      void res
    } catch (e: any) {
      let msg = t('errors.generic')
      try {
        msg = JSON.parse(e.message).error || msg
      } catch {}
      Alert.alert(t('common.error'), msg)
    } finally {
      setSaving(false)
    }
  }

  const showCooldown = (() => {
    if (!user?.lastNameChangedAt) return null
    const daysSinceChange = Math.floor((Date.now() - new Date(user.lastNameChangedAt).getTime()) / 86400000)
    if (daysSinceChange >= 30) return null
    const availableAt = new Date(user.lastNameChangedAt)
    availableAt.setDate(availableAt.getDate() + 30)
    return { availableAt }
  })()

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <PressableScale onPress={pickImage} scaleTo={0.96} style={styles.avatarWrap}>
        <View style={styles.avatar}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{(name || 'U').charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.cameraBadge}>
          {uploading ? (
            <ActivityIndicator size="small" color="#0D0D0D" />
          ) : (
            <Camera size={16} color="#0D0D0D" weight="fill" />
          )}
        </View>
        <Text style={styles.changePhotoText}>{t('common.edit')}</Text>
      </PressableScale>

      <View style={styles.card}>
        <Text style={styles.label}>{t('profile.fullName')}</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t('profile.fullName')} placeholderTextColor="#6F6B6B" />
        {showCooldown ? (
          <Text style={styles.cooldown}>
            {t('profile.nameCooldown', { date: showCooldown.availableAt.toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' }) })}
          </Text>
        ) : null}

        <Text style={styles.label}>{t('profile.email')}</Text>
        <View style={[styles.input, styles.lockedInput]}>
          <Text style={styles.lockedText}>{user?.email}</Text>
          <CheckCircle size={16} color="#F5A623" weight="fill" />
        </View>

        <Text style={styles.label}>{t('profile.phone')}</Text>
        <View>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder={t('profile.phone')} placeholderTextColor="#6F6B6B" />
          {phone && user?.phoneVerified ? (
            <View style={styles.verifiedRow}>
              <ShieldCheck size={14} color="#34D399" weight="fill" />
              <Text style={styles.verifiedText}>{t('profile.phoneVerified')}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.label}>{t('profile.dob')}</Text>
        <View>
          <TextInput
            style={[styles.input, { paddingLeft: 42 }]}
            value={birthday}
            onChangeText={setBirthday}
            placeholder={t('profile.dobPlaceholder')}
            placeholderTextColor="#6F6B6B"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          <CalendarBlank size={18} color="#6F6B6B" style={styles.fieldIcon} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('profile.gender')}</Text>
        <View style={styles.segmentRow}>
          {GENDERS.map((g) => {
            const active = gender === g
            return (
              <PressableScale key={g} onPress={() => setGender(g)} scaleTo={0.96} style={[styles.segment, active && styles.segmentActive]}>
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{t(`profile.gender${g.charAt(0) + g.slice(1).toLowerCase()}`)}</Text>
              </PressableScale>
            )
          })}
        </View>

        <Text style={styles.sectionTitle}>{t('profile.preferredLanguage')}</Text>
        <View style={styles.segmentRow}>
          {LANGUAGES.map((lg) => {
            const active = language === lg
            return (
              <PressableScale key={lg} onPress={() => setLanguage(lg)} scaleTo={0.96} style={[styles.segment, active && styles.segmentActive]}>
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{lg}</Text>
              </PressableScale>
            )
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t('profile.emergencyContact')}</Text>
        <TextInput style={styles.input} value={emergencyContact} onChangeText={setEmergencyContact} keyboardType="phone-pad" placeholder={t('profile.emergencyPlaceholder')} placeholderTextColor="#6F6B6B" />
      </View>

      <PressableScale onPress={handleSave} disabled={saving} scaleTo={0.97} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
        {saving ? (
          <ActivityIndicator color="#0D0D0D" />
        ) : (
          <Text style={styles.saveBtnText}>{t('common.saveChanges')}</Text>
        )}
      </PressableScale>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  content: { padding: 18, paddingBottom: 40 },

  avatarWrap: { alignItems: 'center', marginBottom: 32 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#FFF1D2', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F5A623' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 44 },
  avatarText: { fontSize: 36, fontFamily: 'Outfit_700Bold', color: '#F5A623' },
  cameraBadge: {
    position: 'absolute', bottom: -2, right: '38%',
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#F5A623',
    alignItems: 'center', justifyContent: 'center',
  },
  changePhotoText: { color: '#F5A623', fontSize: 13, fontFamily: 'Outfit_600SemiBold', marginTop: 10 },

  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#2E2E2E', borderRadius: 18, padding: 18, marginBottom: 16 },
  sectionTitle: { color: '#6F6B6B', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'Outfit_700Bold', marginBottom: 12, fontSize: 11 },

  label: { color: '#6F6B6B', marginBottom: 8, marginTop: 6, fontSize: 13, fontFamily: 'Outfit_600SemiBold' },
  input: {
    backgroundColor: '#2E2E2E', borderWidth: 1, borderColor: '#2E2E2E',
    borderRadius: 12, padding: 14, fontSize: 15, color: '#FFFFFF',
    fontFamily: 'Outfit_500Medium', marginBottom: 14,
  },
  lockedInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lockedText: { fontSize: 15, color: '#6F6B6B', fontFamily: 'Outfit_500Medium' },
  cooldown: { fontSize: 11, color: '#F87171', marginTop: -8, marginBottom: 6, fontFamily: 'Outfit_400Regular' },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  verifiedText: { fontSize: 12, color: '#34D399', fontFamily: 'Outfit_500Medium' },
  fieldIcon: { position: 'absolute', left: 14, top: 15 },

  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  segment: {
    flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#2E2E2E',
    backgroundColor: '#2E2E2E', alignItems: 'center',
  },
  segmentActive: { backgroundColor: '#F5A623', borderColor: '#F5A623' },
  segmentText: { fontSize: 13, fontFamily: 'Outfit_600SemiBold', color: '#6F6B6B' },
  segmentTextActive: { color: '#0D0D0D' },

  saveBtn: {
    backgroundColor: '#F5A623', borderRadius: 18, paddingVertical: 16,
    alignItems: 'center', marginTop: 14,
  },
  saveBtnText: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: '#0D0D0D' },
})
