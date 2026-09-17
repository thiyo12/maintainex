import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native'
import { MagnifyingGlass, SlidersHorizontal } from 'phosphor-react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import * as Location from 'expo-location'
import Animated, { FadeInUp } from 'react-native-reanimated'

import { templateJobs, findTasker } from '../../../../lib/api'
import { useCountry } from '../../../../lib/country'
import { v3 } from '../../../../theme/v3/tokens'
import { buildSampleTaskers } from '../../../../lib/sampleTaskers'

import V3SearchBar from '../../../../components/v3/V3SearchBar'
import V3ProviderCard from '../../../../components/v3/V3ProviderCard'
import NewChatModal from '@/components/chat/NewChatModal'

export default function TaskerResults() {
  const { t } = useTranslation()
  const { jobId } = useLocalSearchParams<{ jobId: string }>()
  const [job, setJob] = useState<any>(null)
  const [taskers, setTaskers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [chatRecipient, setChatRecipient] = useState<any>(null)
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null)
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
        console.error('Failed to load job', e)
      }
      if (jobData) setJob(jobData)

      let taskerData: any[] = []
      try {
        taskerData = await findTasker.search({
          jobId: jobId!,
          country: selectedCountry?.code,
          latitude: coordsLocal?.latitude,
          longitude: coordsLocal?.longitude,
          maxDistance: 50,
        })
      } catch (e) {
        console.error('Failed to load taskers', e)
      }
      const sample = buildSampleTaskers(jobData)
      setTaskers(taskerData.concat(sample))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [jobId, selectedCountry, coords])

  useEffect(() => { fetchData() }, [fetchData])

  const onRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ═══ Header ═══ */}
      <View style={styles.header}>
        <Text style={styles.title}>Available taskers</Text>
        {job ? (
          <Text style={styles.subtitle}>{job.name} — {taskers.length} found</Text>
        ) : null}
      </View>

      <View style={styles.searchWrap}>
        <V3SearchBar placeholder="Search taskers..." onPress={() => {}} />
      </View>

      {/* ═══ Filter Pills ═══ */}
      <View style={styles.filterRow}>
        <TouchableOpacity style={[styles.filterPill, styles.filterActive]} activeOpacity={0.7}>
          <Text style={[styles.filterText, styles.filterTextActive]}>Recommended</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterPill} activeOpacity={0.7}>
          <Text style={styles.filterText}>Available now</Text>
        </TouchableOpacity>
      </View>

      {/* ═══ Tasker List ═══ */}
      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2].map(i => (
            <View key={i} style={styles.skeletonCard} />
          ))}
        </View>
      ) : taskers.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>No taskers found nearby</Text>
          <Text style={styles.emptySub}>Try adjusting your search or check back later</Text>
        </View>
      ) : (
        <FlatList
          data={taskers}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInUp.delay(index * 50).springify().damping(20).stiffness(300)} style={styles.cardWrap}>
              <V3ProviderCard
                name={item.name || 'Tasker'}
                rating={item.rating || 0}
                completedJobs={item.completedJobs || 0}
                isVerified={!!item.isVerified}
                skills={item.skills}
                onPress={() => router.push(`/(customer)/find/tasker-profile/${item.id}?jobId=${jobId}` as any)}
              />
            </Animated.View>
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={v3.colors.ink} />}
        />
      )}

      <NewChatModal
        visible={!!chatRecipient}
        onClose={() => setChatRecipient(null)}
        recipient={chatRecipient}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },

  header: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 26,
    fontFamily: 'Outfit_900Black',
    color: v3.colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    color: v3.colors.textMuted,
    marginTop: 2,
  },

  searchWrap: {
    paddingHorizontal: 18,
    marginBottom: 8,
  },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: v3.radius.full,
    borderWidth: 1,
    borderColor: v3.colors.line,
    backgroundColor: v3.colors.surfaceWhite,
  },
  filterActive: {
    backgroundColor: v3.colors.ink,
    borderColor: v3.colors.ink,
  },
  filterText: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    color: v3.colors.textMuted,
  },
  filterTextActive: {
    color: v3.colors.paper,
  },

  list: {
    paddingHorizontal: 18,
    paddingBottom: 100,
  },
  cardWrap: {
    marginBottom: 12,
  },

  skeletonCard: {
    height: 120,
    borderRadius: v3.radius.lg,
    backgroundColor: v3.colors.surfaceGray,
    marginBottom: 12,
    marginHorizontal: 18,
  },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.textPrimary,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    color: v3.colors.textMuted,
    textAlign: 'center',
  },
})
