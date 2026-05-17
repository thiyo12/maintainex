import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import * as ImagePicker from 'expo-image-picker'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  background: '#F9FAFB',
  white: '#FFFFFF',
  green: '#10B981',
}

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
            <View style={[styles.thumbnail, { backgroundColor: '#E5E7EB' }]}>
              <Text style={styles.thumbIcon}>📷</Text>
            </View>
            <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(i)}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < maxPhotos ? (
          <TouchableOpacity style={styles.addBox} onPress={pickImage} activeOpacity={0.7}>
            <Text style={styles.addIcon}>+</Text>
            <Text style={styles.addLabel}>{photos.length === 0 ? 'Tap to add' : 'Add more'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginVertical: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbnailWrap: { position: 'relative' },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbIcon: { fontSize: 28 },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  addBox: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.lightGray,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  addIcon: { fontSize: 28, color: colors.gray, fontWeight: '300' },
  addLabel: { fontSize: 10, color: colors.gray, marginTop: 4 },
})
