import { useState, useEffect } from 'react'
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useColors } from '../../../../lib/ThemeContext'
import { templateJobs, quickBookings } from '../../../../lib/api'
import StickyBottomBar from '../../../../components/find/StickyBottomBar'
import SkeletonLoader from '../../../../components/find/SkeletonLoader'

const TIME_SLOTS = [
  '08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00',
  '12:00 - 13:00', '13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00',
  '16:00 - 17:00', '17:00 - 18:00',
]

const DISTRICTS = [
  'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya',
  'Galle', 'Matara', 'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar',
  'Mullaitivu', 'Vavuniya', 'Puttalam', 'Kurunegala', 'Anuradhapura',
  'Polonnaruwa', 'Badulla', 'Moneragala', 'Ratnapura', 'Kegalle',
  'Trincomalee', 'Batticaloa', 'Ampara',
]

export default function QuickBooking() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const { jobId, taskerId, rate } = useLocalSearchParams<{ jobId: string; taskerId: string; rate: string }>()
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [address, setAddress] = useState('')
  const [district, setDistrict] = useState('')
  const [notes, setNotes] = useState('')
  const [showDistrictPicker, setShowDistrictPicker] = useState(false)

  const router = useRouter()

  useEffect(() => {
    (async () => {
      try {
        const data = await templateJobs.get(jobId!)
        setJob(data)
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        setSelectedDate(tomorrow.toISOString().split('T')[0])
      } catch (e) {
        console.error('Failed to load job', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [jobId])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const getNext7Days = () => {
    const days = []
    for (let i = 1; i <= 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      days.push(d.toISOString().split('T')[0])
    }
    return days
  }

  const handleSubmit = async () => {
    if (!selectedDate || !selectedSlot || !address || !district) {
      Alert.alert('Missing Info', 'Please fill in all required fields')
      return
    }
    setSubmitting(true)
    try {
      const result = await quickBookings.create({
        jobId: jobId!,
        taskerId: taskerId!,
        date: selectedDate,
        timeSlot: selectedSlot,
        address,
        district,
        notes,
      })
      Alert.alert('Booking Confirmed!', `Booking ID: ${result.id}`, [
        { text: 'OK', onPress: () => router.push('/(customer)/(tabs)') }
      ])
    } catch (e: any) {
      Alert.alert('Booking Failed', e.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <View style={styles.container}><SkeletonLoader count={5} height={60} /></View>
  if (!job) return <View style={styles.container}><Text style={{ textAlign: 'center', marginTop: 40 }}>Job not found</Text></View>

  const avgPrice = Math.round((job.priceMin + job.priceMax) / 2)

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.jobHeader}>
          <Text style={styles.jobTitle}>{job.name}</Text>
          <Text style={styles.jobPrice}>Rs {avgPrice.toLocaleString()} est.</Text>
          <Text style={styles.jobRate}>Tasker rate: Rs {rate}/hr</Text>
        </View>

        <Text style={styles.sectionTitle}>Select Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
          {getNext7Days().map((dateStr) => {
            const isSelected = selectedDate === dateStr
            return (
              <TouchableOpacity
                key={dateStr}
                style={[styles.dateCard, isSelected && styles.dateCardSelected]}
                onPress={() => setSelectedDate(dateStr)}
              >
                <Text style={[styles.dateText, isSelected && styles.dateTextSelected]}>
                  {formatDate(dateStr)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        <Text style={styles.sectionTitle}>Select Time Slot</Text>
        <View style={styles.slotsGrid}>
          {TIME_SLOTS.map((slot) => {
            const isSelected = selectedSlot === slot
            return (
              <TouchableOpacity
                key={slot}
                style={[styles.slotCard, isSelected && styles.slotCardSelected]}
                onPress={() => setSelectedSlot(slot)}
              >
                <Text style={[styles.slotText, isSelected && styles.slotTextSelected]}>{slot}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={styles.sectionTitle}>Location</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your address"
          placeholderTextColor="#9CA3AF"
          value={address}
          onChangeText={setAddress}
        />

        <TouchableOpacity style={styles.pickerButton} onPress={() => setShowDistrictPicker(!showDistrictPicker)}>
          <Text style={district ? styles.pickerText : styles.pickerPlaceholder}>
            {district || 'Select district'}
          </Text>
          <Ionicons name={showDistrictPicker ? 'chevron-up' : 'chevron-down'} size={18} color="#9CA3AF" />
        </TouchableOpacity>

        {showDistrictPicker && (
          <View style={styles.pickerDropdown}>
            {DISTRICTS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.pickerItem, district === d && styles.pickerItemSelected]}
                onPress={() => { setDistrict(d); setShowDistrictPicker(false) }}
              >
                <Text style={[styles.pickerItemText, district === d && styles.pickerItemTextSelected]}>{d}</Text>
                {district === d && <Ionicons name="checkmark" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Any special instructions for the tasker"
          placeholderTextColor="#9CA3AF"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />
      </ScrollView>

      <StickyBottomBar
        price={`Rs ${avgPrice.toLocaleString()}`}
        label="Estimated total"
        buttonText={submitting ? 'Booking...' : 'Confirm Booking'}
        icon="checkmark"
        onPress={handleSubmit}
        disabled={submitting}
      />
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  jobHeader: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  jobTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  jobPrice: { fontSize: 13, color: '#059669', marginTop: 4 },
  jobRate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10, marginTop: 4 },
  dateScroll: { marginBottom: 16 },
  dateCard: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateCardSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  dateText: { fontSize: 13, color: '#374151' },
  dateTextSelected: { color: colors.primary, fontWeight: '600' },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, marginHorizontal: -4 },
  slotCard: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  slotCardSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  slotText: { fontSize: 13, color: '#374151' },
  slotTextSelected: { color: colors.primary, fontWeight: '600' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  pickerText: { fontSize: 14, color: '#1F2937' },
  pickerPlaceholder: { fontSize: 14, color: '#9CA3AF' },
  pickerDropdown: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 200,
    marginBottom: 12,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerItemSelected: { backgroundColor: colors.primary + '08' },
  pickerItemText: { fontSize: 14, color: '#374151' },
  pickerItemTextSelected: { color: colors.primary, fontWeight: '600' },
})
