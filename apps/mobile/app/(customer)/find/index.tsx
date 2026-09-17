import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MagnifyingGlass, Funnel } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import Animated, { FadeInUp } from 'react-native-reanimated'

import { jobCategories } from '../../../lib/api'
import { useCountry } from '../../../lib/country'
import { v3 } from '../../../theme/v3/tokens'
import { categoryVisualBySlug } from '../../../lib/categoryVisuals'

import V3CustomerBottomNav from '../../../components/v3/V3CustomerBottomNav'
import V3SearchBar from '../../../components/v3/V3SearchBar'
import V3ServiceCard from '../../../components/v3/V3ServiceCard'
import V3SectionHeader from '../../../components/v3/V3SectionHeader'
import Skeleton from '../../../components/ui/Skeleton'

export default function ExploreScreen() {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { selectedCountry } = useCountry()
  const router = useRouter()

  const fetchCategories = useCallback(async () => {
    try {
      const data = await jobCategories.list(selectedCountry?.code)
      setCategories(data)
    } catch (e) {
      console.error('Failed to load categories', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedCountry])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  const onRefresh = () => {
    setRefreshing(true)
    fetchCategories()
  }

  const popularCategories = categories.filter(c => (c.jobs?.length || 0) > 0).slice(0, 8)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={v3.colors.ink} />}
      >
        {/* ═══ Header ═══ */}
        <View style={styles.header}>
          <Text style={styles.title}>Explore services</Text>
        </View>

        {/* ═══ Search Bar ═══ */}
        <View style={styles.searchWrap}>
          <V3SearchBar
            placeholder="Search services..."
            onPress={() => {}}
          />
        </View>

        {/* ═══ Popular Right Now ═══ */}
        <V3SectionHeader
          title="Popular right now"
          tag="POPULAR SERVICES"
          tagColor={v3.colors.amber}
        />
        {loading ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularScroll}>
            {[0, 1, 2, 3].map(i => <Skeleton key={i} width={82} height={100} radius={20} />)}
          </ScrollView>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularScroll} snapToInterval={90} decelerationRate="fast">
            {popularCategories.map((item: any, i: number) => {
              const id = item.slug || item.id || ''
              const vis = categoryVisualBySlug(id)
              const Icon = vis.icon
              return (
                <Animated.View key={id || i} entering={FadeInUp.delay(i * 40).springify().damping(20).stiffness(300)}>
                  <V3ServiceCard
                    icon={<Icon size={20} color={v3.colors.ink} weight="fill" />}
                    name={item.name || item.slug || id}
                    onPress={() => router.push({ pathname: '/(customer)/find/[categoryId]', params: { categoryId: item.id || item.slug } } as any)}
                  />
                </Animated.View>
              )
            })}
          </ScrollView>
        )}

        {/* ═══ Browse by Category ═══ */}
        <V3SectionHeader
          title="Browse by category"
          subtitle={`${categories.length} categories available`}
        />
        {loading ? (
          <View style={styles.gridSkeleton}>
            {[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} width="48%" height={100} radius={20} />)}
          </View>
        ) : (
          <View style={styles.grid}>
            {categories.map((item: any, i: number) => {
              const id = item.slug || item.id || ''
              const vis = categoryVisualBySlug(id)
              const Icon = vis.icon
              const jobCount = item.jobs?.length || 0
              return (
                <Animated.View key={id || i} entering={FadeInUp.delay(i * 30).springify().damping(20).stiffness(300)} style={styles.gridItem}>
                  <TouchableOpacity
                    style={styles.gridCard}
                    onPress={() => router.push({ pathname: '/(customer)/find/[categoryId]', params: { categoryId: item.id || item.slug } } as any)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.gridIconWrap}>
                      <Icon size={22} color={v3.colors.ink} weight="fill" />
                    </View>
                    <Text style={styles.gridName} numberOfLines={1}>{item.name || item.slug || id}</Text>
                    {jobCount > 0 ? (
                      <Text style={styles.gridCount}>{jobCount} services</Text>
                    ) : null}
                  </TouchableOpacity>
                </Animated.View>
              )
            })}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ═══ Bottom Nav ═══ */}
      <V3CustomerBottomNav
        activeTab="explore"
        onTabPress={(tab) => {
          if (tab === 'explore') return
          if (tab === 'home') router.push('/(customer)/(tabs)' as any)
          else router.push(`/(customer)/(tabs)/${tab}` as any)
        }}
        onPostJob={() => router.push('/(customer)/jobs/v2/create' as any)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  scroll: { paddingBottom: 20 },

  header: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Outfit_900Black',
    color: v3.colors.textPrimary,
  },

  searchWrap: {
    paddingHorizontal: 18,
    marginTop: 12,
    marginBottom: 4,
  },

  popularScroll: {
    paddingHorizontal: 18,
    gap: 10,
  },

  gridSkeleton: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 18,
    gap: 10,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 18,
    gap: 10,
  },
  gridItem: {
    width: '48%',
  },
  gridCard: {
    backgroundColor: v3.colors.surfaceWhite,
    borderWidth: 1,
    borderColor: v3.colors.line,
    borderRadius: v3.radius.xl,
    padding: 14,
    alignItems: 'center',
  },
  gridIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: v3.colors.surfaceGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gridName: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.textPrimary,
    textAlign: 'center',
  },
  gridCount: {
    fontSize: 9,
    fontFamily: 'Outfit_500Medium',
    color: v3.colors.textMuted,
    marginTop: 2,
  },
})
