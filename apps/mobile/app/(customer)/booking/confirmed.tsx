import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const colors = {
  green: '#10B981',
  purple: '#7C3AED',
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  white: '#FFFFFF',
}

const steps = [
  { label: 'Booking confirmed', filled: true },
  { label: 'Payment secured', filled: true },
  { label: 'Worker on the way', filled: false },
  { label: 'Job completed', filled: false },
]

export default function BookingConfirmedScreen() {
  const router = useRouter()
  const scaleAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 60,
      useNativeDriver: true,
    }).start()
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.circle, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.checkmark}>✓</Text>
      </Animated.View>
      <Text style={styles.heading}>Booking confirmed</Text>
      <Text style={styles.subheading}>Payment secured in escrow</Text>

      <View style={styles.summary}>
        <Text style={styles.sumLabel}>Fix leaking pipe</Text>
        <Text style={styles.sumValue}>Kamal Perera • Plumber</Text>
        <Text style={styles.sumValue}>📅 Today at 2:00 PM</Text>
        <Text style={styles.sumValue}>📍 Colombo 03</Text>
        <Text style={styles.totalAmount}>LKR 8,925</Text>
      </View>

      <View style={styles.tracker}>
        {steps.map((s, i) => (
          <View key={i} style={styles.trackerStep}>
            <View style={[styles.trackerDot, s.filled && styles.trackerDotFilled]}>
              {s.filled ? <Text style={styles.trackerCheck}>✓</Text> : <Text style={styles.trackerNum}>{i + 1}</Text>}
            </View>
            <Text style={[styles.trackerLabel, s.filled && styles.trackerLabelFilled]}>{s.label}</Text>
            {i < steps.length - 1 ? <View style={[styles.trackerLine, s.filled && styles.trackerLineFilled]} /> : null}
          </View>
        ))}
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.mapBtn} onPress={() => router.push('/(customer)/tracking/1')}>
          <Text style={styles.mapBtnText}>🗺️ Track on map</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chatBtn} onPress={() => router.push('/(chat)/1')}>
          <Text style={styles.chatBtnText}>💬 Chat with worker</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', paddingHorizontal: 24, paddingTop: 40 },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.green,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkmark: { fontSize: 36, color: colors.white, fontWeight: '700' },
  heading: { fontSize: 26, fontWeight: '800', color: colors.dark, marginBottom: 4 },
  subheading: { fontSize: 15, color: colors.gray, marginBottom: 28 },
  summary: {
    backgroundColor: colors.white,
    width: '100%',
    padding: 18,
    borderRadius: 14,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sumLabel: { fontSize: 16, fontWeight: '700', color: colors.dark, marginBottom: 8 },
  sumValue: { fontSize: 14, color: colors.gray, marginBottom: 4 },
  totalAmount: { fontSize: 20, fontWeight: '800', color: colors.primary, marginTop: 8 },
  tracker: { width: '100%', paddingHorizontal: 16, marginBottom: 32 },
  trackerStep: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  trackerDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  trackerDotFilled: { backgroundColor: colors.green },
  trackerCheck: { fontSize: 14, color: colors.white, fontWeight: '700' },
  trackerNum: { fontSize: 12, color: colors.gray, fontWeight: '600' },
  trackerLabel: { fontSize: 15, color: colors.gray, fontWeight: '500', paddingTop: 4 },
  trackerLabelFilled: { color: colors.dark, fontWeight: '600' },
  trackerLine: {
    width: 2,
    height: 24,
    backgroundColor: colors.lightGray,
    marginLeft: 13,
  },
  trackerLineFilled: { backgroundColor: colors.green },
  buttons: { width: '100%', gap: 12 },
  mapBtn: {
    backgroundColor: colors.purple,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  mapBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  chatBtn: {
    backgroundColor: colors.white,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.lightGray,
  },
  chatBtnText: { fontSize: 16, fontWeight: '700', color: colors.dark },
})
