import { useCallback, useEffect, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { CaretLeft, CaretRight, DotsThree } from 'phosphor-react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { jobCategories, templateJobs } from '@/api/jobs'
import { useCountry } from '@/lib/country'
import { v3 } from '@/theme/v3/tokens'

export default function ServiceCategory() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>()
  const [category, setCategory] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { selectedCountry } = useCountry()
  const router = useRouter()

  const fetchData = useCallback(async () => {
    if (!categoryId) {
      setLoading(false)
      setRefreshing(false)
      return
    }

    try {
      // The category endpoint already returns its active jobs. Load that first so
      // one secondary template request cannot blank the whole service screen.
      const catData: any = await jobCategories.get(categoryId)
      setCategory(catData)

      const embeddedJobs = Array.isArray(catData?.jobs) ? catData.jobs : []
      setJobs(embeddedJobs)

      // Template jobs can contain richer discovery metadata. Merge them when
      // available, but never fail the screen if this optional request fails.
      templateJobs.listByCategory(catData?.id || categoryId, selectedCountry?.code)
        .then((jobsData: any) => {
          const templates = Array.isArray(jobsData) ? jobsData : []
          if (!templates.length) return

          const merged = new Map<string, any>()
          embeddedJobs.forEach((item: any) => merged.set(String(item.id), item))
          templates.forEach((item: any) => merged.set(String(item.id), { ...merged.get(String(item.id)), ...item }))
          setJobs(Array.from(merged.values()))
        })
        .catch((error) => {
          console.warn('Template service metadata unavailable; using category jobs', error)
        })
    } catch (error) {
      console.error('Failed to load service category', error)

      // Last recovery path: resolve a slug/id from the category list, which
      // also protects older deep links and fallback home-category slugs.
      try {
        const all: any = await jobCategories.list(selectedCountry?.code)
        const list = Array.isArray(all) ? all : []
        const match = list.find((item: any) => item.id === categoryId || item.slug === categoryId)
        if (match) {
          setCategory(match)
          setJobs(Array.isArray(match.jobs) ? match.jobs : [])
        } else {
          setCategory(null)
          setJobs([])
        }
      } catch (fallbackError) {
        console.error('Failed to recover service category', fallbackError)
        setCategory(null)
        setJobs([])
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [categoryId, selectedCountry?.code])

  useEffect(() => { fetchData() }, [fetchData])

  const visible = jobs.slice(0, 6)
  const categoryName = category?.name || 'Service'

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()} hitSlop={10}>
          <CaretLeft size={20} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{categoryName}</Text>
        <View style={styles.headerButtonRight}><DotsThree size={17} color={v3.colors.ink} weight="bold" /></View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData() }} tintColor={v3.colors.ink} />}
      >
        <Text style={styles.eyebrow}>POPULAR NEAR YOU</Text>
        <Text style={styles.title}>What needs fixing?</Text>
        <Text style={styles.subtitle}>Choose the exact work. Next, compare nearby taskers and verified company teams.</Text>

        <View style={styles.list}>
          {loading ? [0, 1, 2, 3, 4, 5].map(i => <View key={i} style={[styles.row, styles.skeleton]} />) : visible.map((item: any, index: number) => (
            <TouchableOpacity
              key={item.id || String(index)}
              style={styles.row}
              onPress={() => router.push({ pathname: '/(customer)/find/taskers/[jobId]', params: { jobId: item.id, title: item.name || item.title || '', categoryId: categoryId! } } as any)}
              activeOpacity={0.72}
            >
              <View style={styles.numberCircle}><Text style={styles.numberText}>{index + 1}</Text></View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.name || item.title || `Service ${index + 1}`}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {item.nearbyTaskerCount ? `${item.nearbyTaskerCount} taskers nearby` : item.isPopular ? 'Popular with nearby taskers' : item.priceMin && item.priceMax ? `LKR ${Number(item.priceMin).toLocaleString()}–${Number(item.priceMax).toLocaleString()}` : 'Get a detailed quote'}
                </Text>
              </View>
              <CaretRight size={16} color={v3.colors.ink} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push({ pathname: '/(customer)/jobs/v2/create', params: { categoryId: categoryId!, categoryName } } as any)}
            activeOpacity={0.72}
          >
            <View style={styles.numberCircle}><Text style={styles.numberText}>{Math.min(visible.length + 1, 7)}</Text></View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Something else</Text>
              <Text style={styles.rowSub}>Describe it in your own words</Text>
            </View>
            <CaretRight size={16} color={v3.colors.ink} />
          </TouchableOpacity>

          {!loading && jobs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No listed work types yet</Text>
              <Text style={styles.empty}>You can still describe exactly what you need and send it to nearby providers.</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.emptyButton}
                onPress={() => router.push({ pathname: '/(customer)/jobs/v2/create', params: { categoryId: category?.id || categoryId!, categoryName } } as any)}
              >
                <Text style={styles.emptyButtonText}>Post this job</Text>
              </TouchableOpacity>
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
  headerTitle: { flex: 1, marginHorizontal: 8, textAlign: 'center', fontSize: 13, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  scroll: { paddingHorizontal: 18, paddingBottom: 40 },
  eyebrow: { marginTop: 8, fontSize: 8.4, fontFamily: 'Outfit_900Black', color: v3.colors.amberDark, letterSpacing: 0.45 },
  title: { marginTop: 8, fontSize: 25, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  subtitle: { marginTop: 8, fontSize: 10.2, lineHeight: 15, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  list: { marginTop: 22 },
  row: { minHeight: 64, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, marginBottom: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  skeleton: { backgroundColor: '#EEEEEE' },
  numberCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F1F1F1', alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 10, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  rowCopy: { flex: 1 },
  rowTitle: { fontSize: 11.2, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  rowSub: { marginTop: 3, fontSize: 8.8, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  emptyCard: { marginTop: 8, padding: 20, borderRadius: 18, backgroundColor: v3.colors.amberSoft, borderWidth: 1, borderColor: '#F2D08C', alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink, textAlign: 'center' },
  empty: { marginTop: 8, fontSize: 10.5, lineHeight: 16, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textMuted, textAlign: 'center' },
  emptyButton: { marginTop: 14, height: 44, paddingHorizontal: 18, borderRadius: 13, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  emptyButtonText: { fontSize: 11.5, fontFamily: 'Outfit_700Bold', color: v3.colors.paper },
})
