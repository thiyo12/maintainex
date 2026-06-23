import { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, FlatList, StyleSheet, RefreshControl } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useColors } from '../../../lib/ThemeContext'
import { jobCategories, templateJobs } from '../../../lib/api'
import { useCountry } from '../../../lib/country'
import JobCard from '../../../components/find/JobCard'
import SkeletonLoader from '../../../components/find/SkeletonLoader'
import EmptyState from '../../../components/find/EmptyState'
import { useTranslation } from 'react-i18next'

export default function JobList() {
  const { t } = useTranslation()
  const colors = useColors()
    const styles = makeStyles(colors)
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>()
  const [category, setCategory] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [search, setSearch] = useState('')
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

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(jobs)
    } else {
      const q = search.toLowerCase()
      setFiltered(jobs.filter(j => j.name.toLowerCase().includes(q) || j.description.toLowerCase().includes(q)))
    }
  }, [search, jobs])

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

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('find.search')}
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <Ionicons name="close-circle" size={18} color="#9CA3AF" onPress={() => setSearch('')} />
        ) : null}
      </View>

      {loading ? (
        <SkeletonLoader count={6} height={120} />
      ) : filtered.length === 0 ? (
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
              onPress={() => router.push(`/(customer)/find/job/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { alignItems: 'center', paddingTop: 20, paddingBottom: 8, paddingHorizontal: 16 },
  iconWrap: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  subtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1F2937' },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
})
