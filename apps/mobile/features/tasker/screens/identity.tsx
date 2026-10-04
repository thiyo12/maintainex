import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Image, TextInput } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'
import { useColors } from '@/lib/ThemeContext'
import { v2Identity } from '@/api/v2-identity'
import { upload } from '@/api/upload'

export default function IdentityVerificationScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { t } = useTranslation()
  const DOC_TYPES = [
    { key: 'NATIONAL_ID', label: t('verify.nationalIdCard'), icon: 'id-card-outline' },
    { key: 'PASSPORT', label: t('verify.passport'), icon: 'earth-outline' },
    { key: 'DRIVERS_LICENSE', label: t('verify.driversLicense'), icon: 'car-outline' },
  ]
  const [loading, setLoading] = useState(true)
  const [docType, setDocType] = useState<string | null>(null)
  const [frontUri, setFrontUri] = useState<string | null>(null)
  const [backUri, setBackUri] = useState<string | null>(null)
  const [uploadingFront, setUploadingFront] = useState(false)
  const [uploadingBack, setUploadingBack] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fullName, setFullName] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')

  useEffect(() => {
    v2Identity.getStatus().then((data: any) => {
      if (data.identityStatus === 'APPROVED' || data.identityStatus === 'VERIFIED') {
        Alert.alert(t('verify.alreadyVerified'), t('verify.alreadyVerified'))
        router.back()
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const pickImage = async (side: 'FRONT' | 'BACK') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('verify.permissionRequired'), t('verify.permissionRequired'))
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    })
    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri, side)
    }
  }

  const takePhoto = async (side: 'FRONT' | 'BACK') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('verify.permissionRequired'), t('verify.permissionRequired'))
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    })
    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri, side)
    }
  }

  const uploadImage = async (uri: string, side: 'FRONT' | 'BACK') => {
    if (side === 'FRONT') setUploadingFront(true)
    else setUploadingBack(true)
    try {
      const { url } = await upload.file(uri)
      if (side === 'FRONT') setFrontUri(url)
      else setBackUri(url)
    } catch {
      Alert.alert(t('verify.uploadFailed'), t('verify.uploadFailed'))
    } finally {
      if (side === 'FRONT') setUploadingFront(false)
      else setUploadingBack(false)
    }
  }

  const handleSubmit = async () => {
    if (!docType) {
      Alert.alert(t('common.error'), t('verify.selectDocType'))
      return
    }
    if (!fullName.trim()) {
      Alert.alert(t('common.error'), t('verify.enterFullName'))
      return
    }
    if (!documentNumber.trim()) {
      Alert.alert(t('common.error'), 'Enter the document number exactly as shown on your ID.')
      return
    }
    if (!frontUri) {
      Alert.alert(t('common.error'), t('verify.uploadPhotoFront'))
      return
    }
    setSubmitting(true)
    try {
      const frontResult = await v2Identity.uploadDocument(
        docType,
        'FRONT',
        frontUri,
        fullName.trim(),
        documentNumber.trim(),
      )
      if (backUri) {
        await v2Identity.uploadDocument(
          docType,
          'BACK',
          backUri,
          fullName.trim(),
          documentNumber.trim(),
        )
      }
      if (frontResult.integrityReviewRequired) {
        Alert.alert(
          'Additional identity review required',
          'MaintainEX found an identity match that requires Trust & Safety review before verification can be completed.'
        )
        router.back()
        return
      }
      Alert.alert(t('common.success'), t('verify.underReview'))
      router.back()
    } catch {
      Alert.alert(t('common.error'), t('verify.submitFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('verify.title')}</Text>
          <View style={{ width: 24 }} />
        </View>

        <Text style={styles.subtitle}>{t('verify.subtitle')}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('verify.fullNameLabel')}</Text>
          <TextInput
            style={styles.nameInput}
            value={fullName}
            onChangeText={setFullName}
            placeholder={t('verify.fullNamePlaceholder')}
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <Text style={styles.note}>{t('verify.fullNameHint')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Document number</Text>
          <TextInput
            style={styles.nameInput}
            value={documentNumber}
            onChangeText={setDocumentNumber}
            placeholder="NIC / passport / licence number"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Text style={styles.inlineNote}>
            Used only to create a protected identity-match hash. MaintainEX does not expose this number in provider profiles or duplicate-match APIs.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('verify.selectDocumentType')}</Text>
          {DOC_TYPES.map((dt) => (
            <TouchableOpacity
              key={dt.key}
              style={[styles.docOption, docType === dt.key && styles.docOptionSelected]}
              onPress={() => setDocType(dt.key)}
              activeOpacity={0.7}
            >
              <Ionicons name={dt.icon as any} size={22} color={docType === dt.key ? colors.amber : colors.muted} />
              <Text style={[styles.docLabel, docType === dt.key && styles.docLabelSelected]}>{dt.label}</Text>
              {docType === dt.key && <Ionicons name="checkmark-circle" size={20} color={colors.amber} />}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('verify.frontOfId')}</Text>
          {frontUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: frontUri }} style={styles.preview} resizeMode="cover" />
              <TouchableOpacity style={styles.retakeBtn} onPress={() => setFrontUri(null)}>
                <Ionicons name="close-circle" size={22} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ) : uploadingFront ? (
            <View style={styles.uploadingBox}>
              <ActivityIndicator size="small" color={colors.amber} />
              <Text style={styles.uploadingText}>{t('verify.uploading')}</Text>
            </View>
          ) : (
            <View style={styles.imageActions}>
              <TouchableOpacity style={styles.imageBtn} onPress={() => takePhoto('FRONT')} activeOpacity={0.7}>
                <Ionicons name="camera-outline" size={24} color={colors.amber} />
                <Text style={styles.imageBtnText}>{t('verify.camera')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imageBtn} onPress={() => pickImage('FRONT')} activeOpacity={0.7}>
                <Ionicons name="image-outline" size={24} color={colors.amber} />
                <Text style={styles.imageBtnText}>{t('verify.gallery')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('verify.backOfId')}</Text>
          {backUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: backUri }} style={styles.preview} resizeMode="cover" />
              <TouchableOpacity style={styles.retakeBtn} onPress={() => setBackUri(null)}>
                <Ionicons name="close-circle" size={22} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ) : uploadingBack ? (
            <View style={styles.uploadingBox}>
              <ActivityIndicator size="small" color={colors.amber} />
              <Text style={styles.uploadingText}>{t('verify.uploading')}</Text>
            </View>
          ) : (
            <View style={styles.imageActions}>
              <TouchableOpacity style={styles.imageBtn} onPress={() => takePhoto('BACK')} activeOpacity={0.7}>
                <Ionicons name="camera-outline" size={24} color={colors.amber} />
                <Text style={styles.imageBtnText}>{t('verify.camera')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imageBtn} onPress={() => pickImage('BACK')} activeOpacity={0.7}>
                <Ionicons name="image-outline" size={24} color={colors.amber} />
                <Text style={styles.imageBtnText}>{t('verify.gallery')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.note}>{t('verify.uploadNote')}</Text>

        <TouchableOpacity
          style={[styles.submitBtn, (!docType || !frontUri || !documentNumber.trim() || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!docType || !frontUri || !documentNumber.trim() || submitting}
          activeOpacity={0.7}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>{t('verify.submit')}</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 14, color: colors.muted, paddingHorizontal: 20, marginBottom: 24, lineHeight: 20 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 12 },
  nameInput: {
    backgroundColor: colors.white, borderRadius: 12, padding: 14, fontSize: 15,
    color: colors.ink, borderWidth: 1.5, borderColor: colors.border, marginBottom: 8,
  },
  docOption: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
    padding: 16, borderRadius: 12, marginBottom: 8,
    borderWidth: 1.5, borderColor: colors.border,
  },
  docOptionSelected: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  docLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink, marginLeft: 12 },
  docLabelSelected: { color: colors.amberDark },
  imageActions: { flexDirection: 'row', gap: 12 },
  imageBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.white, padding: 16, borderRadius: 12, gap: 8,
    borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
  },
  imageBtnText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  previewWrap: { position: 'relative' },
  preview: { width: '100%', height: 180, borderRadius: 12, backgroundColor: colors.lightGray },
  retakeBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: colors.white, borderRadius: 12, padding: 2 },
  uploadingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, padding: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, gap: 10 },
  uploadingText: { fontSize: 14, color: colors.muted },
  note: { fontSize: 12, color: colors.muted, paddingHorizontal: 20, marginBottom: 16, lineHeight: 18, fontStyle: 'italic' },
  inlineNote: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 18 },
  submitBtn: { backgroundColor: colors.amber, marginHorizontal: 20, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: colors.ink },
})
