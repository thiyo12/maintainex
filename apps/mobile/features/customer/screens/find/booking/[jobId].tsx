import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { CalendarBlank, CaretLeft, CaretRight, DotsThree, MapPin, Wrench } from 'phosphor-react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { taskers } from '@/api/taskers'
import { templateJobs } from '@/api/jobs'
import { v3 } from '@/theme/v3/tokens'
import AvatarCircle from '@/components/ui/AvatarCircle'

const money = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? `LKR ${n.toLocaleString()}` : null
}

export default function DirectTaskerBooking() {
  const router = useRouter()
  const { jobId, taskerId } = useLocalSearchParams<{ jobId: string; taskerId?: string }>()
  const [job, setJob] = useState<any>(null)
  const [tasker, setTasker] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [service, provider] = await Promise.all([
          templateJobs.get(jobId!),
          taskerId ? taskers.get(taskerId) : Promise.resolve(null),
        ])
        if (!alive) return
        setJob(service)
        setTasker(provider)
      } catch (e) {
        console.error('Failed to prepare direct booking', e)
        if (alive) setError(true)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [jobId, taskerId])

  const name = tasker?.user?.name || tasker?.name || 'Professional'
  const categoryId = job?.categoryId || job?.category?.id
  const estimate = useMemo(() => {
    const providerRate = Number(tasker?.startingPrice || tasker?.hourlyRate || 0)
    if (providerRate > 0) return money(providerRate)
    const min = Number(job?.priceMin || 0)
    const max = Number(job?.priceMax || 0)
    if (min && max) return `${money(min)}–${max.toLocaleString()}`
    return 'Calculated before posting'
  }, [job, tasker])

  const continueBooking = () => {
    if (!jobId || !categoryId) {
      router.replace({ pathname: '/(customer)/jobs/v2/create', params: { templateJobId: jobId, taskerId } } as any)
      return
    }
    router.push({
      pathname: '/(customer)/jobs/v2/create',
      params: {
        categoryId,
        templateJobId: jobId,
        taskerId: taskerId || '',
        taskerName: name,
      },
    } as any)
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loading}><ActivityIndicator color={v3.colors.ink} /></View>
      </SafeAreaView>
    )
  }

  if (error || !job) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}><CaretLeft size={20} color={v3.colors.ink} weight="bold" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Book professional</Text>
          <View style={styles.headerButtonRight} />
        </View>
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Booking details unavailable</Text>
          <Text style={styles.errorBody}>Return to the provider and try again.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}><Text style={styles.retryText}>Go back</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()} hitSlop={10}><CaretLeft size={20} color={v3.colors.ink} weight="bold" /></TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Book {name.split(' ')[0]}</Text>
        <View style={styles.headerButtonRight}><DotsThree size={17} color={v3.colors.ink} weight="bold" /></View>
      </View>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>{tasker?.isOnline ? 'AVAILABLE TODAY' : 'DIRECT BOOKING'}</Text>
        <Text style={styles.title}>Book a trusted professional directly.</Text>
        <Text style={styles.subtitle}>You already know who you want; MaintainEX still protects the booking.</Text>

        <View style={styles.providerCard}>
          <AvatarCircle uri={tasker?.profileImage || tasker?.avatarUrl || tasker?.user?.profileImage} name={name} size={52} showOnline={!!tasker?.isOnline} />
          <View style={styles.providerCopy}>
            <Text style={styles.providerName}>{name}</Text>
            <Text style={styles.providerMeta}>{tasker?.rating ? `★ ${Number(tasker.rating).toFixed(2)} · ` : ''}{tasker?.isVerified ? 'Verified · ' : ''}{tasker?.completedJobs || 0} jobs</Text>
            <View style={styles.availabilityPill}><Text style={styles.availabilityText}>{tasker?.distanceMinutes ? `${tasker.distanceMinutes} min away` : tasker?.isOnline ? 'Available now' : 'Availability confirmed next'}</Text></View>
          </View>
        </View>

        <View style={styles.rows}>
          <View style={styles.detailRow}>
            <View style={styles.iconCircle}><Wrench size={15} color={v3.colors.ink} /></View>
            <View style={styles.rowCopy}><Text style={styles.rowTitle}>Service</Text><Text style={styles.rowSub}>{job.category?.name || job.categoryName || 'Service'} · {job.name || job.title}</Text></View>
            <CaretRight size={16} color={v3.colors.ink} />
          </View>
          <View style={styles.detailRow}>
            <View style={styles.iconCircle}><CalendarBlank size={15} color={v3.colors.ink} /></View>
            <View style={styles.rowCopy}><Text style={styles.rowTitle}>When</Text><Text style={styles.rowSub}>Choose date & time in the protected booking flow</Text></View>
            <CaretRight size={16} color={v3.colors.ink} />
          </View>
          <View style={styles.detailRow}>
            <View style={styles.iconCircle}><MapPin size={15} color={v3.colors.ink} /></View>
            <View style={styles.rowCopy}><Text style={styles.rowTitle}>Where</Text><Text style={styles.rowSub}>Confirm your service address next</Text></View>
            <CaretRight size={16} color={v3.colors.ink} />
          </View>
          <View style={styles.detailRow}>
            <View style={styles.iconCircle}><Text style={styles.priceIcon}>L</Text></View>
            <View style={styles.rowCopy}><Text style={styles.rowTitle}>Estimated price</Text><Text style={styles.rowSub}>{estimate}</Text></View>
            <CaretRight size={16} color={v3.colors.ink} />
          </View>
        </View>
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.primaryButton} onPress={continueBooking} activeOpacity={0.82}>
          <Text style={styles.primaryButtonText}>Continue booking request</Text>
        </TouchableOpacity>
        <Text style={styles.protectionNote}>Final schedule, address, budget and payment choice are confirmed before the job is posted.</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  header: { height: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 36, height: 36, alignItems: 'flex-start', justifyContent: 'center' },
  headerButtonRight: { width: 36, height: 36, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', marginHorizontal: 8, fontSize: 13, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, paddingHorizontal: 18, paddingTop: 8 },
  eyebrow: { fontSize: 8.4, fontFamily: 'Outfit_900Black', color: v3.colors.amberDark, letterSpacing: 0.45 },
  title: { marginTop: 8, fontSize: 25, lineHeight: 29, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  subtitle: { marginTop: 10, maxWidth: 354, fontSize: 10.2, lineHeight: 16, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  providerCard: { marginTop: 18, minHeight: 88, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  providerCopy: { flex: 1 },
  providerName: { fontSize: 13, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  providerMeta: { marginTop: 3, fontSize: 9, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  availabilityPill: { alignSelf: 'flex-start', marginTop: 8, minHeight: 25, paddingHorizontal: 10, borderRadius: 13, backgroundColor: v3.colors.successSoft, alignItems: 'center', justifyContent: 'center' },
  availabilityText: { fontSize: 8.6, fontFamily: 'Outfit_800ExtraBold', color: '#087A44' },
  rows: { marginTop: 20 },
  detailRow: { minHeight: 66, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, marginBottom: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F1F1', alignItems: 'center', justifyContent: 'center' },
  priceIcon: { fontSize: 10, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  rowCopy: { flex: 1 },
  rowTitle: { fontSize: 11.2, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  rowSub: { marginTop: 3, fontSize: 8.8, lineHeight: 13, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  bottomBar: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 22, backgroundColor: v3.colors.paper, borderTopWidth: 1, borderTopColor: v3.colors.line },
  primaryButton: { height: 54, borderRadius: 17, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 12, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.paper },
  protectionNote: { marginTop: 8, fontSize: 8.5, lineHeight: 12, fontFamily: 'Outfit_500Medium', color: v3.colors.textMuted, textAlign: 'center' },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  errorTitle: { fontSize: 18, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  errorBody: { marginTop: 6, fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary, textAlign: 'center' },
  retryButton: { marginTop: 16, height: 42, paddingHorizontal: 20, borderRadius: 14, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontSize: 10.5, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.paper },
})
