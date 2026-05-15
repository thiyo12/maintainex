import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

export default function BookingsScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<any[]>([])

  useEffect(() => {
    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/bookings`)
      if (res.ok) {
        const data = await res.json()
        setBookings(data)
      }
    } catch {}
    finally { setLoading(false) }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Bookings</Text>
      </View>

      {bookings.length > 0 ? (
        <ScrollView style={styles.scroll}>
          {bookings.map((booking) => (
            <View key={booking.id} style={styles.card}>
              <Text style={styles.cardTitle}>{booking.service?.name || 'Service Booking'}</Text>
              <View style={styles.cardRow}>
                <Text style={styles.cardText}>{new Date(booking.date).toLocaleDateString()}</Text>
                <Text style={styles.cardText}>{booking.timeSlot}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.price}>LKR {booking.totalPrice.toLocaleString()}</Text>
                <Text style={[styles.status, getStatusStyle(booking.status)]}>
                  {booking.status.replace(/_/g, ' ')}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push('/booking' as any)}
          >
            <Text style={styles.emptyBtnText}>Book a Service</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

function getStatusStyle(status: string) {
  const colors: Record<string, object> = {
    PENDING: { color: '#D97706', backgroundColor: '#FEF3C7' },
    CONFIRMED: { color: '#2563EB', backgroundColor: '#DBEAFE' },
    IN_PROGRESS: { color: '#2563EB', backgroundColor: '#DBEAFE' },
    COMPLETED: { color: '#059669', backgroundColor: '#D1FAE5' },
    CANCELLED: { color: '#DC2626', backgroundColor: '#FEE2E2' },
  }
  return colors[status] || { color: '#6B7280', backgroundColor: '#F3F4F6' }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, paddingTop: 50, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backText: { fontSize: 14, color: '#6B7280' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginTop: 8 },
  scroll: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cardText: { fontSize: 14, color: '#6B7280' },
  price: { fontSize: 16, fontWeight: 'bold', color: '#4F46E5' },
  status: { fontSize: 12, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, color: '#9CA3AF', marginBottom: 16 },
  emptyBtn: { backgroundColor: '#4F46E5', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
})
