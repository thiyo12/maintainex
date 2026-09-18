import { StyleSheet, Text, View, ViewStyle } from 'react-native'
import { MapPin } from 'phosphor-react-native'
import { v3 } from '../../theme/v3/tokens'

type Props = {
  latitude: number
  longitude: number
  title?: string
  markerColor?: string
  style?: ViewStyle
}

export default function TaskerJobLocationMap({ latitude, longitude, title, style }: Props) {
  return (
    <View style={[styles.map, style]}>
      <View style={styles.pin}><MapPin size={27} color={v3.colors.ink} weight="fill" /></View>
      <Text style={styles.title}>{title || 'Job location'}</Text>
      <Text style={styles.meta}>{latitude.toFixed(5)}, {longitude.toFixed(5)}</Text>
      <Text style={styles.help}>Open the iOS or Android app for the interactive map.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  map: { width: '100%', height: 320, borderRadius: 16, backgroundColor: v3.colors.amberSoft, alignItems: 'center', justifyContent: 'center', padding: 24 },
  pin: { width: 56, height: 56, borderRadius: 28, backgroundColor: v3.colors.amber, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 10, fontFamily: 'Outfit_800ExtraBold', fontSize: 15, color: v3.colors.ink, textAlign: 'center' },
  meta: { marginTop: 5, fontFamily: 'Outfit_600SemiBold', fontSize: 11, color: v3.colors.textSecondary },
  help: { marginTop: 8, fontFamily: 'Outfit_400Regular', fontSize: 11, lineHeight: 16, color: v3.colors.textSecondary, textAlign: 'center' },
})
