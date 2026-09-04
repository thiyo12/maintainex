import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { useColors } from '../../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { jobCategories } from '../../../lib/api'
import { useCountry } from '../../../lib/country'
import CategoryCard from '../../../components/find/CategoryCard'
import SkeletonLoader from '../../../components/find/SkeletonLoader'
import EmptyState from '../../../components/find/EmptyState'
import AISearchBar from '../../../components/shared/AISearchBar'

export default function FindJobCategories() {
  const { t } = useTranslation()
  const colors = useColors()
    const styles = makeStyles(colors)
  const [categories, setCategories] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
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

      <AISearchBar
        placeholder={t('find.search')}
        onCategorySelect={(catId) => {
          router.push({ pathname: '/(customer)/find/[categoryId]', params: { categoryId: catId } })
        }}
        onJobSelect={(jobId) => {
          router.push({ pathname: '/(customer)/find/taskers/[jobId]', params: { jobId } })
        }}
        onPostJob={(query) => {
          router.push({ pathname: '/(customer)/jobs/v2/create', params: { title: query } })
        }}
      />

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
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
})
