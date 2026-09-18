import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowRight, Briefcase, CaretLeft, Sparkle, Wrench } from 'phosphor-react-native'

import { jobCategories } from '../../../lib/api'
import { useCountry } from '../../../lib/country'
import { categoryVisualBySlug } from '../../../lib/categoryVisuals'
import { v3 } from '../../../theme/v3/tokens'
import V3CustomerBottomNav from '../../../components/v3/V3CustomerBottomNav'
import V3DiscoverySearch from '../../../components/v3/V3DiscoverySearch'

const COPY: Record<string, string> = {
  cleaning: 'Cleaning, sofa, kitchen',
  electrical: 'Lights, sockets, wiring',
  plumbing: 'Leaks, taps, pumps',
  ac: 'AC, fridge, appliances',
  security: 'CCTV, access, smart home',
  it: 'Web, phones, computers',
  construction: 'Painting, floors, ceilings',
  garden: 'Garden and outdoor work',
  moving: 'Moving, packing, delivery',
  vehicle: 'Vehicle care and repair',
  event: 'Events and helpers',
}

const keyFor = (item: any) => `${item?.slug || ''} ${item?.name || ''}`.toLowerCase()

function descriptionFor(item: any) {
  const key = keyFor(item)
  const hit = Object.entries(COPY).find(([word]) => key.includes(word))
  return hit?.[1] || item?.description || 'Trusted local professionals'
}

export default function ExploreScreen() {
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const { selectedCountry } = useCountry()
  const router = useRouter()

  const load = useCallback(async () => {
    try {
      const data = await jobCategories.list(selectedCountry?.code)
      setCategories(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to load categories', error)
      setCategories([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedCountry])

  useEffect(() => { load() }, [load])

  const openCategory = (id: string) =>
    router.push({ pathname: '/(customer)/find/[categoryId]', params: { categoryId: id } } as any)

  const openServiceProviders = (jobId: string, jobName?: string, categoryId?: string) =>
    router.push({
      pathname: '/(customer)/find/taskers/[jobId]',
      params: { jobId, title: jobName || '', categoryId: categoryId || '' },
    } as any)

  const postCustom = (query: string) =>
    router.push({ pathname: '/(customer)/jobs/v2/create', params: query ? { title: query } : {} } as any)

  const visibleCategories = useMemo(
    () => (showAll ? categories : categories.slice(0, 10)),
    [categories, showAll],
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load() }}
            tintColor={v3.colors.ink}
          />
        }
      >
        <View style={styles.header}>
          {showAll ? (
            <TouchableOpacity onPress={() => setShowAll(false)} style={styles.back}>
              <CaretLeft size={20} color={v3.colors.ink} weight="bold" />
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>FIND HELP</Text>
            <Text style={styles.title}>{showAll ? 'All services' : 'What do you need done?'}</Text>
            <Text style={styles.subtitle}>
              Search a specific job, choose the work, then see nearby taskers and verified company teams.
            </Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <V3DiscoverySearch
            placeholder="Search electrician, AC repair, cleaning…"
            onCategorySelect={(id) => openCategory(id)}
            onJobSelect={openServiceProviders}
            onPostJob={postCustom}
          />
        </View>

        {!showAll ? (
          <View style={styles.flowCard}>
            <View style={styles.flowItem}>
              <View style={styles.flowIcon}><Sparkle size={17} color={v3.colors.ink} weight="fill" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.flowTitle}>1. Choose the exact work</Text>
                <Text style={styles.flowText}>For example: electrician → socket repair.</Text>
              </View>
            </View>
            <View style={styles.flowLine} />
            <View style={styles.flowItem}>
              <View style={styles.flowIcon}><Briefcase size={17} color={v3.colors.ink} weight="fill" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.flowTitle}>2. Compare nearby providers</Text>
                <Text style={styles.flowText}>Individuals and verified company teams in one list.</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.sectionRow}>
          <View>
            <Text style={styles.sectionTitle}>{showAll ? 'Every category' : 'Browse categories'}</Text>
            <Text style={styles.sectionMeta}>Tap a category to choose the exact job.</Text>
          </View>
          {!showAll ? (
            <TouchableOpacity onPress={() => setShowAll(true)}>
              <Text style={styles.sectionLink}>View all</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.grid}>
          {visibleCategories.map((item: any, index: number) => {
            const slug = item.slug || ''
            const visual = categoryVisualBySlug(slug)
            const Icon = visual.icon
            const wide = index === 0 || index === 5
            const count = item.jobs?.length || item.jobCount || item.services?.length || 0
            const bg = index % 4 === 0
              ? v3.colors.amberSoft
              : index % 4 === 1
                ? v3.colors.infoSoft
                : index % 4 === 2
                  ? v3.colors.successSoft
                  : v3.colors.paper

            return (
              <TouchableOpacity
                key={item.id || item.slug || String(index)}
                activeOpacity={0.78}
                onPress={() => openCategory(item.id || item.slug)}
                style={[styles.categoryCard, wide && styles.categoryCardWide, { backgroundColor: bg }]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.iconBox}>
                    <Icon size={21} color={v3.colors.ink} weight="fill" />
                  </View>
                  <ArrowRight size={16} color={v3.colors.ink} weight="bold" />
                </View>
                <Text style={styles.categoryName} numberOfLines={2}>{item.name || item.slug}</Text>
                <Text style={styles.categoryDesc} numberOfLines={1}>{descriptionFor(item)}</Text>
                <View style={styles.cardFoot}>
                  <View style={styles.availabilityDot} />
                  <Text style={styles.cardFootText}>{count ? `${count} work types` : 'See available work'}</Text>
                </View>
              </TouchableOpacity>
            )
          })}

          {loading && categories.length === 0
            ? [0, 1, 2, 3, 4, 5].map((index) => <View key={index} style={[styles.categoryCard, styles.skeleton]} />)
            : null}
        </View>

        {!loading && categories.length === 0 ? (
          <View style={styles.empty}>
            <Wrench size={30} color={v3.colors.ink} weight="fill" />
            <Text style={styles.emptyTitle}>Services are unavailable right now</Text>
            <Text style={styles.emptyText}>You can still describe the work and post a custom job.</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => postCustom('')}>
              <Text style={styles.emptyButtonText}>Post a job</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity activeOpacity={0.82} style={styles.customCard} onPress={() => postCustom('')}>
          <View style={styles.customIcon}><Wrench size={21} color={v3.colors.paper} weight="fill" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.customTitle}>Can’t find the exact work?</Text>
            <Text style={styles.customText}>Describe it in your own words and let nearby providers quote.</Text>
          </View>
          <ArrowRight size={18} color={v3.colors.paper} weight="bold" />
        </TouchableOpacity>

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
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  scroll: { paddingBottom: 12 },
  header: { paddingHorizontal: 18, paddingTop: 8, flexDirection: 'row', gap: 10 },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: 'Outfit_800ExtraBold', fontSize: 9.5, color: v3.colors.amberDark, letterSpacing: 1 },
  title: { marginTop: 5, fontFamily: 'Outfit_900Black', fontSize: 27, lineHeight: 32, color: v3.colors.ink, letterSpacing: -0.4 },
  subtitle: { marginTop: 5, maxWidth: 345, fontFamily: 'Outfit_400Regular', fontSize: 11.5, lineHeight: 17, color: v3.colors.textSecondary },
  searchWrap: { marginTop: 16, paddingHorizontal: 18, zIndex: 50 },
  flowCard: { marginHorizontal: 18, marginTop: 14, padding: 14, borderRadius: 20, backgroundColor: v3.colors.ink },
  flowItem: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  flowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: v3.colors.amber, alignItems: 'center', justifyContent: 'center' },
  flowTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 12.5, color: v3.colors.paper },
  flowText: { marginTop: 2, fontFamily: 'Outfit_400Regular', fontSize: 10.5, color: '#BDBDBD' },
  flowLine: { height: 1, backgroundColor: '#2D2D2D', marginVertical: 11, marginLeft: 49 },
  sectionRow: { marginTop: 22, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: 'Outfit_900Black', fontSize: 15, color: v3.colors.ink },
  sectionMeta: { marginTop: 2, fontFamily: 'Outfit_400Regular', fontSize: 10.5, color: v3.colors.textMuted },
  sectionLink: { fontFamily: 'Outfit_800ExtraBold', fontSize: 11, color: v3.colors.ink },
  grid: { paddingHorizontal: 18, paddingTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: { width: '48.5%', minHeight: 146, borderRadius: 20, borderWidth: 1, borderColor: v3.colors.line, padding: 13 },
  categoryCardWide: { width: '100%', minHeight: 132 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBox: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center' },
  categoryName: { marginTop: 15, fontFamily: 'Outfit_800ExtraBold', fontSize: 14, lineHeight: 18, color: v3.colors.ink },
  categoryDesc: { marginTop: 4, fontFamily: 'Outfit_400Regular', fontSize: 10.5, color: v3.colors.textSecondary },
  cardFoot: { marginTop: 'auto', paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  availabilityDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: v3.colors.success },
  cardFootText: { fontFamily: 'Outfit_700Bold', fontSize: 9.5, color: v3.colors.textSecondary },
  skeleton: { backgroundColor: '#ECECEC', borderColor: '#ECECEC' },
  customCard: { marginHorizontal: 18, marginTop: 18, minHeight: 86, borderRadius: 20, backgroundColor: v3.colors.ink, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  customIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#222222', alignItems: 'center', justifyContent: 'center' },
  customTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 13.5, color: v3.colors.paper },
  customText: { marginTop: 3, fontFamily: 'Outfit_400Regular', fontSize: 10.5, lineHeight: 15, color: '#C3C3C3' },
  empty: { marginHorizontal: 18, marginTop: 18, padding: 26, borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center' },
  emptyTitle: { marginTop: 9, fontFamily: 'Outfit_800ExtraBold', fontSize: 15, color: v3.colors.ink },
  emptyText: { marginTop: 4, fontFamily: 'Outfit_400Regular', fontSize: 11, color: v3.colors.textSecondary, textAlign: 'center' },
  emptyButton: { marginTop: 14, height: 44, paddingHorizontal: 18, borderRadius: 14, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  emptyButtonText: { fontFamily: 'Outfit_700Bold', fontSize: 12, color: v3.colors.paper },
})
