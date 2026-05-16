import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { bookings as bookingsApi } from '../../../lib/api'
import { Booking } from '../../../lib/types'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  background: '#F9FAFB',
  white: '#FFFFFF',
  green: '#10B981',
}

export default function ConfirmationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      bookingsApi.get(id)
        .then(setBooking)
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [id])

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.successIcon}>
        <Text style={styles.checkmark}>✓</Text>
      </View>

      <Text style={styles.title}>Booking Confirmed!</Text>
      <Text style={styles.subtitle}>We'll contact you to confirm your appointment.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Booking Details</Text>
        {[
          ['Reference', booking?.id?.slice(-8).toUpperCase() || 'N/A'],
          ['Service', booking?.serviceName],
          ['Name', booking?.customerName],
          ['Phone', booking?.customerPhone],
          ['Email', booking?.customerEmail],
          ['Date', booking?.date],
          ['Time', booking?.time],
          ['District', booking?.district],
        ].filter(([_, v]) => v).map(([label, value]) => (
          <View key={label as string} style={styles.row}>
            <Text style={styles.label}>{label as string}</Text>
            <Text style={styles.value}>{value as string}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={() => router.push('/(customer)')}>
        <Text style={styles.buttonText}>Back to Home</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingTop: 60, alignItems: 'center', paddingBottom: 40 },
  successIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  checkmark: { fontSize: 36, color: colors.green, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800', color: colors.dark, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.gray, textAlign: 'center', marginBottom: 32 },
  card: {
    backgroundColor: colors.white, borderRadius: 16, padding: 20,
    width: '100%', marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.dark, marginBottom: 16 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.background,
  },
  label: { fontSize: 14, color: colors.gray },
  value: { fontSize: 14, fontWeight: '600', color: colors.dark, maxWidth: '55%', textAlign: 'right' },
  button: {
    backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', width: '100%',
  },
  buttonText: { fontSize: 16, fontWeight: '700', color: colors.dark },
})
