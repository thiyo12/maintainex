import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Switch } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { v2Availability } from '@/api/v2-taskers'

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
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} />
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
            <Ionicons name={isAvailable ? 'radio-outline' : 'pause-circle-outline'} size={24} color={isAvailable ? '#059669' : colors.muted} />
            <View>
              <Text style={styles.toggleLabel}>{isAvailable ? t('availabilitySettings.available') : t('availabilitySettings.unavailable')}</Text>
              <Text style={styles.toggleHint}>{t('availabilitySettings.toggleAvailable')}</Text>
            </View>
          </View>
          <Switch
            value={isAvailable}
            onValueChange={setIsAvailable}
            trackColor={{ false: colors.border, true: '#D1FAE5' }}
            thumbColor={isAvailable ? '#059669' : colors.muted}
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
                {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
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
            <Ionicons name="time-outline" size={18} color={colors.amberDark} />
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
            <Ionicons name="time-outline" size={18} color={colors.amberDark} />
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
            <ActivityIndicator size="small" color={colors.white} />
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
  container: { flex: 1, backgroundColor: colors.cream },
  scroll: { paddingHorizontal: 24 },
  heading: { fontSize: 24, fontWeight: '800', color: colors.ink, marginTop: 16 },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 20, lineHeight: 20 },

  toggleCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 24,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: colors.ink },
  toggleHint: { fontSize: 12, color: colors.muted, marginTop: 2 },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 10 },

  daysGrid: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  dayBtn: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: colors.white,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  dayBtnSelected: { backgroundColor: colors.amber, borderColor: colors.amber },
  dayBtnText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  dayBtnTextSelected: { color: colors.ink },

  timeRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  timeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.white, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border,
  },
  timeLabel: { fontSize: 11, color: colors.muted },
  timeValue: { fontSize: 18, fontWeight: '700', color: colors.ink },

  pickerCard: {
    backgroundColor: colors.white, borderRadius: 14, padding: 12, marginBottom: 20,
    borderWidth: 1, borderColor: colors.border, flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  pickerItem: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surfaceHigh,
  },
  pickerItemSelected: { backgroundColor: colors.amber },
  pickerText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  pickerTextSelected: { color: colors.ink },

  saveBtn: { backgroundColor: colors.amber, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 12 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: colors.ink },
})
