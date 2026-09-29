import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Image } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { upload } from '@/api/upload'
import { v2Evidence } from '@/api/v2-jobs'
import * as ImagePicker from 'expo-image-picker'

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
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <Text style={styles.heading}>{t('evidence.title')}</Text>
        <Text style={styles.subtitle}>{t('evidence.subtitle')}</Text>

        {/* Photo actions */}
        <View style={styles.photoRow}>
          <TouchableOpacity style={styles.addPhotoBtn} onPress={() => addPhoto(true)} activeOpacity={0.7}>
            <Ionicons name="camera-outline" size={24} color={colors.amberDark} />
            <Text style={styles.addPhotoText}>{t('evidence.takePhoto')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addPhotoBtn} onPress={() => addPhoto(false)} activeOpacity={0.7}>
            <Ionicons name="image-outline" size={24} color={colors.amberDark} />
            <Text style={styles.addPhotoText}>{t('evidence.chooseFromLibrary')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>{t('evidence.maxSize')} · {t('evidence.supportedFormats')}</Text>

        {uploading && (
          <View style={styles.uploadingCard}>
            <ActivityIndicator size="small" color={colors.amber} />
            <Text style={styles.uploadingText}>{t('common.loading')}</Text>
          </View>
        )}

        {photos.length > 0 && (
          <>
            <Text style={styles.photoCount}>{t('evidence.photoCount', { n: photos.length })}</Text>
            <View style={styles.photoGrid}>
              {photos.map((uri, i) => (
                <View key={i} style={styles.photoWrap}>
                  <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
                  <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removePhoto(i)}>
                    <Ionicons name="close-circle" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        {photos.length === 0 && !uploading && (
          <View style={styles.emptyPhotos}>
            <Ionicons name="images-outline" size={40} color={colors.muted} />
            <Text style={styles.emptyPhotosText}>{t('evidence.photoCount', { n: 0 })}</Text>
          </View>
        )}

        {/* Notes */}
        <Text style={styles.label}>{t('evidence.notes')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('evidence.notesPlaceholder')}
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={4}
        />

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, (submitting || photos.length === 0) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || photos.length === 0}
          activeOpacity={0.7}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>{t('evidence.submit')}</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  scroll: { paddingHorizontal: 24 },
  heading: { fontSize: 24, fontWeight: '800', color: colors.ink, marginTop: 16 },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 20, lineHeight: 20 },

  photoRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  addPhotoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.white, padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
  },
  addPhotoText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  hint: { fontSize: 11, color: colors.muted, marginBottom: 12, fontStyle: 'italic' },

  uploadingCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.white, padding: 16, borderRadius: 12, marginBottom: 12,
  },
  uploadingText: { fontSize: 13, color: colors.muted },

  photoCount: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 8 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  photoWrap: { position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden' },
  photo: { width: '100%', height: '100%', backgroundColor: colors.border },
  removePhotoBtn: { position: 'absolute', top: 2, right: 2, backgroundColor: colors.white, borderRadius: 10 },

  emptyPhotos: {
    alignItems: 'center', padding: 32, backgroundColor: colors.white, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', marginBottom: 16,
  },
  emptyPhotosText: { fontSize: 13, color: colors.muted, marginTop: 8 },

  label: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.white, borderRadius: 12, padding: 14, fontSize: 15,
    borderWidth: 1.5, borderColor: colors.border, color: colors.ink,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },

  submitBtn: { backgroundColor: colors.amber, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 20 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: colors.ink },
})
