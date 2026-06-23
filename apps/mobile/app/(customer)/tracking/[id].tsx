import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../../lib/auth'
import { useColors } from '../../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { fonts } from '../../../lib/fonts'
import { v2Jobs, v2JobActions } from '../../../lib/api-v2'
import Avatar from '../../../components/ui/Avatar'

const { height } = Dimensions.get('window')
const MAP_HEIGHT = height * 0.45

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
]

export default function LiveTrackingScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const pulseAnim = useRef(new Animated.Value(1)).current
  const [job, setJob] = useState<any>(null)
  const [workspace, setWorkspace] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')

  const statusMap: Record<string, { label: string; step: number }> = {
    ASSIGNED: { label: t('booking.statusOnWay'), step: 0 },
    EN_ROUTE: { label: t('booking.statusOnWay'), step: 1 },
    IN_PROGRESS: { label: t('booking.statusInProgress'), step: 2 },
    COMPLETED: { label: t('booking.statusCompleted'), step: 3 },
  }

  const progressSteps = [
    { label: t('booking.progressAssigned') },
    { label: t('booking.progressEnRoute') },
    { label: t('booking.progressInProgress') },
    { label: t('booking.progressCompleted') },
  ]

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    )
    pulse.start()
    if (id) loadData()
    return () => pulse.stop()
  }, [id])

  const loadData = async () => {
    try {
      const res = await v2Jobs.get(id)
      setJob(res.job)
      setWorkspace(res.job.workspace || null)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const step = job ? (statusMap[job.status]?.step ?? 0) : 0
  const statusLabel = job ? (statusMap[job.status]?.label ?? t('booking.statusInProgress')) : ''

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 100 }} />
      </SafeAreaView>
    )
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          customMapStyle={darkMapStyle}
          initialRegion={{
            latitude: 6.9271,
            longitude: 79.8612,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          <Marker
            coordinate={{ latitude: 6.9271, longitude: 79.8612 }}
            title={job?.title || t('booking.jobLocation')}
          >
            <View style={styles.customerMarker}>
              <Ionicons name="home" size={16} color={colors.white} />
            </View>
          </Marker>
        </MapView>

        {/* ETA Pill */}
        <View style={styles.etaPill}>
          <View style={styles.etaDot} />
          <Text style={styles.etaText}>{t('booking.arrivingIn')}</Text>
        </View>

        {/* Back Button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.handle} />
        <Text style={styles.statusTitle}>{statusLabel}</Text>

        {/* Progress */}
        <View style={styles.progressRow}>
          {progressSteps.map((s, i) => (
            <View key={i} style={styles.progressItem}>
              <View style={[styles.progressDot, i <= step && styles.progressDotActive]}>
                {i < step ? (
                  <Ionicons name="checkmark" size={12} color={colors.ink} />
                ) : (
                  <Text style={[styles.progressNum, i === step && styles.progressNumActive]}>{i + 1}</Text>
                )}
              </View>
              {i < progressSteps.length - 1 && (
                <View style={[styles.progressLine, i < step && styles.progressLineActive]} />
              )}
            </View>
          ))}
        </View>
        <View style={styles.progressLabelRow}>
          {progressSteps.map((s, i) => (
            <Text key={i} style={[styles.progressLabel, i === step && styles.progressLabelActive]}>{s.label}</Text>
          ))}
        </View>

        {/* Provider Card */}
        <View style={styles.providerCard}>
          <Avatar name={job?.acceptedQuote?.provider?.name || t('tracking.provider')} size={44} />
          <View style={styles.providerInfo}>
            <Text style={styles.providerName}>{job?.acceptedQuote?.provider?.name || t('tracking.provider')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="star" size={12} color={colors.amber} />
                  <Text style={styles.providerRating}> 4.8</Text>
                </View>
          </View>
          <View style={styles.providerActions}>
            <TouchableOpacity style={styles.callBtn}>
              <Ionicons name="call-outline" size={18} color={colors.ink} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.chatBtn}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Confirm Complete */}
        {step >= 3 && (
          <TouchableOpacity
            style={styles.completeBtn}
            onPress={() => router.push(`/(customer)/jobs/complete/${id}`)}
          >
            <Text style={styles.completeBtnText}>{t('tracking.confirmComplete')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  mapContainer: { height: MAP_HEIGHT },
  map: { flex: 1 },
  customerMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.info,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  etaPill: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  etaDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  etaText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink },
  backBtn: {
    position: 'absolute',
    top: 44,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  bottomSheet: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  statusTitle: { fontSize: 22, fontFamily: fonts.heading, color: colors.ink, marginBottom: 20 },

  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  progressItem: { flexDirection: 'row', alignItems: 'center' },
  progressDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  progressDotActive: { backgroundColor: colors.amber },
  progressNum: { fontSize: 11, fontFamily: fonts.bodyMedium, color: colors.muted },
  progressNumActive: { color: colors.ink },
  progressLine: { width: 24, height: 2, backgroundColor: colors.border, marginHorizontal: 4 },
  progressLineActive: { backgroundColor: colors.amber },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, marginTop: 6, marginBottom: 24 },
  progressLabel: { fontSize: 10, fontFamily: fonts.body, color: colors.muted, textAlign: 'center', width: 60 },
  progressLabelActive: { color: colors.amber, fontFamily: fonts.bodyMedium },

  providerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 16 },
  providerInfo: { flex: 1, marginLeft: 12 },
  providerName: { fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.ink },
  providerRating: { fontSize: 12, fontFamily: fonts.body, color: colors.muted, marginTop: 2 },
  providerActions: { flexDirection: 'row', gap: 8 },
  callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border },
  chatBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.amber, justifyContent: 'center', alignItems: 'center' },

  completeBtn: { backgroundColor: colors.success, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  completeBtnText: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.white },
})
