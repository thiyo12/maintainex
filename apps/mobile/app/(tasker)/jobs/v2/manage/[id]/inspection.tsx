import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Image } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Camera, Image as ImageIcon, XCircle, CaretLeft, CheckCircle } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { fonts } from '../../../../../../lib/fonts'
import { v2Inspection } from '../../../../../../lib/api-v2'
import { upload } from '../../../../../../lib/api'
import * as ImagePicker from 'expo-image-picker'
import { v3 } from '../../../../../../theme/v3/tokens'

export default function InspectionScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [findings, setFindings] = useState('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const addPhoto = async (useCamera: boolean) => {
    const { status } = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('common.error'), t('inspection.permissionRequired'))
      return
    }
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true })

    if (!result.canceled && result.assets[0]) {
      setUploading(true)
      try {
        const { url } = await upload.file(result.assets[0].uri)
        setPhotos((prev) => [...prev, url])
      } catch {
        Alert.alert(t('common.error'), t('errors.upload'))
      } finally {
        setUploading(false)
      }
    }
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!findings.trim()) {
      Alert.alert(t('common.error'), t('inspection.findingsRequired'))
      return
    }
    setSubmitting(true)
    try {
      await v2Inspection.create(id, {})
      Alert.alert(t('inspection.submitted'), t('inspection.submittedDesc'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ])
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || t('errors.generic'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.72} onPress={() => router.back()}>
          <CaretLeft size={17} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Inspection checklist</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>BEFORE SUBMITTING</Text>
        <Text style={styles.hero}>Check the work first</Text>
        <Text style={styles.subtitle}>Document what you found and keep evidence with the job record.</Text>

        <View style={styles.checkList}>
          {['Scope checked', 'Customer request reviewed', 'Work area documented'].map((label) => (
            <View key={label} style={styles.checkRow}>
              <View style={styles.checkIcon}><CheckCircle size={17} color={v3.colors.success} weight="fill" /></View>
              <Text style={styles.checkText}>{label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>FINDINGS</Text>
        <View style={styles.fieldCard}>
          <TextInput
            style={styles.textArea}
            value={findings}
            onChangeText={setFindings}
            placeholder="What did you inspect or diagnose?"
            placeholderTextColor={v3.colors.textPlaceholder}
            multiline
            textAlignVertical="top"
          />
        </View>

        <Text style={styles.sectionLabel}>PHOTOS</Text>
        <View style={styles.photoActions}>
          <TouchableOpacity style={styles.photoAction} activeOpacity={0.72} onPress={() => addPhoto(true)}>
            <Camera size={17} color={v3.colors.ink} weight="bold" />
            <Text style={styles.photoActionText}>Take photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoAction} activeOpacity={0.72} onPress={() => addPhoto(false)}>
            <ImageIcon size={17} color={v3.colors.ink} weight="bold" />
            <Text style={styles.photoActionText}>Library</Text>
          </TouchableOpacity>
        </View>

        {uploading ? <ActivityIndicator size="small" color={v3.colors.ink} style={styles.spinner} /> : null}

        {photos.length > 0 ? (
          <View style={styles.photoGrid}>
            {photos.map((uri, index) => (
              <View key={uri + index} style={styles.photoWrap}>
                <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
                <TouchableOpacity style={styles.removePhoto} onPress={() => removePhoto(index)}>
                  <XCircle size={18} color={v3.colors.error} weight="fill" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>NOTES</Text>
        <View style={styles.fieldCard}>
          <TextInput
            style={styles.textArea}
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes for the job record."
            placeholderTextColor={v3.colors.textPlaceholder}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.infoCard}>
          <CheckCircle size={16} color={v3.colors.info} weight="fill" />
          <Text style={styles.infoText}>Submitting records the inspection on this MaintainEX job before customer approval.</Text>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, (submitting || !findings.trim()) && styles.disabled]}
          activeOpacity={0.78}
          disabled={submitting || !findings.trim()}
          onPress={handleSubmit}
        >
          {submitting ? <ActivityIndicator size="small" color={v3.colors.paper} /> : <Text style={styles.submitText}>Submit for customer approval</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  topBar: { height: 70, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  placeholder: { width: 38, height: 38 },
  topTitle: { fontSize: 14, fontFamily: fonts.headingBold, color: v3.colors.ink },
  content: { paddingHorizontal: 20, paddingBottom: 34 },
  eyebrow: { marginTop: 10, fontSize: 9, letterSpacing: 0.7, fontFamily: fonts.headingBold, color: v3.colors.amberDark },
  hero: { marginTop: 6, fontSize: 27, lineHeight: 33, fontFamily: fonts.heading, color: v3.colors.ink, letterSpacing: -0.35 },
  subtitle: { marginTop: 6, maxWidth: 320, fontSize: 10.5, lineHeight: 16, fontFamily: fonts.bodySemiBold, color: v3.colors.textSecondary },
  checkList: { marginTop: 22, borderRadius: 17, paddingHorizontal: 13, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line },
  checkRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: v3.colors.line },
  checkIcon: { width: 30, alignItems: 'center' },
  checkText: { marginLeft: 6, fontSize: 10.5, fontFamily: fonts.headingBold, color: v3.colors.ink },
  sectionLabel: { marginTop: 23, marginBottom: 8, fontSize: 9, letterSpacing: 0.6, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  fieldCard: { minHeight: 100, borderRadius: 16, padding: 13, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line },
  textArea: { minHeight: 72, padding: 0, fontSize: 11, lineHeight: 17, fontFamily: fonts.bodyMedium, color: v3.colors.ink },
  photoActions: { flexDirection: 'row', gap: 8 },
  photoAction: { flex: 1, height: 50, borderRadius: 15, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  photoActionText: { fontSize: 9.5, fontFamily: fonts.headingBold, color: v3.colors.ink },
  spinner: { marginTop: 12 },
  photoGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoWrap: { width: 78, height: 78, borderRadius: 13, overflow: 'hidden', backgroundColor: v3.colors.surfaceGray },
  photo: { width: '100%', height: '100%' },
  removePhoto: { position: 'absolute', top: 3, right: 3 },
  infoCard: { minHeight: 60, marginTop: 18, borderRadius: 15, padding: 13, backgroundColor: v3.colors.infoSoft, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoText: { flex: 1, fontSize: 8.8, lineHeight: 14, fontFamily: fonts.bodySemiBold, color: '#4F4F4F' },
  submitButton: { minHeight: 54, marginTop: 24, paddingHorizontal: 14, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.42 },
  submitText: { fontSize: 12, fontFamily: fonts.headingBold, color: v3.colors.paper, textAlign: 'center' },
})
