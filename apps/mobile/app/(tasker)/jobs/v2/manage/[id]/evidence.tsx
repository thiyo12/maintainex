import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Image } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Camera, Image as ImageIcon, XCircle, Images, CaretLeft } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../../../../lib/ThemeContext'
import { fonts } from '../../../../../../lib/fonts'
import { upload } from '../../../../../../lib/api'
import { v2Evidence } from '../../../../../../lib/api-v2'
import * as ImagePicker from 'expo-image-picker'
import { v3 } from '../../../../../../theme/v3/tokens'

export default function EvidenceScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [photos, setPhotos] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const addPhoto = async (useCamera: boolean) => {
    const { status } = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('common.error'), t('evidence.permissionRequired'))
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
    if (photos.length === 0) {
      Alert.alert(t('common.error'), t('evidence.atLeastOnePhoto'))
      return
    }
    setSubmitting(true)
    try {
      for (const photoUrl of photos) {
        await v2Evidence.create(id, {
          evidenceType: 'PHOTO',
          url: photoUrl,
          description: notes.trim() || undefined,
          mimeType: 'image/jpeg',
        })
      }
      Alert.alert(t('evidence.submitted'), t('evidence.submittedDesc'), [
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
        <Text style={styles.topTitle}>Evidence</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.hero}>Show the work clearly</Text>
        <Text style={styles.subtitle}>Add before and after photos so the job record is easy to verify.</Text>

        <View style={styles.photoPair}>
          {[0, 1].map((index) => {
            const uri = photos[index]
            const label = index === 0 ? 'BEFORE' : 'AFTER'
            return (
              <View key={label} style={styles.slotWrap}>
                <Text style={styles.slotLabel}>{label}</Text>
                {uri ? (
                  <View style={styles.photoSlot}>
                    <Image source={{ uri }} style={styles.slotImage} resizeMode="cover" />
                    <TouchableOpacity style={styles.removeButton} onPress={() => removePhoto(index)}>
                      <XCircle size={20} color={v3.colors.error} weight="fill" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.emptySlot} activeOpacity={0.72} onPress={() => addPhoto(true)}>
                    <Camera size={23} color={v3.colors.ink} weight="bold" />
                    <Text style={styles.emptySlotTitle}>Take photo</Text>
                    <Text style={styles.emptySlotText}>{index === 0 ? 'Before work' : 'After work'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          })}
        </View>

        <View style={styles.sourceRow}>
          <TouchableOpacity style={styles.sourceButton} activeOpacity={0.72} onPress={() => addPhoto(true)} disabled={uploading}>
            <Camera size={15} color={v3.colors.ink} />
            <Text style={styles.sourceText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sourceButton} activeOpacity={0.72} onPress={() => addPhoto(false)} disabled={uploading}>
            <ImageIcon size={15} color={v3.colors.ink} />
            <Text style={styles.sourceText}>Library</Text>
          </TouchableOpacity>
        </View>

        {uploading ? (
          <View style={styles.uploadingRow}>
            <ActivityIndicator size="small" color={v3.colors.ink} />
            <Text style={styles.uploadingText}>Uploading photo…</Text>
          </View>
        ) : null}

        {photos.length > 2 ? (
          <>
            <Text style={styles.sectionLabel}>MORE PHOTOS</Text>
            <View style={styles.extraGrid}>
              {photos.slice(2).map((uri, offset) => {
                const index = offset + 2
                return (
                  <View key={uri + index} style={styles.extraPhoto}>
                    <Image source={{ uri }} style={styles.extraImage} resizeMode="cover" />
                    <TouchableOpacity style={styles.extraRemove} onPress={() => removePhoto(index)}>
                      <XCircle size={18} color={v3.colors.error} weight="fill" />
                    </TouchableOpacity>
                  </View>
                )
              })}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>NOTE</Text>
        <View style={styles.noteCard}>
          <TextInput
            style={styles.noteInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Describe what these photos show."
            placeholderTextColor={v3.colors.textPlaceholder}
            multiline
            textAlignVertical="top"
          />
        </View>

        {photos.length === 0 ? (
          <View style={styles.infoCard}>
            <Images size={16} color={v3.colors.textMuted} />
            <Text style={styles.infoText}>At least one photo is required before evidence can be saved.</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.submitButton, (submitting || photos.length === 0) && styles.disabled]}
          activeOpacity={0.78}
          onPress={handleSubmit}
          disabled={submitting || photos.length === 0}
        >
          {submitting ? <ActivityIndicator size="small" color={v3.colors.paper} /> : <Text style={styles.submitText}>Save evidence</Text>}
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
  content: { paddingHorizontal: 18, paddingBottom: 34 },
  hero: { marginTop: 8, fontSize: 27, lineHeight: 33, fontFamily: fonts.heading, color: v3.colors.ink, letterSpacing: -0.35 },
  subtitle: { marginTop: 6, maxWidth: 320, fontSize: 10.5, lineHeight: 16, fontFamily: fonts.bodySemiBold, color: v3.colors.textSecondary },
  photoPair: { marginTop: 24, flexDirection: 'row', gap: 10 },
  slotWrap: { flex: 1 },
  slotLabel: { marginBottom: 7, fontSize: 8.5, letterSpacing: 0.6, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  photoSlot: { height: 180, borderRadius: 17, overflow: 'hidden', backgroundColor: v3.colors.surfaceGray, borderWidth: 1, borderColor: v3.colors.line },
  slotImage: { width: '100%', height: '100%' },
  removeButton: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: v3.colors.paper, alignItems: 'center', justifyContent: 'center' },
  emptySlot: { height: 180, borderRadius: 17, backgroundColor: v3.colors.paper, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C8C8C8', alignItems: 'center', justifyContent: 'center' },
  emptySlotTitle: { marginTop: 10, fontSize: 10.5, fontFamily: fonts.headingBold, color: v3.colors.ink },
  emptySlotText: { marginTop: 2, fontSize: 8.5, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted },
  sourceRow: { marginTop: 10, flexDirection: 'row', gap: 8 },
  sourceButton: { flex: 1, height: 42, borderRadius: 13, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  sourceText: { fontSize: 9.5, fontFamily: fonts.headingBold, color: v3.colors.ink },
  uploadingRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  uploadingText: { fontSize: 9, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted },
  sectionLabel: { marginTop: 24, marginBottom: 8, fontSize: 9, letterSpacing: 0.6, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  extraGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  extraPhoto: { width: 74, height: 74, borderRadius: 13, overflow: 'hidden', backgroundColor: v3.colors.surfaceGray },
  extraImage: { width: '100%', height: '100%' },
  extraRemove: { position: 'absolute', top: 3, right: 3 },
  noteCard: { minHeight: 96, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, padding: 13 },
  noteInput: { minHeight: 68, padding: 0, fontSize: 11, lineHeight: 17, fontFamily: fonts.bodyMedium, color: v3.colors.ink },
  infoCard: { minHeight: 54, marginTop: 12, paddingHorizontal: 13, borderRadius: 14, backgroundColor: v3.colors.surfaceGray, flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { flex: 1, fontSize: 8.8, lineHeight: 14, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted },
  submitButton: { height: 54, marginTop: 24, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.42 },
  submitText: { fontSize: 13, fontFamily: fonts.headingBold, color: v3.colors.paper },
})
