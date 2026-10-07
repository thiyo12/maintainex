import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Image, TextInput } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, CheckCircle, Camera, Image as ImageIcon, CreditCard, Globe, Car, ShieldCheck } from 'phosphor-react-native'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'
import { useColors } from '@/lib/ThemeContext'
import { v2Identity } from '@/api/v2-identity'
import { upload } from '@/api/upload'
import { fonts } from '@/lib/fonts'
import { v3 } from '@/theme/v3/tokens'

export default function IdentityVerificationScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>()
  const isOnboarding = onboarding === '1'
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
        if (isOnboarding) router.replace('/(tasker)')
        else {
          Alert.alert(t('verify.alreadyVerified'), t('verify.alreadyVerified'))
          router.back()
        }
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [isOnboarding])

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
      if (isOnboarding) router.replace('/(auth)/pending-approval')
      else router.back()
    } catch {
      Alert.alert(t('common.error'), t('verify.submitFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loading}><ActivityIndicator size="small" color={v3.colors.ink} /></View>
      </SafeAreaView>
    )
  }

  const UploadBox = ({ side, uri, busy }: { side: 'FRONT' | 'BACK'; uri: string | null; busy: boolean }) => (
    <View style={styles.uploadBox}>
      {uri ? (
        <Image source={{ uri }} style={styles.preview} resizeMode="cover" />
      ) : (
        <View style={styles.uploadPlaceholder}>
          <ImageIcon size={22} color={v3.colors.textMuted} />
          <Text style={styles.uploadPlaceholderTitle}>{side === 'FRONT' ? 'Front of ID' : 'Back of ID'}</Text>
          <Text style={styles.uploadPlaceholderText}>Clear, readable photo</Text>
        </View>
      )}
      <View style={styles.uploadActions}>
        <TouchableOpacity style={styles.uploadAction} activeOpacity={0.72} onPress={() => takePhoto(side)} disabled={busy}>
          <Camera size={15} color={v3.colors.ink} weight="bold" />
          <Text style={styles.uploadActionText}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.uploadAction} activeOpacity={0.72} onPress={() => pickImage(side)} disabled={busy}>
          <ImageIcon size={15} color={v3.colors.ink} weight="bold" />
          <Text style={styles.uploadActionText}>Library</Text>
        </TouchableOpacity>
      </View>
      {busy ? <ActivityIndicator size="small" color={v3.colors.ink} style={styles.uploadSpinner} /> : null}
    </View>
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          {isOnboarding ? (
            <View style={styles.closeButtonPlaceholder} />
          ) : (
            <TouchableOpacity style={styles.closeButton} activeOpacity={0.72} onPress={() => router.back()}>
              <X size={17} color={v3.colors.ink} weight="bold" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerLabel}>{isOnboarding ? 'FINAL REGISTRATION STEP' : 'TRUST & SAFETY'}</Text>
          <View style={styles.closeButtonPlaceholder} />
        </View>

        <View style={styles.trustIcon}>
          <ShieldCheck size={26} color={v3.colors.info} weight="fill" />
        </View>
        <Text style={styles.hero}>Verify your identity</Text>
        <Text style={styles.subtitle}>{isOnboarding ? 'Upload a valid identity document. Your Tasker account will not receive jobs until verification is approved.' : 'A verified identity helps customers trust who is arriving for the job.'}</Text>

        <Text style={styles.sectionLabel}>YOUR LEGAL NAME</Text>
        <View style={styles.fieldCard}>
          <TextInput
            style={styles.nameInput}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Name exactly as shown on your ID"
            placeholderTextColor={v3.colors.textPlaceholder}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        <Text style={styles.sectionLabel}>DOCUMENT</Text>
        <View style={styles.docList}>
          {DOC_TYPES.map((dt) => {
            const selected = docType === dt.key
            return (
              <TouchableOpacity
                key={dt.key}
                style={[styles.docRow, selected && styles.docRowSelected]}
                activeOpacity={0.72}
                onPress={() => setDocType(dt.key)}
              >
                <dt.Icon size={18} color={selected ? v3.colors.ink : v3.colors.textMuted} weight={selected ? 'bold' : 'regular'} />
                <Text style={styles.docText}>{dt.label}</Text>
                {selected ? <CheckCircle size={18} color={v3.colors.success} weight="fill" /> : <View style={styles.radio} />}
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={styles.sectionLabel}>UPLOAD ID</Text>
        <UploadBox side="FRONT" uri={frontUri} busy={uploadingFront} />
        <UploadBox side="BACK" uri={backUri} busy={uploadingBack} />

        <View style={styles.infoCard}>
          <ShieldCheck size={16} color={v3.colors.info} weight="fill" />
          <Text style={styles.infoText}>Your documents are used for verification and are not shown publicly on your Tasker profile.</Text>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, (submitting || uploadingFront || uploadingBack) && styles.disabled]}
          activeOpacity={0.78}
          disabled={submitting || uploadingFront || uploadingBack}
          onPress={handleSubmit}
        >
          {submitting ? <ActivityIndicator size="small" color={v3.colors.paper} /> : <Text style={styles.submitText}>Submit verification</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (_colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  header: { height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  closeButtonPlaceholder: { width: 38, height: 38 },
  headerLabel: { fontSize: 9, letterSpacing: 0.8, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  trustIcon: { width: 48, height: 48, marginTop: 12, borderRadius: 16, backgroundColor: v3.colors.infoSoft, alignItems: 'center', justifyContent: 'center' },
  hero: { marginTop: 14, fontSize: 28, lineHeight: 34, fontFamily: fonts.heading, color: v3.colors.ink, letterSpacing: -0.4 },
  subtitle: { marginTop: 7, maxWidth: 320, fontSize: 10.5, lineHeight: 16, fontFamily: fonts.bodySemiBold, color: v3.colors.textSecondary },
  sectionLabel: { marginTop: 26, marginBottom: 8, fontSize: 9, letterSpacing: 0.6, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  fieldCard: { height: 54, borderRadius: 15, paddingHorizontal: 15, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, justifyContent: 'center' },
  nameInput: { fontSize: 12, paddingVertical: 0, fontFamily: fonts.bodyMedium, color: v3.colors.ink },
  docList: { gap: 8 },
  docRow: { height: 54, paddingHorizontal: 14, borderRadius: 15, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center', gap: 10 },
  docRowSelected: { borderColor: v3.colors.ink },
  docText: { flex: 1, fontSize: 11, fontFamily: fonts.headingBold, color: v3.colors.ink },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: v3.colors.line },
  uploadBox: { minHeight: 150, marginBottom: 10, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, overflow: 'hidden' },
  uploadPlaceholder: { height: 100, alignItems: 'center', justifyContent: 'center' },
  uploadPlaceholderTitle: { marginTop: 8, fontSize: 10.5, fontFamily: fonts.headingBold, color: v3.colors.ink },
  uploadPlaceholderText: { marginTop: 2, fontSize: 8.5, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted },
  preview: { width: '100%', height: 100 },
  uploadActions: { height: 48, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 8 },
  uploadAction: { flex: 1, height: 34, borderRadius: 11, backgroundColor: v3.colors.surfaceGray, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  uploadActionText: { fontSize: 9.5, fontFamily: fonts.headingBold, color: v3.colors.ink },
  uploadSpinner: { position: 'absolute', top: 44, left: 0, right: 0 },
  infoCard: { minHeight: 70, marginTop: 12, padding: 13, borderRadius: 15, backgroundColor: v3.colors.infoSoft, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  infoText: { flex: 1, fontSize: 8.8, lineHeight: 14, fontFamily: fonts.bodySemiBold, color: '#4F4F4F' },
  submitButton: { height: 54, marginTop: 24, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.55 },
  submitText: { fontSize: 13, fontFamily: fonts.headingBold, color: v3.colors.paper },
})
