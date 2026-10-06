import { StyleSheet, ViewStyle } from 'react-native'
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'

type Props = {
  latitude: number
  longitude: number
  title?: string
  markerColor?: string
  style?: ViewStyle
}

export default function TaskerJobLocationMap({ latitude, longitude, title, markerColor = '#F5A623', style }: Props) {
  return (
    <MapView
      style={[styles.map, style]}
      provider={PROVIDER_DEFAULT}
      initialRegion={{
        latitude,
        longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }}
    >
      <Marker coordinate={{ latitude, longitude }} pinColor={markerColor} title={title} />
    </MapView>
  )
}

const styles = StyleSheet.create({ map: { width: '100%', height: 320, borderRadius: 16 } })
