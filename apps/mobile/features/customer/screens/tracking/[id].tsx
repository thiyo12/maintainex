import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, Animated } from 'react-native'
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, AnimatedRegion } from 'react-native-maps'
import MapViewDirections from 'react-native-maps-directions'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { ArrowLeft, Star, Check, ChatCircle, PaperPlaneTilt, Timer, Hash } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import Reanimated, { ZoomIn } from 'react-native-reanimated'

import { useColors } from '@/lib/ThemeContext'
import { v2Jobs } from '@/lib/api-v2'
import { colors, spacing, radius, typography, shadows } from '@/lib/design'

import AvatarCircle from '@/components/ui/AvatarCircle'
import PressableScale from '@/components/ui/PressableScale'
import NewChatModal from '@/features/messaging/components/NewChatModal'

const AnimatedMarker = Animated.createAnimatedComponent(Marker) as any

const { height: WIN_H } = Dimensions.get('window')

const FALLBACK_COORDS = { latitude: 9.6615, longitude: 80.0255 }

function rad(d: number) { return (d * Math.PI) / 180 }
function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371
  const dLat = rad(b.latitude - a.latitude)
  const dLon = rad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export default function LiveTrackingScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const sheetRef = useRef<BottomSheet>(null)
  const mapRef = useRef<MapView>(null)

  const pulseAnim = useRef(new Animated.Value(1)).current
  const routePulse = useRef(new Animated.Value(1)).current
  const animCoord = useRef(
    new AnimatedRegion({ latitude: FALLBACK_COORDS.latitude, longitude: FALLBACK_COORDS.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 })
  ).current

  const [job, setJob] = useState<any>(null)
  const [workspace, setWorkspace] = useState<any>(null)
  const [sharing, setSharing] = useState(false)
  const [providerCoord, setProviderCoord] = useState<{ latitude: number; longitude: number } | null>(null)
  const [eta, setEta] = useState<number | null>(null)
  const [routeDistance, setRouteDistance] = useState<number | null>(null)
  const [routeFailed, setRouteFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [chatVisible, setChatVisible] = useState(false)
  const liveFailed = useRef(false)

  const provider = job?.acceptedQuote?.provider

  const jobCoords = useMemo(
    () => (typeof job?.latitude === 'number' && typeof job?.longitude === 'number'
      ? { latitude: job.latitude, longitude: job.longitude }
      : null),
    [job]
  )

  const step = useMemo(() => {
    const ws = workspace?.progressStatus
    if (job?.status === 'COMPLETED' || job?.status === 'CANCELLED' || ws === 'COMPLETED' || ws === 'COMPLETION_REQUESTED') return 5
    if (ws === 'IN_PROGRESS' || job?.status === 'IN_PROGRESS') return 4
    if (sharing && providerCoord) {
      if (jobCoords && distanceKm(providerCoord, jobCoords) <= 0.15) return 3
      return 2
    }
    return 1
  }, [workspace, job, sharing, providerCoord, jobCoords])

  const loadData = useCallback(async () => {
    try {
      const res = await v2Jobs.get(id)
      setJob(res.job)
      setWorkspace(res.job.workspace || null)
      if (res.job.acceptedQuote?.provider?.latitude) {
        setProviderCoord({ latitude: res.job.acceptedQuote.provider.latitude, longitude: res.job.acceptedQuote.provider.longitude })
      }
    } catch {
      console.error('tracking load failed')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    )
    pulse.start()
    const routeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(routePulse, { toValue: 1.3, duration: 750, useNativeDriver: true }),
        Animated.timing(routePulse, { toValue: 1, duration: 750, useNativeDriver: true }),
      ])
    )
    routeLoop.start()
    if (id) loadData()
    return () => { pulse.stop(); routeLoop.stop() }
  }, [id, loadData, pulseAnim, routePulse])

  useEffect(() => {
    if (!id || job?.status === 'COMPLETED' || job?.status === 'CANCELLED') return
    const interval = setInterval(async () => {
      try {
        const live = await v2Jobs.getTaskerLocation(id)
        if (live.sharing && live.location && typeof live.location.latitude === 'number') {
          setSharing(true)
          setProviderCoord({ latitude: live.location.latitude, longitude: live.location.longitude })
          liveFailed.current = false
        } else {
          liveFailed.current = true
        }
      } catch {
        liveFailed.current = true
      }
      try {
        const res = await v2Jobs.get(id)
        setJob(res.job)
        setWorkspace(res.job.workspace || null)
        if (liveFailed.current && res.job.acceptedQuote?.provider?.latitude) {
          setProviderCoord({
            latitude: res.job.acceptedQuote.provider.latitude,
            longitude: res.job.acceptedQuote.provider.longitude,
          })
        }
      } catch {}
    }, 15000)
    return () => clearInterval(interval)
  }, [id, job?.status])

  useEffect(() => {
    if (!providerCoord) return
    Animated.timing(animCoord, {
      toValue: { latitude: providerCoord.latitude, longitude: providerCoord.longitude },
      duration: 1500,
      useNativeDriver: false,
    }).start()
  }, [providerCoord, animCoord])

  const reg = useMemo(() => {
    const base = jobCoords || FALLBACK_COORDS
    return {
      latitude: providerCoord?.latitude ?? base.latitude,
      longitude: providerCoord?.longitude ?? base.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }
  }, [jobCoords, providerCoord])

  const statusLabel =
    step === 5 ? t('ui.statusDone') :
    step === 4 ? t('ui.statusWorking') :
    step === 3 ? t('ui.statusArrived') :
    step === 2 ? t('ui.statusEnRoute') : t('ui.statusReady')

  const steps = useMemo(() => t('ui.steps', { returnObjects: true }) as string[], [t])

  const ref = id ? id.slice(-6).toUpperCase() : ''

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 120 }} />
      </SafeAreaView>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapArea}>
        <MapView ref={mapRef} provider={PROVIDER_DEFAULT} style={StyleSheet.absoluteFill} initialRegion={reg}>
          {jobCoords && (
            <Marker coordinate={jobCoords} anchor={{ x: 0.5, y: 1 }} title={job?.title || t('booking.jobLocation')}>
              <View style={styles.destMarker}>
                <Text style={styles.destMarkerText}>YOUR LOCATION</Text>
              </View>
            </Marker>
          )}
          {providerCoord && (
            <AnimatedMarker coordinate={animCoord} anchor={{ x: 0.5, y: 0.5 }} title={provider?.name || t('tracking.provider')}>
              <View style={styles.taskerCircle}>
                <Text style={styles.taskerEmoji}>🔧</Text>
              </View>
            </AnimatedMarker>
          )}
          {providerCoord && jobCoords && job?.status !== 'COMPLETED' && job?.status !== 'CANCELLED' && (
            routeFailed ? (
              <Polyline
                coordinates={[providerCoord, jobCoords]}
                strokeColor="#F5A623"
                strokeWidth={4}
                lineDashPattern={[8, 4]}
              />
            ) : (
              <MapViewDirections
                origin={providerCoord}
                destination={jobCoords}
                apikey=""
                strokeWidth={4}
                strokeColor="#F5A623"
                optimizeWaypoints={true}
                onReady={(result) => {
                  setEta(Math.ceil(result.duration))
                  setRouteDistance(result.distance)
                  mapRef.current?.fitToCoordinates(result.coordinates, {
                    edgePadding: { top: 80, right: 40, bottom: 300, left: 40 },
                    animated: true,
                  })
                }}
                onError={() => setRouteFailed(true)}
              />
            )
          )}
        </MapView>

        <View style={styles.overlayTop}>
          <View style={styles.etaPill}>
            <View style={[styles.etaDot, { backgroundColor: step >= 2 ? colors.success : colors.muted }]} />
            <Text style={styles.etaText}>
              {step === 5 ? t('ui.statusDone') : step >= 2 ? t('ui.liveSharing') : t('ui.waitingTasker')}
            </Text>
          </View>
          <PressableScale onPress={() => router.back()} scaleTo={0.92} style={styles.backPress}>
            <View style={styles.backBtn}>
              <ArrowLeft size={20} color={colors.ink} weight="bold" />
            </View>
          </PressableScale>
        </View>
      </View>

      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={['25%', '60%', '92%']}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.statusTitle}>{statusLabel}</Text>

          {eta !== null && step <= 3 && (
            <View style={styles.etaRow}>
              <View style={styles.routeDotWrap}>
                <Animated.View style={[styles.routeDot, { transform: [{ scale: routePulse }] }]} />
              </View>
              <Text style={styles.etaText}>In transit · arriving in {eta} min</Text>
              <Text style={styles.distText}>{routeDistance?.toFixed(1)} km left</Text>
            </View>
          )}

          <View style={styles.progressRow}>
            {steps.map((label, i) => {
              const active = i < step
              const current = i === step
              return (
                <View key={label} style={styles.stepCol}>
                  {current ? (
                    <Reanimated.View entering={ZoomIn.springify().damping(14).stiffness(260)} style={styles.dotWrap}>
                      <View style={styles.dotActive}>
                        <Text style={styles.dotNum}>{i + 1}</Text>
                      </View>
                    </Reanimated.View>
                  ) : active ? (
                    <Reanimated.View entering={ZoomIn.springify().damping(14).stiffness(260)} style={styles.dotWrap}>
                      <View style={styles.dotDone}>
                        <Check size={14} color={colors.ink} weight="bold" />
                      </View>
                    </Reanimated.View>
                  ) : (
                    <View style={styles.dotWrap}>
                      <View style={styles.dotIdle}>
                        <Text style={styles.dotNumIdle}>{i + 1}</Text>
                      </View>
                    </View>
                  )}
                  <Text style={[styles.stepLabel, current && styles.stepLabelCurrent, active && styles.stepLabelDone]}>
                    {label}
                  </Text>
                  {i < steps.length - 1 && (
                    <View style={[styles.connector, active && styles.connectorActive]} />
                  )}
                </View>
              )
            })}
          </View>

          <View style={styles.taskerCard}>
            <AvatarCircle uri={provider?.avatar || provider?.profileImage} name={provider?.name || t('tracking.provider')} size={52} showOnline={sharing} showVerified={!!provider?.isVerified} verified={!!provider?.isVerified} />
            <View style={styles.taskerInfo}>
              <Text style={styles.taskerName}>{provider?.name || t('tracking.provider')}</Text>
              <View style={styles.ratingRow}>
                <Star size={13} color={colors.amber} weight="fill" />
                <Text style={styles.ratingText}>{provider?.rating ? provider.rating.toFixed(1) : '4.8'}</Text>
              </View>
            </View>
            <View style={styles.refPill}>
              <Hash size={12} color={colors.muted} weight="bold" />
              <Text style={styles.refText}>{t('ui.refCode', { code: ref })}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <PressableScale onPress={() => setChatVisible(true)} scaleTo={0.97} style={styles.msgPress}>
              <View style={styles.msgBtn}>
                <ChatCircle size={19} color={colors.accent} weight="fill" />
                <Text style={styles.msgText}>{t('ui.msgTasker')}</Text>
              </View>
            </PressableScale>
            {step >= 4 && step < 5 ? (
              <PressableScale onPress={() => router.push(`/(customer)/jobs/complete/${id}` as any)} scaleTo={0.97} style={styles.completePress}>
                <View style={styles.completeBtn}>
                  <PaperPlaneTilt size={18} color={colors.ink} weight="fill" />
                  <Text style={styles.completeText}>{t('ui.markComplete')}</Text>
                </View>
              </PressableScale>
            ) : null}
          </View>

          {step < 2 ? (
            <View style={styles.waitCard}>
              <Timer size={16} color={colors.accent} weight="fill" />
              <Text style={styles.waitText}>{t('ui.holdTight')}</Text>
            </View>
          ) : null}
          <View style={{ height: WIN_H * 0.05 }} />
        </BottomSheetScrollView>
      </BottomSheet>

      <NewChatModal
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        recipient={provider ? { id: provider.id, name: provider.name } : null}
        jobId={id}
        jobTitle={job?.title}
        prefilled="Hi! I'm tracking my job with you."
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { flex: 1, backgroundColor: colors.background },
  mapArea: { flex: 1 },

  customerMarker: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.ink, ...shadows.card,
  },
  destMarker: {
    backgroundColor: '#0D0D0D',
    borderRadius: 8, padding: 6,
    borderWidth: 2, borderColor: '#F5A623',
  },
  destMarkerText: { color: '#F5A623', fontSize: 11, fontWeight: '700' },
  taskerCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#F5A623',
    borderWidth: 3, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3,
    shadowRadius: 4, elevation: 5,
  },
  taskerEmoji: { color: '#000', fontSize: 20 },
  taskerMarker: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: colors.accent, overflow: 'hidden',
  },
  taskerPulse: {
    position: 'absolute', width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(245,166,35,0.35)', top: -6, left: -6,
  },

  etaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.accentSoft, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  routeDotWrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  routeDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F5A623' },
  distText: { ...typography.caption, color: colors.ink, fontFamily: 'Outfit_600SemiBold' },

  overlayTop: { position: 'absolute', top: 46, left: 0, right: 0, alignItems: 'center' },
  etaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, ...shadows.card,
  },
  etaDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  etaText: { ...typography.caption, color: colors.ink, fontFamily: 'Outfit_600SemiBold' },
  backPress: { position: 'absolute', left: 14, top: 0 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, ...shadows.card,
  },

  sheetBg: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  sheetContent: { padding: spacing.lg, paddingTop: spacing.sm },

  statusTitle: { ...typography.h3, fontSize: 22, marginBottom: spacing.lg },

  progressRow: { flexDirection: 'row', marginBottom: spacing.lg },
  stepCol: { flex: 1, alignItems: 'center', position: 'relative' },
  dotWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dotActive: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 5,
  },
  dotDone: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.success,
    alignItems: 'center', justifyContent: 'center', margin: 3,
  },
  dotIdle: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', margin: 3 },
  dotNum: { ...typography.caption, color: colors.ink, fontFamily: 'Outfit_700Bold' },
  dotNumIdle: { ...typography.caption, color: colors.muted, fontFamily: 'Outfit_600SemiBold' },
  stepLabel: { ...typography.caption, color: colors.muted, marginTop: 6, fontSize: 10, textAlign: 'center' },
  stepLabelCurrent: { color: colors.accent, fontFamily: 'Outfit_700Bold' },
  stepLabelDone: { color: colors.ink, fontFamily: 'Outfit_600SemiBold' },
  connector: { position: 'absolute', top: 15, left: '50%', right: '-50%', height: 2, backgroundColor: colors.border },
  connectorActive: { backgroundColor: colors.accent },

  taskerCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg,
  },
  taskerInfo: { flex: 1, marginLeft: spacing.md },
  taskerName: { ...typography.body, fontFamily: 'Outfit_700Bold', fontSize: 16 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  ratingText: { ...typography.caption, color: colors.amber, fontFamily: 'Outfit_600SemiBold' },
  refPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  refText: { ...typography.caption, color: colors.ink, fontFamily: 'Outfit_600SemiBold' },

  actions: { flexDirection: 'row', gap: spacing.sm },
  msgPress: { flex: 1, borderRadius: radius.full },
  msgBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  msgText: { ...typography.body, color: colors.accent, fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  completePress: { flex: 1.3, borderRadius: radius.full },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: radius.full, backgroundColor: colors.accent,
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 7,
  },
  completeText: { ...typography.body, color: colors.ink, fontFamily: 'Outfit_700Bold', fontSize: 15 },

  waitCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg,
  },
  waitText: { ...typography.caption, color: colors.ink, fontFamily: 'Outfit_500Medium', flex: 1 },
})