import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { bookings } from '../../../lib/api'
import { useColors } from '../../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import type { Booking } from '../../../lib/types'
import { Check, Calendar, MapPin, Map, ChatCircleDots } from 'phosphor-react-native'

export default function BookingConfirmedScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { bookingId } = useLocalSearchParams()
  const scaleAnim = useRef(new Animated.Value(0)).current
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1, friction: 4, tension: 60, useNativeDriver: true,
    }).start()

    if (bookingId) {
      bookings.get(bookingId as string)
        .then(setBooking)
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [bookingId])

  const stepLabels = t('booking.steps', { returnObjects: true }) as string[]
  const steps = stepLabels.map((label, i) => ({ label, filled: i < 2 }))

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.circle, { transform: [{ scale: scaleAnim }] }]}>
        <Check size={36} color={colors.white} weight="bold" />
      </Animated.View>
      <Text style={styles.heading}>{t('booking.confirmed')}</Text>
      <Text style={styles.subheading}>{t('booking.paymentSecured')}</Text>

      <View style={styles.summary}>
        <Text style={styles.sumLabel}>{booking?.serviceName || t('receipt.service')}</Text>
        <Text style={styles.sumValue}>{booking?.customerName || ''}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Calendar size={16} color={colors.gray} weight="bold" />
          <Text style={styles.sumValue}> {booking?.date ? new Date(booking.date).toLocaleDateString() : t('common.today')} at {booking?.time || ''}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <MapPin size={16} color={colors.gray} weight="bold" />
          <Text style={styles.sumValue}> {booking?.district || ''}</Text>
        </View>
        <Text style={styles.totalAmount}>LKR {(booking?.price || 0).toLocaleString()}</Text>
      </View>

      <View style={styles.tracker}>
        {steps.map((s, i) => (
          <View key={i} style={styles.trackerStep}>
            <View style={[styles.trackerDot, s.filled && styles.trackerDotFilled]}>
              {s.filled ? <Check size={14} color={colors.white} weight="bold" /> : <Text style={styles.trackerNum}>{i + 1}</Text>}
            </View>
            <Text style={[styles.trackerLabel, s.filled && styles.trackerLabelFilled]}>{s.label}</Text>
            {i < steps.length - 1 ? <View style={[styles.trackerLine, s.filled && styles.trackerLineFilled]} /> : null}
          </View>
        ))}
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.mapBtn} onPress={() => router.push(`/(customer)/tracking/${bookingId || 1}`)}>
          <Map size={18} color={colors.white} weight="bold" style={{ marginRight: 6 }} />
          <Text style={styles.mapBtnText}>{t('booking.trackOnMap')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chatBtn} onPress={() => router.push(`/(chat)/${bookingId || 1}`)}>
          <ChatCircleDots size={18} color={colors.dark} weight="bold" style={{ marginRight: 6 }} />
          <Text style={styles.chatBtnText}>{t('booking.chatWithWorker')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', paddingHorizontal: 24, paddingTop: 40 },
  circle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  heading: { fontSize: 26, fontWeight: '800', color: colors.dark, marginBottom: 4 },
  subheading: { fontSize: 15, color: colors.gray, marginBottom: 28 },
  summary: {
    backgroundColor: colors.white, width: '100%', padding: 18, borderRadius: 14, marginBottom: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  sumLabel: { fontSize: 16, fontWeight: '700', color: colors.dark, marginBottom: 8 },
  sumValue: { fontSize: 14, color: colors.gray, marginBottom: 4 },
  totalAmount: { fontSize: 20, fontWeight: '800', color: colors.primary, marginTop: 8 },
  tracker: { width: '100%', paddingHorizontal: 16, marginBottom: 32 },
  trackerStep: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  trackerDot: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.lightGray,
    justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2,
  },
  trackerDotFilled: { backgroundColor: colors.green },
  trackerCheck: { fontSize: 14, color: colors.white, fontWeight: '700' },
  trackerNum: { fontSize: 12, color: colors.gray, fontWeight: '600' },
  trackerLabel: { fontSize: 15, color: colors.gray, fontWeight: '500', paddingTop: 4 },
  trackerLabelFilled: { color: colors.dark, fontWeight: '600' },
  trackerLine: { width: 2, height: 24, backgroundColor: colors.lightGray, marginLeft: 13 },
  trackerLineFilled: { backgroundColor: colors.green },
  buttons: { width: '100%', gap: 12 },
  mapBtn: {
    backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  mapBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  chatBtn: {
    backgroundColor: colors.white, paddingVertical: 16, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.lightGray,
  },
  chatBtnText: { fontSize: 16, fontWeight: '700', color: colors.dark },
})
