import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { MapPin } from 'phosphor-react-native'
import { v3 } from '../../theme/v3/tokens'

interface Props {
  title: string
  price: string
  location: string
  imageUrl?: string
  type?: string
  onPress: () => void
}

export default function V3PropertyPreviewCard({ title, price, location, imageUrl, type, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.imageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}
        {type ? (
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{type}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.price}>{price}</Text>
        <View style={styles.locRow}>
          <MapPin size={10} color={v3.colors.textMuted} weight="fill" />
          <Text style={styles.location} numberOfLines={1}>{location}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    width: 180,
    backgroundColor: v3.colors.surfaceWhite,
    borderWidth: 1,
    borderColor: v3.colors.line,
    borderRadius: v3.radius.lg,
    overflow: 'hidden',
  },
  imageWrap: {
    width: '100%',
    height: 100,
    backgroundColor: v3.colors.surfaceGray,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: v3.colors.surfaceGray,
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: v3.colors.paper,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: v3.radius.full,
  },
  typeText: {
    fontSize: 8,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.textPrimary,
  },
  body: {
    padding: 10,
  },
  title: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.textPrimary,
  },
  price: {
    fontSize: 11,
    fontFamily: 'Outfit_800ExtraBold',
    color: v3.colors.amber,
    marginTop: 2,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  location: {
    fontSize: 9,
    fontFamily: 'Outfit_500Medium',
    color: v3.colors.textMuted,
    flex: 1,
  },
})
