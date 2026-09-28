import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useColors } from '@/lib/ThemeContext'
import { jobCategories, templateJobs } from '@/lib/api'
import { useCountry } from '@/lib/country'
import JobCard from '@/features/customer/components/JobCard'
import PostJobBanner from '@/features/customer/components/PostJobBanner'
import SkeletonLoader from '@/features/customer/components/SkeletonLoader'
import EmptyState from '@/features/customer/components/EmptyState'
import { useTranslation } from 'react-i18next'
import AISearchBar from '@/components/shared/AISearchBar'

export default function JobList() {
  const { t } = useTranslation()
  const colors = useColors()
    const styles = makeStyles(colors)
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>()
  const [category, setCategory] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { selectedCountry } = useCountry()
  const router = useRouter()

  const fetch = useCallback(async () => {
    try {
      const [catData, jobsData] = await Promise.all([
        jobCategories.get(categoryId!),
        templateJobs.listByCategory(categoryId!, selectedCountry?.code),
      ])
      setCategory(catData)
      setJobs(jobsData)
      setFiltered(jobsData)
    } catch (e) {
      console.error('Failed to load jobs', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [categoryId, selectedCountry])

  useEffect(() => { fetch() }, [fetch])

  const onRefresh = () => {
    setRefreshing(true)
    fetch()
  }

  const popular = filtered.filter(j => j.isPopular)
  const regular = filtered.filter(j => !j.isPopular)

  return (
    <View style={styles.container}>
      {category && (
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: category.colorHex + '20' }]}>
            <Ionicons name={category.iconName as any} size={28} color={category.colorHex} />
          </View>
          <Text style={styles.title}>{category.name}</Text>
          <Text style={styles.subtitle}>{jobs.length} services available</Text>
        </View>
      )}

      <AISearchBar
        placeholder={t('find.search')}
        onCategorySelect={(catId) => {
          router.push({ pathname: '/(customer)/find/[categoryId]', params: { categoryId: catId } })
        }}
        onJobSelect={(jobId) => {
          router.push({ pathname: '/(customer)/find/taskers/[jobId]', params: { jobId } })
        }}
        onTaskerSelect={(taskerId) => {
          router.push(`/(customer)/find/tasker-profile/${taskerId}`)
        }}
        onPostJob={(query) => {
          router.push({ pathname: '/(customer)/jobs/v2/create', params: { title: query } })
        }}
      />

      {loading ? (
        <SkeletonLoader count={6} height={120} />
      ) : (
        <>
          <PostJobBanner
            onPress={() =>
              router.push({
                pathname: '/(customer)/jobs/v2/create',
                params: {
                  categoryId,
                  templateJobId: filtered[0]?.id || '',
                  title: filtered[0]?.name || '',
                },
              })
            }
          />
          {filtered.length === 0 ? (
            <EmptyState icon="search-outline" title={t('common.noResults')} subtitle={t('components.adjustSearch')} />
          ) : (
            <FlatList
              data={[...popular, ...regular]}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <JobCard
                  name={item.name}
                  description={item.description}
                  priceMin={item.priceMin}
                  priceMax={item.priceMax}
                  typicalDurationMinutes={item.typicalDurationMinutes}
                  isPopular={item.isPopular}
                  colorHex={category?.colorHex || colors.primary}
                  onPress={() => router.push({ pathname: '/(customer)/find/taskers/[jobId]', params: { jobId: item.id } })}
                />
              )}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            />
          )}
        </>
      )}
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: 'center', paddingTop: 20, paddingBottom: 8, paddingHorizontal: 16 },
  iconWrap: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
})
