import { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, FlatList, StyleSheet, RefreshControl } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useColors } from '../../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { jobCategories } from '../../../lib/api'
import { useCountry } from '../../../lib/country'
import CategoryCard from '../../../components/find/CategoryCard'
import SkeletonLoader from '../../../components/find/SkeletonLoader'
import EmptyState from '../../../components/find/EmptyState'

export default function FindJobCategories() {
  const { t } = useTranslation()
  const colors = useColors()
    const styles = makeStyles(colors)
  const [categories, setCategories] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { selectedCountry } = useCountry()
  const router = useRouter()

  const fetch = useCallback(async () => {
    try {
      const data = await jobCategories.list(selectedCountry?.code)
      setCategories(data)
      setFiltered(data)
    } catch (e) {
      console.error('Failed to load categories', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedCountry])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(categories)
    } else {
      const q = search.toLowerCase()
      setFiltered(categories.filter(c => c.name.toLowerCase().includes(q)))
    }
  }, [search, categories])

  const onRefresh = () => {
    setRefreshing(true)
    fetch()
  }

  const totalJobs = categories.reduce((sum, c) => sum + (c.jobs?.length || 0), 0)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('find.title')}</Text>
        <Text style={styles.subtitle}>{t('find.subtitle', { n: totalJobs, m: categories.length })}</Text>
      </View>

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
        <SkeletonLoader count={8} height={72} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="search-outline" title={t('find.noCategories')} subtitle={t('customer.noResults')} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <CategoryCard
              id={item.id}
              name={item.name}
              iconName={item.iconName}
              colorHex={item.colorHex}
              jobCount={item.jobs?.length || 0}
              onPress={() => router.push(`/(customer)/find/${item.id}`)}
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
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#1F2937' },
  subtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
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
