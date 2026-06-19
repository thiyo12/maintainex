import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../lib/ThemeContext'
import { v2Identity } from '../../lib/api-v2'
import { upload } from '../../lib/api'

const DOC_TYPES = [
  { key: 'NATIONAL_ID', label: 'National ID Card', icon: 'id-card-outline' },
  { key: 'PASSPORT', label: 'Passport', icon: 'earth-outline' },
  { key: 'DRIVERS_LICENSE', label: "Driver's License", icon: 'car-outline' },
]

export default function IdentityVerificationScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [docType, setDocType] = useState<string | null>(null)
  const [frontUri, setFrontUri] = useState<string | null>(null)
  const [backUri, setBackUri] = useState<string | null>(null)
  const [uploadingFront, setUploadingFront] = useState(false)
  const [uploadingBack, setUploadingBack] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    v2Identity.getStatus().then((data: any) => {
      if (data.identityStatus === 'APPROVED') {
        Alert.alert('Already Verified', 'Your identity has already been verified.')
        router.back()
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const pickImage = async (side: 'FRONT' | 'BACK') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Allow access to your photo library to upload an image.')
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
      Alert.alert('Permission Required', 'Allow access to your camera to take a photo.')
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
      Alert.alert('Upload Failed', 'Could not upload image. Please try again.')
    } finally {
      if (side === 'FRONT') setUploadingFront(false)
      else setUploadingBack(false)
    }
  }

  const handleSubmit = async () => {
    if (!docType) {
      Alert.alert('Error', 'Please select a document type')
      return
    }
    if (!frontUri) {
      Alert.alert('Error', 'Please take or upload a photo of the front of your ID')
      return
    }
    setSubmitting(true)
    try {
      await v2Identity.uploadDocument(docType, 'FRONT', frontUri)
      if (backUri) {
        await v2Identity.uploadDocument(docType, 'BACK', backUri)
      }
      Alert.alert('Submitted', 'Your documents are under review. This usually takes 1-2 business days.')
      router.back()
    } catch {
      Alert.alert('Error', 'Failed to submit documents. Please try again.')
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
          <Text style={styles.sectionTitle}>Select Document Type</Text>
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
          <Text style={styles.sectionTitle}>Front of ID</Text>
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
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          ) : (
            <View style={styles.imageActions}>
              <TouchableOpacity style={styles.imageBtn} onPress={() => takePhoto('FRONT')} activeOpacity={0.7}>
                <Ionicons name="camera-outline" size={24} color={colors.amber} />
                <Text style={styles.imageBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imageBtn} onPress={() => pickImage('FRONT')} activeOpacity={0.7}>
                <Ionicons name="image-outline" size={24} color={colors.amber} />
                <Text style={styles.imageBtnText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Back of ID (optional)</Text>
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
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          ) : (
            <View style={styles.imageActions}>
              <TouchableOpacity style={styles.imageBtn} onPress={() => takePhoto('BACK')} activeOpacity={0.7}>
                <Ionicons name="camera-outline" size={24} color={colors.amber} />
                <Text style={styles.imageBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imageBtn} onPress={() => pickImage('BACK')} activeOpacity={0.7}>
                <Ionicons name="image-outline" size={24} color={colors.amber} />
                <Text style={styles.imageBtnText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.note}>Upload a clear, well-lit photo of your ID. All information must be visible and legible.</Text>

        <TouchableOpacity
          style={[styles.submitBtn, (!docType || !frontUri || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!docType || !frontUri || submitting}
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
  submitBtn: { backgroundColor: colors.amber, marginHorizontal: 20, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: colors.ink },
})
