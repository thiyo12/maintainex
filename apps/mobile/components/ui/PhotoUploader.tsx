import { useState, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../lib/ThemeContext'

interface PhotoItem {
  uri: string
  label?: string
}

interface Props {
  maxPhotos?: number
  onPhotosChange: (photos: PhotoItem[]) => void
  existingPhotos?: PhotoItem[]
}

export default function PhotoUploader({ maxPhotos = 5, onPhotosChange, existingPhotos = [] }: Props) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [photos, setPhotos] = useState<PhotoItem[]>(existingPhotos)

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      const newPhotos = [...photos, { uri: result.assets[0].uri }]
      setPhotos(newPhotos)
      onPhotosChange(newPhotos)
    }
  }

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index)
    setPhotos(newPhotos)
    onPhotosChange(newPhotos)
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {photos.map((photo, i) => (
          <View key={i} style={styles.thumbnailWrap}>
            <View style={[styles.thumbnail, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="image-outline" size={26} color={colors.muted} />
            </View>
            <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(i)}>
              <Text style={styles.removeText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < maxPhotos ? (
          <TouchableOpacity
            style={[styles.addBox, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={pickImage}
            activeOpacity={0.7}
          >
            <Ionicons name="camera-outline" size={26} color={colors.muted} />
            <Text style={[styles.addLabel, { color: colors.muted }]}>
              {photos.length === 0 ? t('components.addPhoto') : t('components.addPhoto')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container:     { marginVertical: 8 },
  row:           { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbnailWrap: { position: 'relative' },
  thumbnail: {
    width: 80, height: 80, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
  },
  thumbIcon: { fontSize: 26 },
  removeBtn: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#EF4444',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35, shadowRadius: 4, elevation: 3,
  },
  removeText: { color: '#FFFFFF', fontSize: 12, fontFamily: 'Outfit_700Bold' },
  addBox: {
    width: 80, height: 80, borderRadius: 14,
    borderWidth: 1.5, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },
  addIcon:  { fontSize: 26, color: colors.muted },
  addLabel: { fontSize: 10, color: colors.muted, marginTop: 4, fontFamily: 'Outfit_500Medium' },
})
