import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { CaretLeft, Check, DotsThree } from 'phosphor-react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { bookings } from '../../../lib/api'
import type { Booking } from '../../../lib/types'
import { v3 } from '../../../theme/v3/tokens'

export default function BookingConfirmedScreen() {
  const router = useRouter()
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(!!bookingId)

  useEffect(() => {
    if (!bookingId) {
      setLoading(false)
      return
    }
    bookings.get(bookingId)
      .then(setBooking)
      .catch(() => setBooking(null))
      .finally(() => setLoading(false))
  }, [bookingId])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.replace('/(customer)/(tabs)/activity' as any)} hitSlop={10}>
          <CaretLeft size={20} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={styles.headerButtonRight}><DotsThree size={17} color={v3.colors.ink} weight="bold" /></View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={v3.colors.ink} /></View>
      ) : (
        <View style={styles.center}>
          <View style={styles.successCircle}><Check size={30} color={v3.colors.ink} weight="bold" /></View>
          <View style={styles.badge}><Text style={styles.badgeText}>REQUEST SENT</Text></View>
          <Text style={styles.title}>Booking request sent</Text>
          <Text style={styles.body}>
            {booking?.serviceName ? `${booking.serviceName} is ready for provider confirmation. ` : ''}You’ll get an instant notification when the tasker accepts or sends a final quote.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/(customer)/(tabs)/activity' as any)} activeOpacity={0.82}>
            <Text style={styles.primaryButtonText}>View Activity</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  header: { height: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' },
  headerButton: { width: 36, height: 36, alignItems: 'flex-start', justifyContent: 'center' },
  headerButtonRight: { width: 36, height: 36, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 80 },
  successCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: v3.colors.successSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  badge: { minHeight: 27, paddingHorizontal: 13, borderRadius: 14, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 8.6, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.paper, letterSpacing: 0.5 },
  title: { marginTop: 28, fontSize: 26, fontFamily: 'Outfit_900Black', color: v3.colors.ink, textAlign: 'center' },
  body: { marginTop: 12, maxWidth: 330, fontSize: 10.4, lineHeight: 17, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary, textAlign: 'center' },
  primaryButton: { marginTop: 44, width: '100%', height: 54, borderRadius: 17, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 12, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.paper },
})
