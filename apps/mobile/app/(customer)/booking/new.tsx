import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { categories as categoriesApi, bookings as bookingsApi } from '../../../lib/api'
import { Category, Service } from '../../../lib/types'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  background: '#F9FAFB',
  white: '#FFFFFF',
  green: '#10B981',
  red: '#EF4444',
}

const DISTRICTS = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle',
  'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle',
  'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara', 'Monaragala',
  'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura',
  'Trincomalee', 'Vavuniya',
]

const TIME_SLOTS = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM',
]

type Step = 'service' | 'info' | 'schedule' | 'confirm'

export default function NewBookingScreen() {
  const router = useRouter()
  const { category } = useLocalSearchParams<{ category?: string }>()

  const [step, setStep] = useState<Step>('service')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [district, setDistrict] = useState('')
  const [address, setAddress] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    categoriesApi.list()
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filteredCategories = category
    ? categories.filter(c =>
        c.slug.toLowerCase().includes(category.toLowerCase()) ||
        c.name.toLowerCase().includes(category.toLowerCase())
      )
    : categories

  const selectedService = categories
    .flatMap(c => c.services)
    .find(s => s.id === selectedServiceId)

  const selectedCategory = categories.find(c =>
    c.services.some(s => s.id === selectedServiceId)
  )

  const canProceed = () => {
    switch (step) {
      case 'service': return !!selectedServiceId
      case 'info': return name.trim().length >= 1 && phone.replace(/\D/g, '').length >= 9
      case 'schedule': return !!district && !!date && !!time
      case 'confirm': return true
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await bookingsApi.create({
        name, phone, email,
        serviceId: selectedServiceId,
        district, address, date, time, notes,
      })
      if (res.booking) {
        router.push(`/(customer)/booking/confirmation?id=${res.booking.id}`)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit booking')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => step === 'service' ? router.back() : setStep('service')}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.progressBar}>
        {['service', 'info', 'schedule', 'confirm'].map((s, i) => (
          <View key={s} style={styles.progressRow}>
            <View style={[
              styles.progressDot,
              (step === s || ['info', 'schedule', 'confirm'].indexOf(step) > i) && styles.progressActive,
            ]}>
              <Text style={styles.progressNum}>{i + 1}</Text>
            </View>
            {i < 3 && <View style={[styles.progressLine, ['info', 'schedule', 'confirm'].indexOf(step) > i && styles.progressLineActive]} />}
          </View>
        ))}
      </View>

      {step === 'service' && (
        <View>
          <Text style={styles.stepTitle}>Select a Service</Text>
          <Text style={styles.stepSubtitle}>
            {category ? `Showing ${category.replace(/-/g, ' ')} services` : 'All categories'}
          </Text>

          {filteredCategories.map(cat => (
            <View key={cat.id} style={styles.categorySection}>
              <Text style={styles.catName}>{cat.name}</Text>
              <View style={styles.serviceGrid}>
                {cat.services.map(svc => (
                  <TouchableOpacity
                    key={svc.id}
                    style={[
                      styles.serviceCard,
                      selectedServiceId === svc.id && styles.serviceCardActive,
                    ]}
                    onPress={() => { setSelectedServiceId(svc.id); setStep('info') }}
                  >
                    <Text style={[styles.serviceName, selectedServiceId === svc.id && styles.serviceNameActive]}>
                      {svc.name}
                    </Text>
                    <Text style={styles.servicePrice}>LKR {svc.price?.toLocaleString()}+</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
          {filteredCategories.length === 0 && (
            <Text style={styles.emptyText}>No services found.</Text>
          )}
        </View>
      )}

      {step === 'info' && (
        <View>
          <Text style={styles.stepTitle}>Your Information</Text>

          {selectedService && (
            <View style={styles.selectedDisplay}>
              <View>
                {selectedCategory && <Text style={styles.selectedCat}>{selectedCategory.name}</Text>}
                <Text style={styles.selectedName}>{selectedService.name}</Text>
                <Text style={styles.selectedPrice}>LKR {selectedService.price?.toLocaleString()}+</Text>
              </View>
              <TouchableOpacity onPress={() => setStep('service')}>
                <Text style={styles.changeText}>Change</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.label}>Full Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Enter your name" />

          <Text style={styles.label}>Phone *</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="0712345678" keyboardType="phone-pad" />

          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="your@email.com" keyboardType="email-address" autoCapitalize="none" />

          <TouchableOpacity style={[styles.button, !canProceed() && styles.buttonDisabled]} disabled={!canProceed()} onPress={() => setStep('schedule')}>
            <Text style={styles.buttonText}>Next →</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'schedule' && (
        <View>
          <Text style={styles.stepTitle}>Schedule</Text>

          <Text style={styles.label}>District *</Text>
          <View style={styles.pickerRow}>
            {DISTRICTS.map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.pickerOption, district === d && styles.pickerActive]}
                onPress={() => setDistrict(d)}
              >
                <Text style={[styles.pickerText, district === d && styles.pickerTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Date *</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
          />

          <Text style={styles.label}>Time *</Text>
          <View style={styles.pickerRow}>
            {TIME_SLOTS.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.pickerOptionSmall, time === t && styles.pickerActive]}
                onPress={() => setTime(t)}
              >
                <Text style={[styles.pickerText, time === t && styles.pickerTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Address</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Your address" />

          <Text style={styles.label}>Notes</Text>
          <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes} placeholder="Any special requirements?" multiline numberOfLines={3} />

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('info')}>
              <Text style={styles.secondaryButtonText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonFlex, !canProceed() && styles.buttonDisabled]} disabled={!canProceed()} onPress={() => setStep('confirm')}>
              <Text style={styles.buttonText}>Review →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 'confirm' && (
        <View>
          <Text style={styles.stepTitle}>Booking Summary</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.summaryCard}>
            {[
              ['Name', name],
              ['Phone', phone],
              ['Email', email],
              ['Service', selectedService?.name],
              ['Category', selectedCategory?.name],
              ['District', district],
              ['Address', address],
              ['Date', date],
              ['Time', time],
              ['Notes', notes],
            ].filter(([_, v]) => v).map(([label, value]) => (
              <View key={label as string} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{label as string}</Text>
                <Text style={styles.summaryValue}>{value as string}</Text>
              </View>
            ))}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>LKR {selectedService?.price?.toLocaleString() || 'TBD'}</Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('schedule')}>
              <Text style={styles.secondaryButtonText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonFlex, submitting && styles.buttonDisabled]} disabled={submitting} onPress={handleSubmit}>
              {submitting ? (
                <ActivityIndicator color={colors.dark} />
              ) : (
                <Text style={styles.buttonText}>Submit Booking</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600', marginBottom: 24 },
  progressBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginBottom: 32, gap: 0,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center' },
  progressDot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.lightGray, alignItems: 'center', justifyContent: 'center',
  },
  progressActive: { backgroundColor: colors.primary },
  progressNum: { fontSize: 14, fontWeight: '700', color: colors.dark },
  progressLine: { width: 40, height: 3, backgroundColor: colors.lightGray, marginHorizontal: 4 },
  progressLineActive: { backgroundColor: colors.primary },
  stepTitle: { fontSize: 24, fontWeight: '800', color: colors.dark, marginBottom: 8 },
  stepSubtitle: { fontSize: 14, color: colors.gray, marginBottom: 24 },
  categorySection: { marginBottom: 20 },
  catName: { fontSize: 16, fontWeight: '700', color: colors.dark, marginBottom: 10 },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceCard: {
    width: '48%', padding: 14, borderRadius: 12,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lightGray,
  },
  serviceCardActive: { borderColor: colors.primary, backgroundColor: '#FFFBEB' },
  serviceName: { fontSize: 13, fontWeight: '600', color: colors.dark, marginBottom: 4 },
  serviceNameActive: { color: colors.dark },
  servicePrice: { fontSize: 12, fontWeight: '700', color: colors.primary },
  emptyText: { color: colors.gray, textAlign: 'center', marginTop: 40 },
  selectedDisplay: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFFBEB', borderWidth: 1.5, borderColor: colors.primary,
    borderRadius: 12, padding: 14, marginBottom: 20,
  },
  selectedCat: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  selectedName: { fontSize: 16, fontWeight: '700', color: colors.dark, marginTop: 2 },
  selectedPrice: { fontSize: 16, fontWeight: '700', color: colors.primary, marginTop: 4 },
  changeText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  label: { fontSize: 14, fontWeight: '600', color: colors.dark, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lightGray,
    borderRadius: 12, padding: 14, fontSize: 15, color: colors.dark,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerOption: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lightGray,
  },
  pickerOptionSmall: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lightGray,
  },
  pickerActive: { borderColor: colors.primary, backgroundColor: '#FFFBEB' },
  pickerText: { fontSize: 13, color: colors.dark, fontWeight: '500' },
  pickerTextActive: { color: colors.primary },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 32 },
  button: {
    backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', marginTop: 24,
  },
  buttonFlex: { flex: 1, marginTop: 0 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '700', color: colors.dark },
  secondaryButton: {
    paddingVertical: 16, paddingHorizontal: 24, borderRadius: 14,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lightGray,
  },
  secondaryButtonText: { fontSize: 16, fontWeight: '600', color: colors.dark },
  errorBox: {
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 12, padding: 14, marginBottom: 16,
  },
  errorText: { color: colors.red, fontSize: 14 },
  summaryCard: {
    backgroundColor: colors.white, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.background,
  },
  summaryLabel: { fontSize: 14, color: colors.gray },
  summaryValue: { fontSize: 14, fontWeight: '600', color: colors.dark, maxWidth: '60%', textAlign: 'right' },
  totalRow: { borderBottomWidth: 0, marginTop: 8, paddingTop: 16 },
  totalLabel: { fontSize: 18, fontWeight: '800', color: colors.dark },
  totalValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
})
