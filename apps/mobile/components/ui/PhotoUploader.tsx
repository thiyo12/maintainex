import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../lib/ThemeContext'
import { fonts, fontSizes } from '../../lib/fonts'
import { spacing, borderRadius } from '../../lib/tokens'

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
  const colors = useColors()
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
      <View style={styles.grid}>
        {photos.map((photo, i) => (
          <View key={i} style={styles.thumbnailWrap}>
            <View style={[styles.thumbnail, { backgroundColor: colors.border }]}>
              <Ionicons name="image-outline" size={28} color={colors.muted} />
            </View>
            <TouchableOpacity style={[styles.removeBtn, { backgroundColor: colors.error }]} onPress={() => removePhoto(i)}>
              <Ionicons name="close" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < maxPhotos ? (
          <TouchableOpacity
            style={[styles.addBox, { borderColor: colors.border, backgroundColor: colors.background }]}
            onPress={pickImage}
            activeOpacity={0.7}
          >
            <Ionicons name="camera-outline" size={28} color={colors.muted} />
            <Text style={[styles.addLabel, { color: colors.muted }]}>
              {photos.length === 0 ? 'Tap to add' : 'Add more'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginVertical: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumbnailWrap: { position: 'relative' },
  thumbnail: {
    width: 90,
    height: 90,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBox: {
    width: 90,
    height: 90,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addLabel: { fontSize: fontSizes.captionSmall, fontFamily: fonts.body, marginTop: spacing.xs },
})
