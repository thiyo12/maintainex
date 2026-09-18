import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Image, TextInput } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, CheckCircle, Camera, Image as ImageIcon, CreditCard, Globe, Car } from 'phosphor-react-native'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../lib/ThemeContext'
import { v2Identity } from '../../lib/api-v2'
import { upload } from '../../lib/api'

export default function IdentityVerificationScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { t } = useTranslation()
  const DOC_TYPES = [
    { key: 'NATIONAL_ID', label: t('verify.nationalIdCard'), Icon: CreditCard },
    { key: 'PASSPORT', label: t('verify.passport'), Icon: Globe },
    { key: 'DRIVERS_LICENSE', label: t('verify.driversLicense'), Icon: Car },
  ]
  const [loading, setLoading] = useState(true)
  const [docType, setDocType] = useState<string | null>(null)
  const [frontUri, setFrontUri] = useState<string | null>(null)
  const [backUri, setBackUri] = useState<string | null>(null)
  const [uploadingFront, setUploadingFront] = useState(false)
  const [uploadingBack, setUploadingBack] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fullName, setFullName] = useState('')

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
    if (!frontUri) {
      Alert.alert(t('common.error'), t('verify.uploadPhotoFront'))
      return
    }
    setSubmitting(true)
    try {
      await v2Identity.uploadDocument(docType, 'FRONT', frontUri, fullName.trim())
      if (backUri) {
        await v2Identity.uploadDocument(docType, 'BACK', backUri, fullName.trim())
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
        <ActivityIndicator size="large" color="#F5A623" style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <X size={24} color="#000000" weight="bold" />
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
            placeholderTextColor="#6F6B6B"
            autoCapitalize="words"
            autoCorrect={false}
          />
          <Text style={styles.note}>{t('verify.fullNameHint')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('verify.selectDocumentType')}</Text>
          {DOC_TYPES.map((dt) => {
            const isSelected = docType === dt.key
            return (
              <TouchableOpacity
                key={dt.key}
                style={[styles.docOption, isSelected && styles.docOptionSelected]}
                onPress={() => setDocType(dt.key)}
                activeOpacity={0.7}
              >
                <dt.Icon size={22} color={isSelected ? '#F5A623' : '#6F6B6B'} weight={isSelected ? 'fill' : 'regular'} />
                <Text style={[styles.docLabel, isSelected && styles.docLabelSelected]}>{dt.label}</Text>
                {isSelected && <CheckCircle size={20} color="#F5A623" weight="fill" />}
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('verify.frontOfId')}</Text>
          {frontUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: frontUri }} style={styles.preview} resizeMode="cover" />
              <TouchableOpacity style={styles.retakeBtn} onPress={() => setFrontUri(null)}>
                <X size={22} color="#EF4444" weight="bold" />
              </TouchableOpacity>
            </View>
          ) : uploadingFront ? (
            <View style={styles.uploadingBox}>
              <ActivityIndicator size="small" color="#F5A623" />
              <Text style={styles.uploadingText}>{t('verify.uploading')}</Text>
            </View>
          ) : (
            <View style={styles.imageActions}>
              <TouchableOpacity style={styles.imageBtn} onPress={() => takePhoto('FRONT')} activeOpacity={0.7}>
                <Camera size={24} color="#F5A623" weight="regular" />
                <Text style={styles.imageBtnText}>{t('verify.camera')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imageBtn} onPress={() => pickImage('FRONT')} activeOpacity={0.7}>
                <ImageIcon size={24} color="#F5A623" weight="regular" />
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
                <X size={22} color="#EF4444" weight="bold" />
              </TouchableOpacity>
            </View>
          ) : uploadingBack ? (
            <View style={styles.uploadingBox}>
              <ActivityIndicator size="small" color="#F5A623" />
              <Text style={styles.uploadingText}>{t('verify.uploading')}</Text>
            </View>
          ) : (
            <View style={styles.imageActions}>
              <TouchableOpacity style={styles.imageBtn} onPress={() => takePhoto('BACK')} activeOpacity={0.7}>
                <Camera size={24} color="#F5A623" weight="regular" />
                <Text style={styles.imageBtnText}>{t('verify.camera')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imageBtn} onPress={() => pickImage('BACK')} activeOpacity={0.7}>
                <ImageIcon size={24} color="#F5A623" weight="regular" />
                <Text style={styles.imageBtnText}>{t('verify.gallery')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.note}>{t('verify.uploadNote')}</Text>

        <TouchableOpacity
          style={[styles.submitBtn, (!docType || !frontUri || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!docType || !frontUri || submitting}
          activeOpacity={0.7}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
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
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#000000' },
  subtitle: { fontSize: 14, color: '#6F6B6B', paddingHorizontal: 20, marginBottom: 24, lineHeight: 20 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#000000', marginBottom: 12 },
  nameInput: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, fontSize: 15,
    color: '#000000', borderWidth: 1.5, borderColor: '#E5E5E5', marginBottom: 8,
  },
  docOption: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    padding: 16, borderRadius: 12, marginBottom: 8,
    borderWidth: 1.5, borderColor: '#E5E5E5',
  },
  docOptionSelected: { borderColor: '#F5A623', backgroundColor: '#FFF1D2' },
  docLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#000000', marginLeft: 12 },
  docLabelSelected: { color: '#D4900A' },
  imageActions: { flexDirection: 'row', gap: 12 },
  imageBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, gap: 8,
    borderWidth: 1.5, borderColor: '#E5E5E5', borderStyle: 'dashed',
  },
  imageBtnText: { fontSize: 15, fontWeight: '600', color: '#000000' },
  previewWrap: { position: 'relative' },
  preview: { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#2E2E2E' },
  retakeBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 2 },
  uploadingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', padding: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E5E5', gap: 10 },
  uploadingText: { fontSize: 14, color: '#6F6B6B' },
  note: { fontSize: 12, color: '#6F6B6B', paddingHorizontal: 20, marginBottom: 16, lineHeight: 18, fontStyle: 'italic' },
  submitBtn: { backgroundColor: '#F5A623', marginHorizontal: 20, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#000000' },
})
