import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, ChatCircle, MapPin, NavigationArrow, Star } from 'phosphor-react-native'

import { v2Jobs } from '../../../lib/api-v2'
import { v3 } from '../../../theme/v3/tokens'
import PressableScale from '../../../components/ui/PressableScale'
import AvatarCircle from '../../../components/ui/AvatarCircle'

export default function LiveTrackingWebScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [job, setJob] = useState<any>(null)
  const [sharing, setSharing] = useState(false)
  const [providerCoord, setProviderCoord] = useState<{ latitude: number; longitude: number } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const res = await v2Jobs.get(id)
      setJob(res.job)
      try {
        const live = await v2Jobs.getTaskerLocation(id)
        setSharing(Boolean(live.sharing && live.location))
        if (live.location) {
          setProviderCoord({ latitude: live.location.latitude, longitude: live.location.longitude })
        }
      } catch {
        setSharing(false)
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
    if (!id) return
    const timer = setInterval(load, 15000)
    return () => clearInterval(timer)
  }, [id, load])

  const provider = job?.acceptedQuote?.provider
  const status = useMemo(() => {
    const progress = job?.workspace?.progressStatus
    if (job?.status === 'COMPLETED' || progress === 'COMPLETED') return 'Completed'
    if (job?.status === 'IN_PROGRESS' || progress === 'IN_PROGRESS') return 'Job in progress'
    if (sharing) return 'Provider is on the way'
    return 'Waiting for live location'
  }, [job, sharing])

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={v3.colors.amber} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <PressableScale onPress={() => router.back()} scaleTo={0.95}>
            <View style={styles.iconButton}><ArrowLeft size={20} color={v3.colors.ink} weight="bold" /></View>
          </PressableScale>
          <Text style={styles.title}>Live tracking</Text>
          <View style={styles.iconSpacer} />
        </View>

        <View style={styles.mapFallback}>
          <View style={styles.mapIcon}><MapPin size={34} color={v3.colors.ink} weight="fill" /></View>
          <Text style={styles.mapTitle}>{status}</Text>
          <Text style={styles.mapText}>
            Live map rendering is available in the MaintainEX iOS and Android app.
          </Text>
          {providerCoord ? (
            <Text style={styles.coords}>
              {providerCoord.latitude.toFixed(5)}, {providerCoord.longitude.toFixed(5)}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <AvatarCircle
            uri={provider?.avatar || provider?.profileImage}
            name={provider?.name || 'Provider'}
            size={54}
            showOnline={sharing}
            showVerified={Boolean(provider?.isVerified)}
            verified={Boolean(provider?.isVerified)}
          />
          <View style={styles.providerInfo}>
            <Text style={styles.providerName}>{provider?.name || 'Provider'}</Text>
            <View style={styles.ratingRow}>
              <Star size={14} color={v3.colors.amber} weight="fill" />
              <Text style={styles.rating}>{provider?.rating ? Number(provider.rating).toFixed(1) : '—'}</Text>
            </View>
          </View>
          <NavigationArrow size={22} color={sharing ? v3.colors.success : v3.colors.textMuted} weight="fill" />
        </View>

        <View style={styles.jobCard}>
          <Text style={styles.label}>JOB</Text>
          <Text style={styles.jobTitle}>{job?.title || 'Your MaintainEX job'}</Text>
          <Text style={styles.jobMeta}>#{id?.slice(-6).toUpperCase()}</Text>
        </View>

        <PressableScale
          onPress={() => router.push('/(chat)' as any)}
          scaleTo={0.98}
          style={styles.actionPress}
        >
          <View style={styles.action}>
            <ChatCircle size={20} color={v3.colors.paper} weight="fill" />
            <Text style={styles.actionText}>Open messages</Text>
          </View>
        </PressableScale>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: v3.colors.canvas },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: v3.colors.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: v3.colors.line },
  iconSpacer: { width: 42, height: 42 },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 24, color: v3.colors.ink },
  mapFallback: { minHeight: 300, borderRadius: 20, backgroundColor: v3.colors.amberSoft, alignItems: 'center', justifyContent: 'center', padding: 32, borderWidth: 1, borderColor: v3.colors.line },
  mapIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: v3.colors.amber, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  mapTitle: { fontFamily: 'Outfit_700Bold', fontSize: 22, color: v3.colors.ink, textAlign: 'center' },
  mapText: { fontFamily: 'Outfit_400Regular', fontSize: 15, color: v3.colors.textSecondary, textAlign: 'center', maxWidth: 420, marginTop: 8 },
  coords: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: v3.colors.textSecondary, marginTop: 12 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line },
  providerInfo: { flex: 1, marginLeft: 12 },
  providerName: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: v3.colors.ink },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  rating: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: v3.colors.textSecondary },
  jobCard: { padding: 18, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line },
  label: { fontFamily: 'Outfit_700Bold', fontSize: 11, color: v3.colors.textMuted, letterSpacing: 1.2 },
  jobTitle: { fontFamily: 'Outfit_700Bold', fontSize: 20, color: v3.colors.ink, marginTop: 6 },
  jobMeta: { fontFamily: 'Outfit_500Medium', fontSize: 13, color: v3.colors.textSecondary, marginTop: 4 },
  actionPress: { width: '100%' },
  action: { height: 54, borderRadius: 14, backgroundColor: v3.colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionText: { fontFamily: 'Outfit_700Bold', fontSize: 16, color: v3.colors.paper },
})
