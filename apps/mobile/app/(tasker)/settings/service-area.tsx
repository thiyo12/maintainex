import { useState, useEffect, useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MapPin, NavigationArrow, CaretLeft, Check } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../lib/ThemeContext'
import * as Location from 'expo-location'
import { v2TaskerProfile } from '../../../lib/api-v2'
import { LOCATIONS } from '../../../lib/locations'
import { fonts } from '../../../lib/fonts'
import { v3 } from '../../../theme/v3/tokens'

const SERVICE_RADII = [5, 10, 15, 25, 50]

interface FlatArea {
  id: string
  name: string
  cityName: string
  stateName: string
  countryName: string
}

function flattenAreas(): FlatArea[] {
  const result: FlatArea[] = []
  for (const country of LOCATIONS) {
    for (const state of country.states) {
      for (const city of state.cities) {
        for (const area of city.areas) {
          result.push({
            id: area.id,
            name: area.name,
            cityName: city.name,
            stateName: state.name,
            countryName: country.name,
          })
        }
      }
    }
  }
  return result
}

const ALL_AREAS = flattenAreas()

export default function ServiceAreaScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [radius, setRadius] = useState(15)
  const [detectedLocation, setDetectedLocation] = useState<string | null>(null)

  useEffect(() => {
    loadCurrentAreas()
  }, [])

  const loadCurrentAreas = async () => {
    try {
      const profile = await v2TaskerProfile.get()
      if (profile.serviceAreas?.length) setSelectedAreas(profile.serviceAreas)
      if ((profile as any).serviceRadius) setRadius((profile as any).serviceRadius)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const detectLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('serviceArea.title'), t('serviceArea.locationPermission'))
      return
    }
    try {
      const loc = await Location.getCurrentPositionAsync({})
      const [place] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
      if (place) {
        const label = `${place.name || place.street || ''}, ${place.city || place.region || ''}`.replace(/^,\s*|,\s*$/g, '').trim()
        setDetectedLocation(label || t('serviceArea.detectedLocation'))
      }
    } catch {
      Alert.alert(t('common.error'), t('errors.generic'))
    }
  }

  const toggleArea = (areaId: string) => {
    setSelectedAreas((prev) => prev.includes(areaId) ? prev.filter((a) => a !== areaId) : [...prev, areaId])
  }

  const handleSave = async () => {
    if (selectedAreas.length === 0) {
      Alert.alert(t('serviceArea.title'), t('serviceArea.selectArea'))
      return
    }
    setSaving(true)
    try {
      await v2TaskerProfile.update({ serviceAreas: selectedAreas, serviceRadius: radius })
      Alert.alert(t('serviceArea.title'), t('serviceArea.saved'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ])
    } catch {
      Alert.alert(t('common.error'), t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  const groupedByState = useMemo(() => {
    const map = new Map<string, FlatArea[]>()
    for (const area of ALL_AREAS) {
      const key = area.stateName
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(area)
    }
    return map
  }, [])

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loading}><ActivityIndicator size="small" color={v3.colors.ink} /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.72} onPress={() => router.back()}>
          <CaretLeft size={17} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Service area</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.hero}>Where do you work?</Text>
        <Text style={styles.subtitle}>Choose the areas where you want to receive MaintainEX job matches.</Text>

        <TouchableOpacity style={styles.locationButton} activeOpacity={0.72} onPress={detectLocation}>
          <NavigationArrow size={17} color={v3.colors.ink} weight="fill" />
          <View style={styles.locationCopy}>
            <Text style={styles.locationTitle}>Use current location</Text>
            <Text style={styles.locationSub}>{detectedLocation || 'Detect your location to help set the service area.'}</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>TRAVEL RADIUS</Text>
        <View style={styles.radiusRow}>
          {SERVICE_RADII.map((value) => {
            const selected = radius === value
            return (
              <TouchableOpacity
                key={value}
                style={[styles.radiusButton, selected && styles.radiusButtonSelected]}
                activeOpacity={0.72}
                onPress={() => setRadius(value)}
              >
                <Text style={[styles.radiusText, selected && styles.radiusTextSelected]}>{value} km</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={styles.selectionSummary}>
          <MapPin size={16} color={v3.colors.info} weight="fill" />
          <Text style={styles.selectionText}>{selectedAreas.length} {selectedAreas.length === 1 ? 'area' : 'areas'} selected · {radius} km radius</Text>
        </View>

        <Text style={styles.sectionLabel}>AREAS</Text>
        {Array.from(groupedByState.entries()).map(([stateName, areas]) => (
          <View key={stateName} style={styles.stateGroup}>
            <Text style={styles.stateLabel}>{stateName}</Text>
            {areas.map((area) => {
              const selected = selectedAreas.includes(area.id)
              return (
                <TouchableOpacity
                  key={area.id}
                  style={styles.areaRow}
                  activeOpacity={0.72}
                  onPress={() => toggleArea(area.id)}
                >
                  <View style={[styles.areaCheck, selected && styles.areaCheckSelected]}>
                    {selected ? <Check size={12} color={v3.colors.paper} weight="bold" /> : null}
                  </View>
                  <View style={styles.areaCopy}>
                    <Text style={styles.areaName}>{area.name}</Text>
                    <Text style={styles.areaCity}>{area.cityName}</Text>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        ))}

        <TouchableOpacity
          style={[styles.saveButton, (selectedAreas.length === 0 || saving) && styles.disabled]}
          activeOpacity={0.78}
          onPress={handleSave}
          disabled={selectedAreas.length === 0 || saving}
        >
          {saving ? <ActivityIndicator size="small" color={v3.colors.paper} /> : <Text style={styles.saveText}>Save service area</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (_colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { height: 70, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  placeholder: { width: 38, height: 38 },
  topTitle: { fontSize: 14, fontFamily: fonts.headingBold, color: v3.colors.ink },
  content: { paddingHorizontal: 18, paddingBottom: 34 },
  hero: { marginTop: 8, fontSize: 27, lineHeight: 33, fontFamily: fonts.heading, color: v3.colors.ink, letterSpacing: -0.35 },
  subtitle: { marginTop: 6, maxWidth: 330, fontSize: 10.5, lineHeight: 16, fontFamily: fonts.bodySemiBold, color: v3.colors.textSecondary },
  locationButton: { minHeight: 72, marginTop: 22, padding: 13, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  locationCopy: { flex: 1, marginLeft: 10 },
  locationTitle: { fontSize: 10.8, fontFamily: fonts.headingBold, color: v3.colors.ink },
  locationSub: { marginTop: 3, fontSize: 8.6, lineHeight: 13, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted },
  sectionLabel: { marginTop: 23, marginBottom: 8, fontSize: 9, letterSpacing: 0.6, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  radiusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  radiusButton: { minWidth: 59, height: 38, paddingHorizontal: 12, borderRadius: 12, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  radiusButtonSelected: { backgroundColor: v3.colors.ink, borderColor: v3.colors.ink },
  radiusText: { fontSize: 9.2, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  radiusTextSelected: { color: v3.colors.paper },
  selectionSummary: { minHeight: 54, marginTop: 14, paddingHorizontal: 13, borderRadius: 14, backgroundColor: v3.colors.infoSoft, flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectionText: { fontSize: 9.2, fontFamily: fonts.bodySemiBold, color: '#4F4F4F' },
  stateGroup: { marginBottom: 16 },
  stateLabel: { marginBottom: 6, fontSize: 9.2, fontFamily: fonts.headingBold, color: v3.colors.textSecondary },
  areaRow: { minHeight: 56, marginBottom: 7, paddingHorizontal: 12, borderRadius: 15, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  areaCheck: { width: 21, height: 21, borderRadius: 7, borderWidth: 1.5, borderColor: '#C7C7C7', alignItems: 'center', justifyContent: 'center' },
  areaCheckSelected: { backgroundColor: v3.colors.ink, borderColor: v3.colors.ink },
  areaCopy: { flex: 1, marginLeft: 10 },
  areaName: { fontSize: 10.5, fontFamily: fonts.headingBold, color: v3.colors.ink },
  areaCity: { marginTop: 2, fontSize: 8.5, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted },
  saveButton: { height: 54, marginTop: 18, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  saveText: { fontSize: 13, fontFamily: fonts.headingBold, color: v3.colors.paper },
})
