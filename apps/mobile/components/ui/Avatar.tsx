import { View, Text, StyleSheet, Image } from 'react-native'
import { useColors } from '../../lib/ThemeContext'
import { fonts } from '../../lib/fonts'

interface Props {
  name: string
  size?: number
  imageUrl?: string | null
  color?: string
  online?: boolean
}

export default function Avatar({ name, size = 48, imageUrl, color, online }: Props) {
  const colors = useColors()
  const styles = makeStyles(colors)
  const initials = (name || '?')
    .split(' ')
    .map(s => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  const bgColor = color || colors.amber

  if (imageUrl) {
    return (
      <View style={{ width: size, height: size }}>
        <Image
          source={{ uri: imageUrl }}
          style={[styles.image, { width: size, height: size, borderRadius: size * 0.28 }]}
        />
        {online && <View style={[styles.onlineDot, { width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14, right: 0, bottom: 0 }]} />}
      </View>
    )
  }

  return (
    <View style={[styles.initials, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: bgColor }]}>
      <Text style={[styles.text, { fontSize: size * 0.4 }]}>{initials}</Text>
      {online && <View style={[styles.onlineDot, { width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14, right: 0, bottom: 0 }]} />}
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  initials: { justifyContent: 'center', alignItems: 'center' },
  text:     { fontFamily: 'Outfit_900Black', color: colors.white },
  image:    {},
  onlineDot: {
    position: 'absolute',
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
})
