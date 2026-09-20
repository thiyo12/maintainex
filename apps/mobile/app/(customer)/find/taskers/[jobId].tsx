import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import {
  ArrowLeft, Buildings, CaretRight, MapPin, SealCheck, UsersThree, Wrench,
} from 'phosphor-react-native'

import { templateJobs, findTasker } from '../../../../lib/api'
import { useCountry } from '../../../../lib/country'
import { v3 } from '../../../../theme/v3/tokens'
import AvatarCircle from '../../../../components/ui/AvatarCircle'

type Filter = 'all' | 'available' | 'taskers' | 'companies'

const providerName = (item: any) =>
  item?.companyName || item?.name || item?.user?.name || 'Provider'

function priceFrom(item: any, job: any) {
  const value = item?.startingPrice || item?.hourlyRate || item?.minimumPrice || job?.priceMin
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? `From LKR ${n.toLocaleString()}` : 'Quote after request'
}

function distanceLabel(item: any) {
  const km = Number(item.distance ?? item.distanceKm)
  if (Number.isFinite(km)) {
    if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m away`
    return `${km.toFixed(km < 10 ? 1 : 0)} km away`
  }
  return item.isOnline || item.availableNow ? 'Available now' : 'Nearby'
}

export default function ProviderResults() {
  const { jobId, title: titleParam, categoryId: categoryParam } = useLocalSearchParams<{
    jobId: string
    title?: string
    categoryId?: string
  }>()
  const router = useRouter()
  const { selectedCountry } = useCountry()

  const [job, setJob] = useState<any>(null)
  const [providers, setProviders] = useState<any[]>([])
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      let currentCoords = coords
      if (!currentCoords) {
        try {
          const permission = await Location.requestForegroundPermissionsAsync()
          if (permission.status === 'granted') {
            const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
            currentCoords = { latitude: current.coords.latitude, longitude: current.coords.longitude }
            setCoords(currentCoords)
          }
        } catch {}
      }

      let service: any = null
      try {
        service = await templateJobs.get(jobId!)
        setJob(service)
      } catch (error) {
        console.error('Failed to load selected work', error)
      }

      try {
        const result = await findTasker.search({
          jobId: jobId!,
          country: selectedCountry?.code,
          latitude: currentCoords?.latitude,
          longitude: currentCoords?.longitude,
          maxDistance: 50,
        })
        const matched = Array.isArray(result) ? result : []
        setProviders(matched)
      } catch (error) {
        console.error('Failed to load nearby providers', error)
        setProviders([])
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [jobId, selectedCountry?.code, coords])

  useEffect(() => { load() }, [load])

  const serviceTitle = job?.name || job?.title || titleParam || 'Selected work'
  const categoryId = job?.categoryId || job?.category?.id || categoryParam || ''

  const counts = useMemo(() => ({
    taskers: providers.filter((p) => p.providerType !== 'COMPANY').length,
    companies: providers.filter((p) => p.providerType === 'COMPANY').length,
    available: providers.filter((p) => p.isOnline || p.availableNow || Number(p.onlineWorkers || 0) > 0).length,
  }), [providers])

  const visible = useMemo(() => {
    let list = [...providers]
    if (filter === 'available') {
      list = list.filter((p) => p.isOnline || p.availableNow || Number(p.onlineWorkers || 0) > 0)
    } else if (filter === 'taskers') {
      list = list.filter((p) => p.providerType !== 'COMPANY')
    } else if (filter === 'companies') {
      list = list.filter((p) => p.providerType === 'COMPANY')
    }

    return list.sort((a, b) => {
      const availableA = a.isOnline || a.availableNow || Number(a.onlineWorkers || 0) > 0 ? 1 : 0
      const availableB = b.isOnline || b.availableNow || Number(b.onlineWorkers || 0) > 0 ? 1 : 0
      if (availableA !== availableB) return availableB - availableA
      const scoreDiff = Number(b.score || 0) - Number(a.score || 0)
      if (Math.abs(scoreDiff) > 5) return scoreDiff
      const ad = Number.isFinite(Number(a.distance)) ? Number(a.distance) : 9999
      const bd = Number.isFinite(Number(b.distance)) ? Number(b.distance) : 9999
      return ad - bd
    })
  }, [providers, filter])

  const postJob = () => {
    router.push({
      pathname: '/(customer)/jobs/v2/create',
      params: {
        title: serviceTitle,
        categoryId,
        templateJobId: jobId!,
      },
    } as any)
  }

  const openProvider = (provider: any) => {
    if (provider.providerType === 'COMPANY') return
    router.push(`/(customer)/find/tasker-profile/${provider.id}?jobId=${jobId}` as any)
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ArrowLeft size={19} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerEyebrow}>NEARBY PROVIDERS</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{serviceTitle}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load() }}
            tintColor={v3.colors.ink}
          />
        }
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <MapPin size={20} color={v3.colors.ink} weight="fill" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryTitle}>
              {loading ? 'Looking around you…' : `${providers.length} provider${providers.length === 1 ? '' : 's'} found`}
            </Text>
            <Text style={styles.summaryText}>
              {coords ? 'Sorted using your current location, service match and provider availability.' : 'Location permission improves nearby ranking.'}
            </Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {([
            ['all', `All ${providers.length}`],
            ['available', `Available ${counts.available}`],
            ['taskers', `Taskers ${counts.taskers}`],
            ['companies', `Companies ${counts.companies}`],
          ] as [Filter, string][]).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => setFilter(key)}
              style={[styles.filter, filter === key && styles.filterActive]}
            >
              <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={v3.colors.ink} />
            <Text style={styles.loadingText}>Matching skills, availability and distance…</Text>
          </View>
        ) : (
          <View style={styles.results}>
            {visible.map((item: any) => {
              const isCompany = item.providerType === 'COMPANY'
              const name = providerName(item)
              const rating = Number(item.rating || 0)
              const completed = Number(item.completedJobs || item.jobsCompleted || 0)
              const online = !!(item.isOnline || item.availableNow || Number(item.onlineWorkers || 0) > 0)
              const teamSize = Number(item.teamSize || 0)
              const onlineWorkers = Number(item.onlineWorkers || 0)

              return (
                <TouchableOpacity
                  key={`${item.providerType || 'INDIVIDUAL'}-${item.id}`}
                  activeOpacity={isCompany ? 1 : 0.76}
                  onPress={() => openProvider(item)}
                  style={styles.providerCard}
                >
                  <View style={styles.providerTop}>
                    <View style={[styles.typeIcon, isCompany && styles.companyIcon]}>
                      {isCompany
                        ? <Buildings size={20} color={v3.colors.ink} weight="fill" />
                        : <AvatarCircle uri={item.avatarUrl || item.profileImage || item.user?.profileImage} name={name} size={48} showOnline={online} />}
                    </View>

                    <View style={styles.providerCopy}>
                      <View style={styles.nameRow}>
                        <Text style={styles.name} numberOfLines={1}>{name}</Text>
                        {item.isVerified ? <SealCheck size={15} color={v3.colors.success} weight="fill" /> : null}
                      </View>
                      <Text style={styles.typeLabel}>{item.isCertificationTest ? 'Certification test tasker' : isCompany ? 'Verified company team' : 'Independent tasker'}</Text>
                    </View>

                    <View style={[styles.liveBadge, !online && styles.liveBadgeMuted]}>
                      <View style={[styles.liveDot, !online && styles.liveDotMuted]} />
                      <Text style={[styles.liveText, !online && styles.liveTextMuted]}>{online ? 'Available' : 'Today'}</Text>
                    </View>
                  </View>

                  <View style={styles.metrics}>
                    <View style={styles.metric}>
                      <Text style={styles.metricValue}>{rating > 0 ? rating.toFixed(1) : 'New'}</Text>
                      <Text style={styles.metricLabel}>Rating</Text>
                    </View>
                    <View style={styles.metricDivider} />
                    <View style={styles.metric}>
                      <Text style={styles.metricValue}>{completed}</Text>
                      <Text style={styles.metricLabel}>{isCompany ? 'Projects' : 'Jobs'}</Text>
                    </View>
                    <View style={styles.metricDivider} />
                    <View style={styles.metric}>
                      <Text style={styles.metricValue}>{distanceLabel(item)}</Text>
                      <Text style={styles.metricLabel}>Distance</Text>
                    </View>
                  </View>

                  {isCompany ? (
                    <View style={styles.companyLine}>
                      <UsersThree size={16} color={v3.colors.info} weight="fill" />
                      <Text style={styles.companyLineText}>
                        {teamSize ? `${teamSize} active team member${teamSize === 1 ? '' : 's'}` : 'Company workforce'}
                        {onlineWorkers ? ` · ${onlineWorkers} online` : ''}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.providerBottom}>
                    <Text style={styles.price}>{priceFrom(item, job)}</Text>
                    {isCompany ? (
                      <TouchableOpacity activeOpacity={0.8} style={styles.requestButton} onPress={postJob}>
                        <Text style={styles.requestButtonText}>Request company quote</Text>
                        <CaretRight size={13} color={v3.colors.paper} weight="bold" />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.viewProfile}>
                        <Text style={styles.viewProfileText}>View profile</Text>
                        <CaretRight size={13} color={v3.colors.ink} weight="bold" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              )
            })}

            {visible.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}><Wrench size={24} color={v3.colors.ink} weight="fill" /></View>
                <Text style={styles.emptyTitle}>
                  {filter === 'companies' ? 'No matching company teams nearby' : filter === 'taskers' ? 'No matching taskers nearby' : 'No provider is available for this work yet'}
                </Text>
                <Text style={styles.emptyText}>
                  Post the job once. MaintainEX can send it to matching taskers and companies as they become available.
                </Text>
                <TouchableOpacity activeOpacity={0.82} style={styles.postButton} onPress={postJob}>
                  <Text style={styles.postButtonText}>Post this job</Text>
                  <CaretRight size={16} color={v3.colors.paper} weight="bold" />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}

        {!loading && providers.length > 0 ? (
          <View style={styles.fallbackCard}>
            <Text style={styles.fallbackTitle}>Not seeing the right person?</Text>
            <Text style={styles.fallbackText}>Post the job and let matching providers send quotes.</Text>
            <TouchableOpacity onPress={postJob} style={styles.fallbackButton}>
              <Text style={styles.fallbackButtonText}>Post for quotes</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  header: { minHeight: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, paddingHorizontal: 12 },
  headerEyebrow: { fontFamily: 'Outfit_800ExtraBold', fontSize: 8.5, color: v3.colors.textMuted, letterSpacing: 0.8 },
  headerTitle: { marginTop: 2, fontFamily: 'Outfit_800ExtraBold', fontSize: 15, color: v3.colors.ink },
  headerSpacer: { width: 40 },
  scroll: { paddingHorizontal: 18, paddingBottom: 32 },
  summaryCard: { marginTop: 8, minHeight: 76, padding: 13, borderRadius: 18, backgroundColor: v3.colors.amberSoft, flexDirection: 'row', alignItems: 'center', gap: 11 },
  summaryIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: v3.colors.amber, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 13.5, color: v3.colors.ink },
  summaryText: { marginTop: 3, fontFamily: 'Outfit_400Regular', fontSize: 10.5, lineHeight: 15, color: v3.colors.textSecondary },
  filters: { paddingTop: 12, paddingBottom: 2, gap: 7 },
  filter: { height: 34, paddingHorizontal: 12, borderRadius: 12, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, justifyContent: 'center' },
  filterActive: { backgroundColor: v3.colors.ink, borderColor: v3.colors.ink },
  filterText: { fontFamily: 'Outfit_700Bold', fontSize: 10.5, color: v3.colors.ink },
  filterTextActive: { color: v3.colors.paper },
  loading: { marginTop: 18, minHeight: 180, borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, fontFamily: 'Outfit_500Medium', fontSize: 11, color: v3.colors.textSecondary },
  results: { marginTop: 14 },
  providerCard: { marginBottom: 10, padding: 14, borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line },
  providerTop: { flexDirection: 'row', alignItems: 'center' },
  typeIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  companyIcon: { backgroundColor: v3.colors.infoSoft },
  providerCopy: { flex: 1, minWidth: 0, marginLeft: 11 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { maxWidth: '88%', fontFamily: 'Outfit_800ExtraBold', fontSize: 14, color: v3.colors.ink },
  typeLabel: { marginTop: 2, fontFamily: 'Outfit_500Medium', fontSize: 10.5, color: v3.colors.textSecondary },
  liveBadge: { minHeight: 27, paddingHorizontal: 8, borderRadius: 10, backgroundColor: v3.colors.successSoft, flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveBadgeMuted: { backgroundColor: v3.colors.canvas },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: v3.colors.success },
  liveDotMuted: { backgroundColor: v3.colors.textMuted },
  liveText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 8.5, color: '#087A44' },
  liveTextMuted: { color: v3.colors.textSecondary },
  metrics: { marginTop: 13, minHeight: 54, borderRadius: 14, backgroundColor: v3.colors.canvas, flexDirection: 'row', alignItems: 'center' },
  metric: { flex: 1, alignItems: 'center' },
  metricDivider: { width: 1, height: 26, backgroundColor: v3.colors.line },
  metricValue: { fontFamily: 'Outfit_800ExtraBold', fontSize: 11, color: v3.colors.ink, textAlign: 'center' },
  metricLabel: { marginTop: 2, fontFamily: 'Outfit_500Medium', fontSize: 8.5, color: v3.colors.textMuted },
  companyLine: { marginTop: 10, minHeight: 36, borderRadius: 12, backgroundColor: v3.colors.infoSoft, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  companyLineText: { flex: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 10.5, color: v3.colors.textSecondary },
  providerBottom: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  price: { flex: 1, fontFamily: 'Outfit_700Bold', fontSize: 10.5, color: v3.colors.textSecondary },
  viewProfile: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewProfileText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 10.5, color: v3.colors.ink },
  requestButton: { minHeight: 38, paddingHorizontal: 12, borderRadius: 12, backgroundColor: v3.colors.ink, flexDirection: 'row', alignItems: 'center', gap: 4 },
  requestButtonText: { fontFamily: 'Outfit_700Bold', fontSize: 9.5, color: v3.colors.paper },
  empty: { padding: 24, borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center' },
  emptyIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: v3.colors.amberSoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 12, fontFamily: 'Outfit_800ExtraBold', fontSize: 16, lineHeight: 21, color: v3.colors.ink, textAlign: 'center' },
  emptyText: { marginTop: 5, fontFamily: 'Outfit_400Regular', fontSize: 11.5, lineHeight: 17, color: v3.colors.textSecondary, textAlign: 'center' },
  postButton: { marginTop: 16, height: 48, paddingHorizontal: 18, borderRadius: 14, backgroundColor: v3.colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  postButtonText: { fontFamily: 'Outfit_700Bold', fontSize: 12.5, color: v3.colors.paper },
  fallbackCard: { marginTop: 6, padding: 16, borderRadius: 18, backgroundColor: v3.colors.amberSoft },
  fallbackTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 13.5, color: v3.colors.ink },
  fallbackText: { marginTop: 3, fontFamily: 'Outfit_400Regular', fontSize: 10.5, color: v3.colors.textSecondary },
  fallbackButton: { alignSelf: 'flex-start', marginTop: 10, height: 38, paddingHorizontal: 12, borderRadius: 11, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: '#F2D08C', alignItems: 'center', justifyContent: 'center' },
  fallbackButtonText: { fontFamily: 'Outfit_700Bold', fontSize: 10.5, color: v3.colors.ink },
})
