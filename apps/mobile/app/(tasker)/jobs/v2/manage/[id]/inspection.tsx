import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Image } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../../../../lib/ThemeContext'
import { fonts } from '../../../../../../lib/fonts'
import { v2Inspection } from '../../../../../../lib/api-v2'
import { upload } from '../../../../../../lib/api'
import * as ImagePicker from 'expo-image-picker'

export default function InspectionScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
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
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <Text style={styles.heading}>{t('inspection.title')}</Text>
        <Text style={styles.subtitle}>{t('inspection.subtitle')}</Text>

        {/* Findings */}
        <Text style={styles.label}>{t('inspection.findings')} *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={findings}
          onChangeText={setFindings}
          placeholder={t('inspection.findingsPlaceholder')}
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={4}
        />

        {/* Photos */}
        <Text style={styles.label}>{t('inspection.photos')}</Text>
        <View style={styles.photoRow}>
          <TouchableOpacity style={styles.addPhotoBtn} onPress={() => addPhoto(true)} activeOpacity={0.7}>
            <Ionicons name="camera-outline" size={24} color={colors.amberDark} />
            <Text style={styles.addPhotoText}>{t('inspection.takePhoto')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addPhotoBtn} onPress={() => addPhoto(false)} activeOpacity={0.7}>
            <Ionicons name="image-outline" size={24} color={colors.amberDark} />
            <Text style={styles.addPhotoText}>{t('inspection.chooseFromLibrary')}</Text>
          </TouchableOpacity>
        </View>

        {uploading && (
          <View style={styles.uploadingCard}>
            <ActivityIndicator size="small" color={colors.amber} />
            <Text style={styles.uploadingText}>{t('common.loading')}</Text>
          </View>
        )}

        {photos.length > 0 && (
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
        )}

        {/* Notes */}
        <Text style={styles.label}>{t('inspection.notes')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('inspection.notesPlaceholder')}
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={3}
        />

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !findings.trim()) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !findings.trim()}
          activeOpacity={0.7}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>{t('inspection.submit')}</Text>
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

  label: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.white, borderRadius: 12, padding: 14, fontSize: 15,
    borderWidth: 1.5, borderColor: colors.border, color: colors.ink,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },

  photoRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  addPhotoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.white, padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
  },
  addPhotoText: { fontSize: 13, fontWeight: '600', color: colors.ink },

  uploadingCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.white, padding: 16, borderRadius: 12, marginBottom: 12,
  },
  uploadingText: { fontSize: 13, color: colors.muted },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  photoWrap: { position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden' },
  photo: { width: '100%', height: '100%', backgroundColor: colors.border },
  removePhotoBtn: { position: 'absolute', top: 2, right: 2, backgroundColor: colors.white, borderRadius: 10 },

  submitBtn: { backgroundColor: colors.amber, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 20 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: colors.ink },
})
