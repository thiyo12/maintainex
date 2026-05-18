import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { bookings } from '../../../lib/api'
import { colors } from '../../../lib/colors'
import type { Booking } from '../../../lib/types'

export default function LiveTrackingScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const pulseAnim = useRef(new Animated.Value(1)).current
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [stepIndex, setStepIndex] = useState(1)

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    )
    pulse.start()

    if (id) {
      bookings.get(id as string)
        .then((b) => {
          setBooking(b)
          const statusMap: Record<string, number> = { PENDING: 0, CONFIRMED: 0, ASSIGNED: 1, IN_PROGRESS: 2, COMPLETED: 3, CANCELLED: -1 }
          setStepIndex(statusMap[b.status] ?? 0)
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }

    return () => pulse.stop()
  }, [id])

  const progressSteps = [
    { label: 'Assigned', time: '—', done: stepIndex >= 1 },
    { label: 'En route', time: '—', done: stepIndex >= 2 },
    { label: 'In progress', time: '—', done: stepIndex >= 3 },
    { label: 'Completed', time: 'Pending', done: stepIndex >= 4 },
  ]

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Live tracking</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map" size={48} color="rgba(255,255,255,0.9)" />
          <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
          <Text style={styles.mapText}>Tasker location live</Text>
          <Text style={styles.mapSub}>{booking?.district || 'Colombo'} • 1.2 km away</Text>
          <View style={styles.etaBox}>
            <Text style={styles.etaLabel}>Estimated arrival</Text>
            <Text style={styles.etaValue}>12 min</Text>
          </View>
        </View>

        <View style={styles.taskerCard}>
          <View style={styles.taskerLeft}>
            <View style={styles.taskerAvatar}>
              <Text style={styles.avatarText}>{booking?.customerName?.[0] || 'T'}</Text>
              <View style={styles.onlineDot} />
            </View>
            <View style={styles.taskerInfo}>
              <Text style={styles.taskerName}>{booking?.customerName || 'Tasker'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <Text style={[styles.taskerSkill, { marginTop: 0 }]}>{booking?.serviceName || 'Professional'} • </Text>
                <Ionicons name="star" size={13} color="#F59E0B" />
                <Text style={[styles.taskerSkill, { marginTop: 0 }]}> 4.8</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green, marginRight: 4 }} />
                <Text style={[styles.taskerStatus, { marginTop: 0 }]}>On the way</Text>
              </View>
            </View>
          </View>
          <View style={styles.taskerActions}>
            <TouchableOpacity style={styles.callBtn}>
              <Ionicons name="call-outline" size={16} color={colors.dark} />
              <Text style={styles.callBtnText}> Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.chatBtn} onPress={() => router.push('/(chat)/' + id)}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.white} />
              <Text style={styles.chatBtnText}> Chat</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.jobCard}>
          <Text style={styles.jobTitle}>{booking?.serviceName || 'Service'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Ionicons name="location-outline" size={14} color={colors.gray} />
            <Text style={styles.jobMeta}> {booking?.district || ''} • Urgent</Text>
          </View>
          <Text style={styles.jobPrice}>LKR {(booking?.price || 0).toLocaleString()}</Text>
        </View>

        <View style={styles.progressSection}>
          <Text style={styles.sectionTitle}>Progress</Text>
          {progressSteps.map((step, i) => (
            <View key={i} style={styles.progressRow}>
              <View style={styles.progressLeft}>
                <View style={[styles.progressDot, step.done && styles.progressDotDone, i === stepIndex && styles.progressDotCurrent]}>
                  {step.done ? <Ionicons name="checkmark" size={14} color={colors.white} /> : <Text style={styles.progressNum}>{i + 1}</Text>}
                </View>
                {i < progressSteps.length - 1 ? (
                  <View style={[styles.progressLine, step.done && styles.progressLineDone]} />
                ) : null}
              </View>
              <View style={styles.progressContent}>
                <Text style={[styles.progressLabel, step.done && styles.progressLabelDone]}>{step.label}</Text>
                <Text style={styles.progressTime}>{step.time}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {stepIndex === 2 ? (
        <TouchableOpacity
          style={styles.completeBtn}
          onPress={() => router.push('/(customer)/jobs/complete/' + id)}
        >
          <Text style={styles.completeBtnText}>Mark as complete</Text>
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 8 },
  backBtn: { width: 60 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  topTitle: { fontSize: 18, fontWeight: '700', color: colors.dark, textAlign: 'center' },
  mapPlaceholder: {
    backgroundColor: colors.primary, marginHorizontal: 24, borderRadius: 20, height: 220,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16, overflow: 'hidden',
  },
  pulseDot: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: colors.green,
    position: 'absolute', top: '45%', left: '55%',
  },
  mapText: { fontSize: 18, fontWeight: '700', color: colors.white, marginBottom: 4 },
  mapSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 12 },
  etaBox: {
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 20, flexDirection: 'row', gap: 8, alignItems: 'center',
  },
  etaLabel: { fontSize: 13, color: colors.white, fontWeight: '500' },
  etaValue: { fontSize: 13, color: colors.white, fontWeight: '800' },
  taskerCard: {
    backgroundColor: colors.white, marginHorizontal: 24, padding: 16, borderRadius: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  taskerLeft: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  taskerAvatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: colors.white },
  onlineDot: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: colors.green,
    borderWidth: 2, borderColor: colors.white, position: 'absolute', bottom: 0, right: 0,
  },
  taskerInfo: { flex: 1 },
  taskerName: { fontSize: 16, fontWeight: '700', color: colors.dark },
  taskerSkill: { fontSize: 13, color: colors.gray, marginTop: 2 },
  taskerStatus: { fontSize: 13, color: colors.green, marginTop: 2, fontWeight: '600' },
  taskerActions: { flexDirection: 'row', gap: 10 },
  callBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
    borderColor: colors.lightGray, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  callBtnText: { fontSize: 14, fontWeight: '600', color: colors.dark },
  chatBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: colors.primary, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  chatBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
  jobCard: {
    backgroundColor: colors.white, marginHorizontal: 24, padding: 16, borderRadius: 14, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  jobTitle: { fontSize: 16, fontWeight: '700', color: colors.dark, marginBottom: 4 },
  jobMeta: { fontSize: 13, color: colors.gray, marginBottom: 4 },
  jobPrice: { fontSize: 18, fontWeight: '800', color: colors.primary },
  progressSection: {
    backgroundColor: colors.white, marginHorizontal: 24, padding: 16, borderRadius: 14,
    marginBottom: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.dark, marginBottom: 16 },
  progressRow: { flexDirection: 'row', marginBottom: 4 },
  progressLeft: { alignItems: 'center', width: 32, marginRight: 12 },
  progressDot: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.lightGray,
    justifyContent: 'center', alignItems: 'center',
  },
  progressDotDone: { backgroundColor: colors.green },
  progressDotCurrent: { backgroundColor: colors.primary },
  progressNum: { fontSize: 12, color: colors.gray, fontWeight: '600' },
  progressLine: { width: 2, height: 28, backgroundColor: colors.lightGray },
  progressLineDone: { backgroundColor: colors.green },
  progressContent: { paddingTop: 4, flex: 1 },
  progressLabel: { fontSize: 15, color: colors.gray, fontWeight: '500' },
  progressLabelDone: { color: colors.dark, fontWeight: '600' },
  progressTime: { fontSize: 12, color: colors.gray, marginTop: 2 },
  completeBtn: {
    backgroundColor: colors.green, marginHorizontal: 24, marginBottom: 32,
    paddingVertical: 16, borderRadius: 14, alignItems: 'center',
  },
  completeBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
})