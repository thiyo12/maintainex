import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Switch } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Play, Pause, Check, Clock, CaretLeft } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { v2Availability } from '../../../lib/api-v2'
import { v3 } from '../../../theme/v3/tokens'

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
        <Text style={styles.topTitle}>Availability</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.hero}>When are you available?</Text>
        <Text style={styles.subtitle}>Set your normal working window. You can still go offline from Tasker Home anytime.</Text>

        <View style={styles.statusCard}>
          <View style={[styles.statusIcon, isAvailable && styles.statusIconOnline]}>
            {isAvailable ? <Play size={18} color={v3.colors.success} weight="fill" /> : <Pause size={18} color={v3.colors.textMuted} weight="fill" />}
          </View>
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>{isAvailable ? 'Available for matching' : 'Not available'}</Text>
            <Text style={styles.statusText}>Allow MaintainEX to match jobs during your schedule.</Text>
          </View>
          <Switch
            value={isAvailable}
            onValueChange={setIsAvailable}
            trackColor={{ false: '#D8D8D8', true: '#CDEFD9' }}
            thumbColor={isAvailable ? v3.colors.success : v3.colors.textMuted}
          />
        </View>

        <Text style={styles.sectionLabel}>WORK DAYS</Text>
        <View style={styles.daysRow}>
          {DAYS.map((day) => {
            const selected = selectedDays.includes(day.key)
            return (
              <TouchableOpacity
                key={day.key}
                style={[styles.dayButton, selected && styles.dayButtonSelected]}
                activeOpacity={0.72}
                onPress={() => toggleDay(day.key)}
              >
                {selected ? <Check size={11} color={v3.colors.paper} weight="bold" /> : null}
                <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{t(day.labelKey).slice(0, 2)}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={styles.sectionLabel}>WORK HOURS</Text>
        <View style={styles.timeRow}>
          <TouchableOpacity
            style={styles.timeCard}
            activeOpacity={0.72}
            onPress={() => { setShowStartPicker(!showStartPicker); setShowEndPicker(false) }}
          >
            <Clock size={16} color={v3.colors.textMuted} />
            <View style={styles.timeCopy}>
              <Text style={styles.timeLabel}>Start</Text>
              <Text style={styles.timeValue}>{startTime}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.timeCard}
            activeOpacity={0.72}
            onPress={() => { setShowEndPicker(!showEndPicker); setShowStartPicker(false) }}
          >
            <Clock size={16} color={v3.colors.textMuted} />
            <View style={styles.timeCopy}>
              <Text style={styles.timeLabel}>End</Text>
              <Text style={styles.timeValue}>{endTime}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {showStartPicker || showEndPicker ? (
          <View style={styles.pickerCard}>
            {TIMES.map((time) => {
              const active = showStartPicker ? startTime === time : endTime === time
              return (
                <TouchableOpacity
                  key={time}
                  style={[styles.pickerItem, active && styles.pickerItemSelected]}
                  activeOpacity={0.72}
                  onPress={() => {
                    if (showStartPicker) setStartTime(time)
                    else setEndTime(time)
                    setShowStartPicker(false)
                    setShowEndPicker(false)
                  }}
                >
                  <Text style={[styles.pickerText, active && styles.pickerTextSelected]}>{time}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        ) : null}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryEyebrow}>NORMAL SCHEDULE</Text>
          <Text style={styles.summaryTitle}>{selectedDays.length} days · {startTime}–{endTime}</Text>
          <Text style={styles.summaryText}>Online/offline status on Home still controls whether new live opportunities appear.</Text>
        </View>

        <TouchableOpacity style={[styles.saveButton, saving && styles.disabled]} activeOpacity={0.78} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={v3.colors.paper} /> : <Text style={styles.saveText}>Save availability</Text>}
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
  statusCard: { minHeight: 76, marginTop: 22, paddingHorizontal: 13, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  statusIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center' },
  statusIconOnline: { backgroundColor: v3.colors.successSoft },
  statusCopy: { flex: 1, marginLeft: 10, paddingRight: 8 },
  statusTitle: { fontSize: 10.8, fontFamily: fonts.headingBold, color: v3.colors.ink },
  statusText: { marginTop: 3, fontSize: 8.5, lineHeight: 13, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted },
  sectionLabel: { marginTop: 24, marginBottom: 8, fontSize: 9, letterSpacing: 0.6, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  dayButton: { width: 44, height: 44, borderRadius: 13, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  dayButtonSelected: { backgroundColor: v3.colors.ink, borderColor: v3.colors.ink },
  dayText: { fontSize: 9.5, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  dayTextSelected: { marginTop: 1, color: v3.colors.paper },
  timeRow: { flexDirection: 'row', gap: 9 },
  timeCard: { flex: 1, height: 66, borderRadius: 16, paddingHorizontal: 13, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  timeCopy: { marginLeft: 9 },
  timeLabel: { fontSize: 8.5, fontFamily: fonts.bodySemiBold, color: v3.colors.textMuted },
  timeValue: { marginTop: 3, fontSize: 15, fontFamily: fonts.headingBold, color: v3.colors.ink },
  pickerCard: { marginTop: 10, padding: 10, borderRadius: 15, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pickerItem: { minWidth: 56, height: 34, paddingHorizontal: 8, borderRadius: 10, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center' },
  pickerItemSelected: { backgroundColor: v3.colors.ink },
  pickerText: { fontSize: 8.8, fontFamily: fonts.headingBold, color: v3.colors.textMuted },
  pickerTextSelected: { color: v3.colors.paper },
  summaryCard: { minHeight: 86, marginTop: 22, borderRadius: 16, padding: 14, backgroundColor: v3.colors.infoSoft },
  summaryEyebrow: { fontSize: 8.5, fontFamily: fonts.headingBold, color: v3.colors.info },
  summaryTitle: { marginTop: 7, fontSize: 13, fontFamily: fonts.headingBold, color: v3.colors.ink },
  summaryText: { marginTop: 4, fontSize: 8.7, lineHeight: 14, fontFamily: fonts.bodySemiBold, color: '#4F4F4F' },
  saveButton: { height: 54, marginTop: 24, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  saveText: { fontSize: 13, fontFamily: fonts.headingBold, color: v3.colors.paper },
})
