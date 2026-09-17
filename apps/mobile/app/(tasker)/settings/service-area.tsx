import { useState, useEffect, useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MapPin, NavigationArrow } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../lib/ThemeContext'
import * as Location from 'expo-location'
import { v2TaskerProfile } from '../../../lib/api-v2'
import { LOCATIONS } from '../../../lib/locations'

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
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>{t('serviceArea.title')}</Text>
        <Text style={styles.subtitle}>{t('serviceArea.subtitle')}</Text>

        <TouchableOpacity style={styles.detectBtn} onPress={detectLocation} activeOpacity={0.7}>
          <NavigationArrow size={20} color={colors.amberDark} weight="fill" />
          <Text style={styles.detectBtnText}>{t('serviceArea.detectedLocation')}</Text>
        </TouchableOpacity>

        {detectedLocation ? (
          <View style={styles.detectedCard}>
            <MapPin size={16} color={colors.success} weight="fill" />
            <Text style={styles.detectedText}>{detectedLocation}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{t('serviceArea.radius')}</Text>
        <View style={styles.radiusRow}>
          {SERVICE_RADII.map((value) => {
            const selected = radius === value
            return (
              <TouchableOpacity key={value} style={[styles.radiusBtn, selected && styles.radiusBtnSelected]} onPress={() => setRadius(value)} activeOpacity={0.7}>
                <Text style={[styles.radiusBtnText, selected && styles.radiusBtnTextSelected]}>{t('serviceArea.radiusKm', { n: value })}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={styles.sectionTitle}>{t('serviceArea.currentArea')}</Text>
        {Array.from(groupedByState.entries()).map(([stateName, areas]) => (
          <View key={stateName} style={styles.stateGroup}>
            <Text style={styles.stateLabel}>{stateName}</Text>
            {areas.map((area) => {
              const selected = selectedAreas.includes(area.id)
              return (
                <TouchableOpacity key={area.id} style={[styles.areaBtn, selected && styles.areaBtnSelected]} onPress={() => toggleArea(area.id)} activeOpacity={0.7}>
                  <View style={[styles.areaRadio, selected && styles.areaRadioSelected]}>
                    {selected ? <View style={styles.areaRadioInner} /> : null}
                  </View>
                  <View style={styles.areaBody}>
                    <Text style={[styles.areaName, selected && styles.areaNameSelected]}>{area.name}</Text>
                    <Text style={styles.areaCity}>{area.cityName}</Text>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        ))}

        <TouchableOpacity style={[styles.saveBtn, (selectedAreas.length === 0 || saving) && styles.saveBtnDisabled]} onPress={handleSave} disabled={selectedAreas.length === 0 || saving} activeOpacity={0.7}>
          {saving ? <ActivityIndicator size="small" color={colors.ink} /> : <Text style={styles.saveBtnText}>{t('serviceArea.save')}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 24, paddingBottom: 48 },
  heading: { fontSize: 24, fontFamily: 'Outfit_800ExtraBold', color: colors.ink, marginTop: 16 },
  subtitle: { fontSize: 14, fontFamily: 'Outfit_400Regular', color: colors.muted, marginTop: 4, marginBottom: 20, lineHeight: 20 },
  detectBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  detectBtnText: { fontSize: 14, fontFamily: 'Outfit_600SemiBold', color: colors.amberDark },
  detectedCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.successSoft || '#E7F8EF', padding: 12, borderRadius: 12, marginBottom: 20 },
  detectedText: { fontSize: 13, color: colors.ink, fontFamily: 'Outfit_600SemiBold', flex: 1 },
  sectionTitle: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: colors.ink, marginBottom: 10, marginTop: 8 },
  radiusRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  radiusBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  radiusBtnSelected: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  radiusBtnText: { fontSize: 13, fontFamily: 'Outfit_600SemiBold', color: colors.muted },
  radiusBtnTextSelected: { color: colors.amberDark },
  stateGroup: { marginBottom: 16 },
  stateLabel: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: colors.muted, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
  areaBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, padding: 14, borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: colors.border },
  areaBtnSelected: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  areaRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  areaRadioSelected: { borderColor: colors.amber },
  areaRadioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.amber },
  areaBody: { flex: 1 },
  areaName: { fontSize: 14, fontFamily: 'Outfit_600SemiBold', color: colors.ink },
  areaNameSelected: { color: colors.amberDark },
  areaCity: { fontSize: 12, color: colors.muted, marginTop: 2, fontFamily: 'Outfit_400Regular' },
  saveBtn: { backgroundColor: colors.amber, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 20 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: colors.ink },
})
