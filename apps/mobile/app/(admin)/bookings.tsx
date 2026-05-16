import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { bookings as bookingsApi } from '../../lib/api'
import { Booking } from '../../lib/types'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  background: '#F9FAFB',
  white: '#FFFFFF',
}

export default function AdminBookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const data = await bookingsApi.list()
      setBookings(data)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [])

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
      </View>

      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.serviceName}>{item.serviceName}</Text>
              <Text style={styles.status}>{item.status}</Text>
            </View>
            <Text style={styles.customerName}>{item.customerName}</Text>
            <Text style={styles.phone}>{item.customerPhone}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.date}>📅 {item.date}</Text>
              <Text style={styles.time}>⏰ {item.time}</Text>
              <Text style={styles.price}>LKR {item.price?.toLocaleString()}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}><Text style={styles.emptyText}>No bookings yet</Text></View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '800', color: colors.dark },
  list: { padding: 20, paddingTop: 0 },
  card: {
    backgroundColor: colors.white, borderRadius: 16, padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  serviceName: { fontSize: 16, fontWeight: '700', color: colors.dark, flex: 1 },
  status: { fontSize: 12, fontWeight: '600', color: colors.primary },
  customerName: { fontSize: 14, fontWeight: '600', color: colors.dark },
  phone: { fontSize: 13, color: colors.gray, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', gap: 12 },
  date: { fontSize: 12, color: colors.gray },
  time: { fontSize: 12, color: colors.gray },
  price: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: colors.gray },
})
