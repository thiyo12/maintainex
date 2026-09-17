import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CaretLeft, CaretRight } from 'phosphor-react-native'

import { jobCategories } from '../../../lib/api'
import { useCountry } from '../../../lib/country'
import { v3 } from '../../../theme/v3/tokens'
import V3CustomerBottomNav from '../../../components/v3/V3CustomerBottomNav'
import V3DiscoverySearch from '../../../components/v3/V3DiscoverySearch'

const CATEGORY_COPY: Record<string, { description: string; count: string; group: string }> = {
  home: { description: 'Cleaning · sofa · kitchen', count: '24+', group: 'HOME & CLEANING' },
  cleaning: { description: 'Cleaning · sofa · kitchen', count: '24+', group: 'HOME & CLEANING' },
  repair: { description: 'Small fixes · assembly', count: '18+', group: 'REPAIR & TRADE' },
  handyman: { description: 'Small fixes · assembly', count: '18+', group: 'REPAIR & TRADE' },
  plumbing: { description: 'Leaks · taps · pumps', count: '15+', group: 'REPAIR & TRADE' },
  electrical: { description: 'Wiring · sockets · panels', count: '14+', group: 'REPAIR & TRADE' },
  ac: { description: 'AC · washer · fridge', count: '17+', group: 'REPAIR & TRADE' },
  appliance: { description: 'AC · washer · fridge', count: '17+', group: 'REPAIR & TRADE' },
  cctv: { description: 'Cameras · access control', count: '9+', group: 'TECH & SECURITY' },
  security: { description: 'Cameras · access control', count: '9+', group: 'TECH & SECURITY' },
  software: { description: 'Web · phones · computers', count: '16+', group: 'TECH & SECURITY' },
  it: { description: 'Web · phones · computers', count: '16+', group: 'TECH & SECURITY' },
  construction: { description: 'Ceiling · flooring · painting', count: '14+', group: 'CONSTRUCTION & OUTDOOR' },
  garden: { description: 'Outdoor · garden · maintenance', count: '12+', group: 'CONSTRUCTION & OUTDOOR' },
  outdoor: { description: 'Outdoor · garden · maintenance', count: '12+', group: 'CONSTRUCTION & OUTDOOR' },
  event: { description: 'Events · helpers · business', count: '12+', group: 'LIFESTYLE & BUSINESS' },
  lifestyle: { description: 'Events · helpers · business', count: '12+', group: 'LIFESTYLE & BUSINESS' },
}

const keyFor = (item: any) => `${item?.slug || ''} ${item?.name || ''}`.toLowerCase()

function categoryMeta(item: any) {
  const key = keyFor(item)
  const hit = Object.entries(CATEGORY_COPY).find(([word]) => key.includes(word))?.[1]
  const jobs = item?.jobs?.length || item?.jobCount || item?.services?.length
  return {
    description: hit?.description || item?.description || 'Trusted local services',
    count: jobs ? `${jobs}+` : hit?.count || '10+',
    group: hit?.group || 'LIFESTYLE & BUSINESS',
  }
}

export default function ExploreScreen() {
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const { selectedCountry } = useCountry()
  const router = useRouter()

  const fetchCategories = useCallback(async () => {
    try {
      const data = await jobCategories.list(selectedCountry?.code)
      setCategories(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to load categories', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedCountry])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  const openCategory = (id: string) => router.push({ pathname: '/(customer)/find/[categoryId]', params: { categoryId: id } } as any)
  const openJob = (id: string) => router.push({ pathname: '/(customer)/find/job/[jobId]', params: { jobId: id } } as any)
  const postCustom = (query: string) => router.push({ pathname: '/(customer)/jobs/v2/create', params: query ? { title: query } : {} } as any)

  const popular = useMemo(() => {
    const withJobs = categories.filter(c => (c.jobs?.length || c.jobCount || c.services?.length || 0) > 0)
    return (withJobs.length >= 4 ? withJobs : categories).slice(0, 4)
  }, [categories])

  const browse = categories.slice(0, 7)

  const groups = useMemo(() => {
    const order = ['HOME & CLEANING', 'REPAIR & TRADE', 'TECH & SECURITY', 'CONSTRUCTION & OUTDOOR', 'LIFESTYLE & BUSINESS']
    return order.map(group => ({ group, items: categories.filter(item => categoryMeta(item).group === group) })).filter(x => x.items.length > 0)
  }, [categories])

  if (showAll) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.allHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => setShowAll(false)} hitSlop={10}>
              <CaretLeft size={20} color={v3.colors.ink} weight="bold" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.allTitle}>All services</Text>
              <Text style={styles.allSubtitle}>Everything you can request in MaintainEX.</Text>
            </View>
          </View>

          <View style={styles.searchWrap}>
            <V3DiscoverySearch
              placeholder="Search all services"
              onCategorySelect={(id) => openCategory(id)}
              onJobSelect={(id) => openJob(id)}
              onPostJob={postCustom}
            />
          </View>

          {groups.map(({ group, items }) => (
            <View key={group} style={styles.groupBlock}>
              <Text style={styles.groupLabel}>{group}</Text>
              {items.slice(0, 3).map((item: any) => {
                const meta = categoryMeta(item)
                return (
                  <TouchableOpacity key={item.id || item.slug} style={styles.allServiceRow} onPress={() => openCategory(item.id || item.slug)} activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.allServiceName}>{item.name || item.slug}</Text>
                      <Text style={styles.allServiceDescription} numberOfLines={1}>{meta.description}</Text>
                    </View>
                    <CaretRight size={18} color={v3.colors.ink} />
                  </TouchableOpacity>
                )
              })}
            </View>
          ))}

          {!loading && categories.length === 0 ? <Text style={styles.empty}>No service categories are available right now.</Text> : null}

          <TouchableOpacity style={styles.customCta} onPress={() => postCustom('')} activeOpacity={0.82}>
            <Text style={styles.customCtaText}>Post a custom request</Text>
          </TouchableOpacity>
          <View style={{ height: 106 }} />
        </ScrollView>

        <V3CustomerBottomNav
          activeTab="explore"
          onTabPress={(tab) => {
            if (tab === 'explore') return
            if (tab === 'home') router.push('/(customer)/(tabs)' as any)
            else router.push(`/(customer)/(tabs)/${tab}` as any)
          }}
          onPostJob={() => postCustom('')}
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCategories() }} tintColor={v3.colors.ink} />}
      >
        <Text style={styles.title}>Explore services</Text>
        <Text style={styles.subtitle}>Search every category — not just popular ones.</Text>

        <View style={styles.searchWrap}>
          <V3DiscoverySearch
            placeholder={'Search “tap leak”, “website”, “painting”…'}
            onCategorySelect={(id) => openCategory(id)}
            onJobSelect={(id) => openJob(id)}
            onPostJob={postCustom}
          />
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Popular right now</Text>
          <TouchableOpacity onPress={() => setShowAll(true)}><Text style={styles.sectionLink}>View all →</Text></TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularRow}>
          {popular.map((item: any, index: number) => {
            const meta = categoryMeta(item)
            const labels = ['Deep clean', 'AC repair', 'CCTV install', 'Website help']
            const subs = ['Home', 'Repair', 'Security', 'IT']
            return (
              <TouchableOpacity key={item.id || item.slug || index} style={styles.popularCard} onPress={() => openCategory(item.id || item.slug)} activeOpacity={0.76}>
                <Text style={styles.popularName} numberOfLines={1}>{item.name || labels[index]}</Text>
                <Text style={styles.popularSub} numberOfLines={1}>{meta.group === 'HOME & CLEANING' ? 'Home' : subs[index] || meta.group.split(' ')[0]}</Text>
              </TouchableOpacity>
            )
          })}
          {loading && popular.length === 0 ? [0, 1, 2, 3].map(i => <View key={i} style={[styles.popularCard, styles.skeleton]} />) : null}
        </ScrollView>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Browse by category</Text>
          <TouchableOpacity onPress={() => setShowAll(true)}><Text style={styles.sectionLink}>All services →</Text></TouchableOpacity>
        </View>

        <View style={styles.categoryList}>
          {browse.map((item: any, index: number) => {
            const meta = categoryMeta(item)
            return (
              <TouchableOpacity key={item.id || item.slug || index} style={styles.categoryRow} onPress={() => openCategory(item.id || item.slug)} activeOpacity={0.72}>
                <View style={styles.numberCircle}><Text style={styles.numberText}>{index + 1}</Text></View>
                <View style={styles.categoryCopy}>
                  <Text style={styles.categoryName} numberOfLines={1}>{item.name || item.slug}</Text>
                  <Text style={styles.categoryDescription} numberOfLines={1}>{meta.description}</Text>
                </View>
                <Text style={styles.categoryCount}>{meta.count}</Text>
              </TouchableOpacity>
            )
          })}
          {!loading && categories.length === 0 ? <Text style={styles.empty}>No service categories are available right now.</Text> : null}
        </View>

        <View style={{ height: 112 }} />
      </ScrollView>

      <V3CustomerBottomNav
        activeTab="explore"
        onTabPress={(tab) => {
          if (tab === 'explore') return
          if (tab === 'home') router.push('/(customer)/(tabs)' as any)
          else router.push(`/(customer)/(tabs)/${tab}` as any)
        }}
        onPostJob={() => postCustom('')}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  scroll: { paddingBottom: 12 },
  title: { marginTop: 8, paddingHorizontal: 18, fontSize: 24, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  subtitle: { marginTop: 3, paddingHorizontal: 18, fontSize: 10.5, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  searchWrap: { marginTop: 16, paddingHorizontal: 18, zIndex: 50 },
  sectionRow: { marginTop: 22, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 14.5, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  sectionLink: { fontSize: 9.8, fontFamily: 'Outfit_800ExtraBold', color: '#4F4F4F' },
  popularRow: { paddingHorizontal: 18, paddingTop: 10, gap: 9 },
  popularCard: { width: 82, height: 74, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, paddingHorizontal: 10, paddingTop: 16 },
  popularName: { fontSize: 9.4, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  popularSub: { marginTop: 9, fontSize: 8.2, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  skeleton: { backgroundColor: '#EEEEEE' },
  categoryList: { marginTop: 10, paddingHorizontal: 18 },
  categoryRow: { minHeight: 54, borderRadius: 14, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, marginBottom: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  numberCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F1F1F1', alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 9, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  categoryCopy: { flex: 1 },
  categoryName: { fontSize: 10.5, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  categoryDescription: { marginTop: 2, fontSize: 8.4, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  categoryCount: { fontSize: 9, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  empty: { paddingVertical: 24, textAlign: 'center', fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textMuted },

  allHeader: { paddingHorizontal: 18, paddingTop: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  backButton: { width: 28, height: 34, alignItems: 'flex-start', justifyContent: 'center' },
  allTitle: { fontSize: 24, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  allSubtitle: { marginTop: 2, fontSize: 10.5, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  groupBlock: { marginTop: 22, paddingHorizontal: 18 },
  groupLabel: { fontSize: 8.4, fontFamily: 'Outfit_900Black', color: v3.colors.ink, letterSpacing: 0.5, marginBottom: 8 },
  allServiceRow: { minHeight: 64, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, borderRadius: 15, paddingHorizontal: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  allServiceName: { fontSize: 10.5, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  allServiceDescription: { marginTop: 4, fontSize: 8.6, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  customCta: { marginHorizontal: 18, marginTop: 24, height: 52, borderRadius: 17, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  customCtaText: { fontSize: 13, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.paper },
})
