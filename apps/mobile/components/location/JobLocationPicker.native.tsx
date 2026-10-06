import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import MapView, { Marker, PROVIDER_DEFAULT, Region, MapPressEvent, MarkerDragStartEndEvent } from 'react-native-maps'
import * as Location from 'expo-location'
import { Crosshair, MapPin } from 'phosphor-react-native'
import { v3 } from '@/theme/v3/tokens'

export type JobLocationValue = {
  latitude: number | null
  longitude: number | null
  label: string
}

type Props = {
  value: JobLocationValue
  onChange: (value: JobLocationValue) => void
}

const DEFAULT_REGION: Region = {
  latitude: 9.6615,
  longitude: 80.0255,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
}

export default function JobLocationPicker({ value, onChange }: Props) {
  const mapRef = useRef<MapView>(null)
  const [locating, setLocating] = useState(false)
  const region = value.latitude != null && value.longitude != null
    ? { ...DEFAULT_REGION, latitude: value.latitude, longitude: value.longitude }
    : DEFAULT_REGION

  const resolveLabel = async (latitude: number, longitude: number) => {
    try {
      const result = await Location.reverseGeocodeAsync({ latitude, longitude })
      const place = result[0]
      if (!place) return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
      return [place.name, place.street, place.district, place.city, place.region]
        .filter((item, index, arr) => item && arr.indexOf(item) === index)
        .join(', ')
    } catch {
      return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
    }
  }

  const setPoint = async (latitude: number, longitude: number) => {
    const label = await resolveLabel(latitude, longitude)
    onChange({ latitude, longitude, label })
  }

  const useCurrentLocation = async () => {
    setLocating(true)
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.status !== 'granted') {
        Alert.alert('Location permission needed', 'Allow location access so MaintainEX can place the job accurately.')
        return
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const next = { latitude: current.coords.latitude, longitude: current.coords.longitude }
      mapRef.current?.animateToRegion({ ...DEFAULT_REGION, ...next }, 350)
      await setPoint(next.latitude, next.longitude)
    } catch (error: any) {
      Alert.alert('Could not get location', error?.message || 'Move the pin manually or try again.')
    } finally {
      setLocating(false)
    }
  }

  useEffect(() => {
    if (value.latitude == null || value.longitude == null) return
    mapRef.current?.animateToRegion({ ...DEFAULT_REGION, latitude: value.latitude, longitude: value.longitude }, 250)
  }, [value.latitude, value.longitude])

  return (
    <View>
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          onPress={(event: MapPressEvent) => {
            const { latitude, longitude } = event.nativeEvent.coordinate
            setPoint(latitude, longitude)
          }}
        >
          {value.latitude != null && value.longitude != null ? (
            <Marker
              coordinate={{ latitude: value.latitude, longitude: value.longitude }}
              draggable
              onDragEnd={(event: MarkerDragStartEndEvent) => {
                const { latitude, longitude } = event.nativeEvent.coordinate
                setPoint(latitude, longitude)
              }}
            />
          ) : null}
        </MapView>
        <View pointerEvents="none" style={styles.mapHint}>
          <MapPin size={14} color={v3.colors.ink} weight="fill" />
          <Text style={styles.mapHintText}>Tap map or drag the pin</Text>
        </View>
      </View>

      <TouchableOpacity activeOpacity={0.78} onPress={useCurrentLocation} style={styles.currentButton}>
        {locating ? <ActivityIndicator size="small" color={v3.colors.ink} /> : <Crosshair size={17} color={v3.colors.ink} weight="bold" />}
        <Text style={styles.currentText}>{locating ? 'Finding your location…' : 'Use my current location'}</Text>
      </TouchableOpacity>

      {value.label ? <Text style={styles.label} numberOfLines={2}>{value.label}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  mapWrap: {
    height: 210, borderRadius: 18, overflow: 'hidden', borderWidth: 1,
    borderColor: v3.colors.line, backgroundColor: v3.colors.surfaceGray,
  },
  mapHint: {
    position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center',
    gap: 6, backgroundColor: v3.colors.paper, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7,
    borderWidth: 1, borderColor: v3.colors.line,
  },
  mapHintText: { fontFamily: 'Outfit_700Bold', fontSize: 10.5, color: v3.colors.ink },
  currentButton: {
    marginTop: 10, height: 44, borderRadius: 14, backgroundColor: v3.colors.amberSoft,
    borderWidth: 1, borderColor: '#F2D08C', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  currentText: { fontFamily: 'Outfit_700Bold', fontSize: 12, color: v3.colors.ink },
  label: { marginTop: 8, fontFamily: 'Outfit_500Medium', fontSize: 11.5, lineHeight: 16, color: v3.colors.textSecondary },
})
