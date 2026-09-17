import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native'
import { CaretRight, Flame } from 'phosphor-react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Animated, { FadeInUp } from 'react-native-reanimated'

import { jobCategories, templateJobs } from '../../../lib/api'
import { useCountry } from '../../../lib/country'
import { v3 } from '../../../theme/v3/tokens'
import { categoryVisualBySlug } from '../../../lib/categoryVisuals'

import V3SearchBar from '../../../components/v3/V3SearchBar'
import V3SectionHeader from '../../../components/v3/V3SectionHeader'
import V3JobRow from '../../../components/v3/V3JobRow'

export default function ServiceCategory() {
  const { t } = useTranslation()
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>()
  const [category, setCategory] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { selectedCountry } = useCountry()
  const router = useRouter()

  const fetchData = useCallback(async () => {
    try {
      const [catData, jobsData] = await Promise.all([
        jobCategories.get(categoryId!),
        templateJobs.listByCategory(categoryId!, selectedCountry?.code),
      ])
      setCategory(catData)
      setJobs(jobsData)
    } catch (e) {
      console.error('Failed to load jobs', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [categoryId, selectedCountry])

  useEffect(() => { fetchData() }, [fetchData])

  const onRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  const popular = jobs.filter(j => j.isPopular)
  const regular = jobs.filter(j => !j.isPopular)

  const vis = category ? categoryVisualBySlug(category.slug || category.id) : null
  const Icon = vis?.icon

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ═══ Header ═══ */}
      <View style={styles.header}>
        {Icon ? (
          <View style={styles.iconWrap}>
            <Icon size={22} color={v3.colors.ink} weight="fill" />
          </View>
        ) : null}
        <Text style={styles.title}>{category?.name || 'Service'}</Text>
        <Text style={styles.subtitle}>{jobs.length} services available</Text>
      </View>

      <View style={styles.searchWrap}>
        <V3SearchBar placeholder="Search services..." onPress={() => {}} />
      </View>

      <FlatList
        data={[...popular, ...regular]}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInUp.delay(index * 40).springify().damping(20).stiffness(300)} style={styles.jobWrap}>
            <V3JobRow
              name={item.name}
              description={item.description}
              priceMin={item.priceMin}
              priceMax={item.priceMax}
              durationMinutes={item.typicalDurationMinutes}
              isPopular={item.isPopular}
              onPress={() => router.push({ pathname: '/(customer)/find/job/[jobId]', params: { jobId: item.id } } as any)}
            />
          </Animated.View>
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={v3.colors.ink} />}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },

  header: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 18,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: v3.colors.surfaceGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Outfit_900Black',
    color: v3.colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    color: v3.colors.textMuted,
    marginTop: 2,
  },

  searchWrap: {
    paddingHorizontal: 18,
    marginBottom: 4,
  },

  list: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 100,
  },
  jobWrap: {
    marginBottom: 10,
  },
})
