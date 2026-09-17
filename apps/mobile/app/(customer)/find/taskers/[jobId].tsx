import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { CaretLeft, CaretRight, DotsThree, MagnifyingGlass, SealCheck } from 'phosphor-react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Location from 'expo-location'

import { templateJobs, findTasker } from '../../../../lib/api'
import { useCountry } from '../../../../lib/country'
import { v3 } from '../../../../theme/v3/tokens'
import AvatarCircle from '../../../../components/ui/AvatarCircle'

const priceFrom = (item: any, job: any) => {
  const value = item?.startingPrice || item?.hourlyRate || item?.minimumPrice || job?.priceMin
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? `From LKR ${n.toLocaleString()}` : 'Get quote'
}

const providerName = (item: any) => item?.name || item?.user?.name || item?.companyName || 'Tasker'

export default function TaskerResults() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>()
  const [job, setJob] = useState<any>(null)
  const [taskers, setTaskers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [filter, setFilter] = useState<'recommended' | 'available' | 'rated'>('recommended')
  const { selectedCountry } = useCountry()
  const router = useRouter()

  const fetchData = useCallback(async () => {
    try {
      let coordsLocal = coords
      if (!coordsLocal) {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync()
          if (status === 'granted') {
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
            coordsLocal = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
            setCoords(coordsLocal)
          }
        } catch {}
      }

      let jobData: any = null
      try {
        jobData = await templateJobs.get(jobId!)
      } catch (e) {
        console.error('Failed to load service', e)
      }
      if (jobData) setJob(jobData)

      try {
        const data = await findTasker.search({
          jobId: jobId!,
          country: selectedCountry?.code,
          latitude: coordsLocal?.latitude,
          longitude: coordsLocal?.longitude,
          maxDistance: 50,
        })
        setTaskers(Array.isArray(data) ? data : [])
      } catch (e) {
        console.error('Failed to load taskers', e)
        setTaskers([])
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [jobId, selectedCountry, coords])

  useEffect(() => { fetchData() }, [fetchData])

  const visible = useMemo(() => {
    const copy = [...taskers]
    if (filter === 'available') return copy.filter((p: any) => p.isOnline || p.isAvailable || p.availableNow)
    if (filter === 'rated') return copy.sort((a: any, b: any) => Number(b.rating || 0) - Number(a.rating || 0))
    return copy.sort((a: any, b: any) => {
      const av = (a.isVerified ? 2 : 0) + Number(a.rating || 0) + Math.min(Number(a.completedJobs || 0) / 200, 2)
      const bv = (b.isVerified ? 2 : 0) + Number(b.rating || 0) + Math.min(Number(b.completedJobs || 0) / 200, 2)
      return bv - av
    })
  }, [taskers, filter])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()} hitSlop={10}>
          <CaretLeft size={20} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Available taskers</Text>
        <View style={styles.headerButtonRight}><DotsThree size={17} color={v3.colors.ink} weight="bold" /></View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData() }} tintColor={v3.colors.ink} />}
      >
        <Text style={styles.searchLabel}>SEARCH</Text>
        <View style={styles.searchCard}>
          <MagnifyingGlass size={17} color={v3.colors.ink} />
          <Text style={styles.searchText} numberOfLines={1}>{job?.name || job?.title || 'Selected service'}</Text>
        </View>

        <View style={styles.filters}>
          <TouchableOpacity style={[styles.filter, filter === 'recommended' && styles.filterActive]} onPress={() => setFilter('recommended')}>
            <Text style={[styles.filterText, filter === 'recommended' && styles.filterTextActive]}>Recommended</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filter, filter === 'available' && styles.filterActive]} onPress={() => setFilter('available')}>
            <Text style={[styles.filterText, filter === 'available' && styles.filterTextActive]}>Available now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filter, filter === 'rated' && styles.filterActive]} onPress={() => setFilter('rated')}>
            <Text style={[styles.filterText, filter === 'rated' && styles.filterTextActive]}>Top rated</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.results}>
          {loading ? [0, 1, 2, 3].map(i => <View key={i} style={[styles.providerRow, styles.skeleton]} />) : visible.map((item: any) => {
            const name = providerName(item)
            const rating = Number(item.rating || 0)
            const jobs = Number(item.completedJobs || item.jobsCompleted || 0)
            const badge = item.companyName ? 'Verified company' : item.isVerified ? 'Verified' : rating >= 4.9 ? 'Top Tasker' : 'Tasker'
            const availability = item.distanceMinutes ? `${item.distanceMinutes} min away` : item.etaMinutes ? `${item.etaMinutes} min away` : item.isOnline || item.availableNow ? 'Available now' : 'Available today'
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.providerRow}
                onPress={() => router.push(`/(customer)/find/tasker-profile/${item.id}?jobId=${jobId}` as any)}
                activeOpacity={0.72}
              >
                <AvatarCircle uri={item.avatarUrl || item.profileImage || item.user?.profileImage} name={name} size={52} showOnline={!!(item.isOnline || item.availableNow)} />
                <View style={styles.providerCopy}>
                  <View style={styles.providerNameRow}>
                    <Text style={styles.providerName} numberOfLines={1}>{name}</Text>
                    {item.isVerified ? <SealCheck size={14} color={v3.colors.success} weight="fill" /> : null}
                  </View>
                  <Text style={styles.providerMeta} numberOfLines={1}>{badge} · {rating > 0 ? rating.toFixed(2) : 'New'} · {jobs} jobs</Text>
                  <View style={styles.availabilityPill}><Text style={styles.availabilityText}>{availability}</Text></View>
                </View>
                <View style={styles.providerRight}>
                  <Text style={styles.priceText}>{priceFrom(item, job)}</Text>
                  <View style={styles.profileLink}><Text style={styles.profileLinkText}>View profile</Text><CaretRight size={12} color={v3.colors.ink} /></View>
                </View>
              </TouchableOpacity>
            )
          })}

          {!loading && visible.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{filter === 'available' ? 'No taskers are online right now' : 'No matching taskers found'}</Text>
              <Text style={styles.emptyBody}>Try another filter or refresh. MaintainEX will keep the service context ready.</Text>
              <TouchableOpacity style={styles.refreshButton} onPress={() => { setRefreshing(true); fetchData() }}><Text style={styles.refreshText}>Refresh</Text></TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  header: { height: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 36, height: 36, alignItems: 'flex-start', justifyContent: 'center' },
  headerButtonRight: { width: 36, height: 36, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', marginHorizontal: 8, fontSize: 13, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  scroll: { paddingHorizontal: 18, paddingBottom: 40 },
  searchLabel: { marginTop: 8, fontSize: 7.7, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.textSecondary, letterSpacing: 0.45 },
  searchCard: { marginTop: 7, height: 52, borderRadius: 17, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchText: { flex: 1, fontSize: 11.2, fontFamily: 'Outfit_600SemiBold', color: v3.colors.ink },
  filters: { marginTop: 12, flexDirection: 'row', gap: 7 },
  filter: { minHeight: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#F1F1F1', alignItems: 'center', justifyContent: 'center' },
  filterActive: { backgroundColor: v3.colors.ink },
  filterText: { fontSize: 8.6, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  filterTextActive: { color: v3.colors.paper },
  results: { marginTop: 14 },
  providerRow: { minHeight: 110, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, marginBottom: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  skeleton: { backgroundColor: '#EEEEEE' },
  providerCopy: { flex: 1, minWidth: 0 },
  providerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  providerName: { flexShrink: 1, fontSize: 12, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  providerMeta: { marginTop: 4, fontSize: 8.7, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  availabilityPill: { alignSelf: 'flex-start', marginTop: 10, minHeight: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: v3.colors.successSoft, alignItems: 'center', justifyContent: 'center' },
  availabilityText: { fontSize: 8.6, fontFamily: 'Outfit_800ExtraBold', color: '#087A44' },
  providerRight: { width: 92, alignSelf: 'stretch', alignItems: 'flex-end', justifyContent: 'space-between', paddingVertical: 6 },
  priceText: { fontSize: 10, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink, textAlign: 'right' },
  profileLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  profileLinkText: { fontSize: 8.7, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  emptyCard: { borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, padding: 20, alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink, textAlign: 'center' },
  emptyBody: { marginTop: 6, fontSize: 10, lineHeight: 15, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary, textAlign: 'center' },
  refreshButton: { marginTop: 14, minWidth: 110, height: 40, borderRadius: 14, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  refreshText: { fontSize: 10.5, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.paper },
})
