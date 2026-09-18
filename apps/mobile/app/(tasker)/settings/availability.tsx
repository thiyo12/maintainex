import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Switch } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Play, Pause, Check, Clock } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { v2Availability } from '../../../lib/api-v2'

const DAYS = [
  { key: 'monday', labelKey: 'availabilitySettings.monday' },
  { key: 'tuesday', labelKey: 'availabilitySettings.tuesday' },
  { key: 'wednesday', labelKey: 'availabilitySettings.wednesday' },
  { key: 'thursday', labelKey: 'availabilitySettings.thursday' },
  { key: 'friday', labelKey: 'availabilitySettings.friday' },
  { key: 'saturday', labelKey: 'availabilitySettings.saturday' },
  { key: 'sunday', labelKey: 'availabilitySettings.sunday' },
]

const TIMES = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30',
]

export default function AvailabilityScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isAvailable, setIsAvailable] = useState(true)
  const [selectedDays, setSelectedDays] = useState<string[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('17:00')
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker] = useState(false)

  useEffect(() => {
    loadAvailability()
  }, [])

  const loadAvailability = async () => {
    try {
      const res = await v2Availability.get()
      const data = res as any
      setIsAvailable(data.isAvailable ?? true)
      if (data.workDays?.length) setSelectedDays(data.workDays)
      if (data.workHours?.start) setStartTime(data.workHours.start)
      if (data.workHours?.end) setEndTime(data.workHours.end)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const handleSave = async () => {
    if (selectedDays.length === 0) {
      Alert.alert(t('availabilitySettings.title'), t('availabilitySettings.selectAtLeastOneDay'))
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, any> = {
        isAvailable,
        startTime,
        endTime,
      }
      DAYS.forEach((d) => {
        payload[d.key] = selectedDays.includes(d.key)
      })
      await v2Availability.update(payload)
      Alert.alert(t('availabilitySettings.title'), t('availabilitySettings.saved'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ])
    } catch {
      Alert.alert(t('common.error'), t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#F5A623" style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <Text style={styles.heading}>{t('availabilitySettings.title')}</Text>
        <Text style={styles.subtitle}>{t('availabilitySettings.subtitle')}</Text>

        {/* Toggle */}
        <View style={styles.toggleCard}>
          <View style={styles.toggleLeft}>
            {isAvailable
              ? <Play size={24} color="#059669" weight="fill" />
              : <Pause size={24} color="#6F6B6B" weight="regular" />
            }
            <View>
              <Text style={styles.toggleLabel}>{isAvailable ? t('availabilitySettings.available') : t('availabilitySettings.unavailable')}</Text>
              <Text style={styles.toggleHint}>{t('availabilitySettings.toggleAvailable')}</Text>
            </View>
          </View>
          <Switch
            value={isAvailable}
            onValueChange={setIsAvailable}
            trackColor={{ false: '#2E2E2E', true: '#D1FAE5' }}
            thumbColor={isAvailable ? '#059669' : '#6F6B6B'}
          />
        </View>

        {/* Work Days */}
        <Text style={styles.sectionTitle}>{t('availabilitySettings.workDays')}</Text>
        <View style={styles.daysGrid}>
          {DAYS.map((day) => {
            const isSelected = selectedDays.includes(day.key)
            return (
              <TouchableOpacity
                key={day.key}
                style={[styles.dayBtn, isSelected && styles.dayBtnSelected]}
                onPress={() => toggleDay(day.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayBtnText, isSelected && styles.dayBtnTextSelected]}>
                  {t(day.labelKey).slice(0, 2)}
                </Text>
                {isSelected && <Check size={14} color="#fff" weight="fill" />}
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Work Hours */}
        <Text style={styles.sectionTitle}>{t('availabilitySettings.workHours')}</Text>
        <View style={styles.timeRow}>
          {/* Start Time */}
          <TouchableOpacity
            style={styles.timeBtn}
            onPress={() => { setShowStartPicker(!showStartPicker); setShowEndPicker(false) }}
            activeOpacity={0.7}
          >
            <Clock size={18} color="#D4900A" weight="regular" />
            <View>
              <Text style={styles.timeLabel}>{t('availabilitySettings.startTime')}</Text>
              <Text style={styles.timeValue}>{startTime}</Text>
            </View>
          </TouchableOpacity>

          {/* End Time */}
          <TouchableOpacity
            style={styles.timeBtn}
            onPress={() => { setShowEndPicker(!showEndPicker); setShowStartPicker(false) }}
            activeOpacity={0.7}
          >
            <Clock size={18} color="#D4900A" weight="regular" />
            <View>
              <Text style={styles.timeLabel}>{t('availabilitySettings.endTime')}</Text>
              <Text style={styles.timeValue}>{endTime}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Time Pickers */}
        {showStartPicker && (
          <View style={styles.pickerCard}>
            {TIMES.map((time) => (
              <TouchableOpacity
                key={time}
                style={[styles.pickerItem, startTime === time && styles.pickerItemSelected]}
                onPress={() => { setStartTime(time); setShowStartPicker(false) }}
              >
                <Text style={[styles.pickerText, startTime === time && styles.pickerTextSelected]}>{time}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {showEndPicker && (
          <View style={styles.pickerCard}>
            {TIMES.map((time) => (
              <TouchableOpacity
                key={time}
                style={[styles.pickerItem, endTime === time && styles.pickerItemSelected]}
                onPress={() => { setEndTime(time); setShowEndPicker(false) }}
              >
                <Text style={[styles.pickerText, endTime === time && styles.pickerTextSelected]}>{time}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>{t('availabilitySettings.save')}</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  scroll: { paddingHorizontal: 24 },
  heading: { fontSize: 24, fontWeight: '800', color: '#000000', marginTop: 16 },
  subtitle: { fontSize: 14, color: '#6F6B6B', marginTop: 4, marginBottom: 20, lineHeight: 20 },

  toggleCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#E5E5E5', marginBottom: 24,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: '#000000' },
  toggleHint: { fontSize: 12, color: '#6F6B6B', marginTop: 2 },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#000000', marginBottom: 10 },

  daysGrid: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  dayBtn: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: '#E5E5E5', alignItems: 'center', justifyContent: 'center',
  },
  dayBtnSelected: { backgroundColor: '#F5A623', borderColor: '#F5A623' },
  dayBtnText: { fontSize: 13, fontWeight: '700', color: '#6F6B6B' },
  dayBtnTextSelected: { color: '#000000' },

  timeRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  timeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E5E5',
  },
  timeLabel: { fontSize: 11, color: '#6F6B6B' },
  timeValue: { fontSize: 18, fontWeight: '700', color: '#000000' },

  pickerCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 20,
    borderWidth: 1, borderColor: '#E5E5E5', flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  pickerItem: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F1F1F1',
  },
  pickerItemSelected: { backgroundColor: '#F5A623' },
  pickerText: { fontSize: 13, fontWeight: '600', color: '#6F6B6B' },
  pickerTextSelected: { color: '#000000' },

  saveBtn: { backgroundColor: '#F5A623', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 12 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#000000' },
})
