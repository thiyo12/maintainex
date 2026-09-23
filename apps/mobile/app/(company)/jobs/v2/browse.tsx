import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft, MagnifyingGlass, MapPin } from 'phosphor-react-native'
import { v2Jobs, type V2Job } from '../../../../lib/api-v2'
import { v3 } from '../../../../theme/v3/tokens'

export default function CompanyBrowseJobsScreen() {
  const router = useRouter()
  const [jobs, setJobs] = useState<V2Job[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const response = await v2Jobs.list('role=provider')
      setJobs(response.jobs || [])
    } catch {
      setJobs([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter((job) => `${job.title} ${job.description}`.toLowerCase().includes(q))
  }, [jobs, query])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}><CaretLeft size={18} color={v3.colors.ink} weight="bold" /></TouchableOpacity>
        <View style={styles.headerCopy}><Text style={styles.eyebrow}>MATCHED TO YOUR SERVICES</Text><Text style={styles.title}>Opportunities</Text></View>
        <View style={styles.count}><Text style={styles.countText}>{jobs.length}</Text></View>
      </View>

      <View style={styles.search}>
        <MagnifyingGlass size={18} color={v3.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search matched jobs"
          placeholderTextColor={v3.colors.textPlaceholder}
        />
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={v3.colors.ink} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
        >
          {filtered.length ? filtered.map((job) => (
            <TouchableOpacity key={job.id} style={styles.card} activeOpacity={0.74} onPress={() => router.push(`/(company)/jobs/v2/quote/${job.id}` as any)}>
              <View style={styles.cardTop}>
                <View style={styles.openPill}><Text style={styles.openText}>OPEN</Text></View>
                <Text style={styles.budget}>{job.budgetAmount ? `LKR ${Number(job.budgetAmount).toLocaleString()}` : 'Quotes requested'}</Text>
              </View>
              <Text style={styles.jobTitle}>{job.title}</Text>
              <Text style={styles.description} numberOfLines={2}>{job.description}</Text>
              <View style={styles.metaRow}>
                <View style={styles.meta}><MapPin size={13} color={v3.colors.textMuted} /><Text style={styles.metaText}>{job.areaId || job.postalCode || 'Customer location'}</Text></View>
                <Text style={styles.date}>{new Date(job.createdAt).toLocaleDateString()}</Text>
              </View>
              <View style={styles.quoteButton}><Text style={styles.quoteButtonText}>Review & send quote</Text></View>
            </TouchableOpacity>
          )) : (
            <View style={styles.empty}>
              <MagnifyingGlass size={30} color={v3.colors.textMuted} />
              <Text style={styles.emptyTitle}>No matching opportunities</Text>
              <Text style={styles.emptyText}>Your company only sees jobs that match its services and country. Add services in Company Profile to improve matching.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, marginLeft: 11 },
  eyebrow: { ...v3.typography.smallBold, color: v3.colors.amberDark, letterSpacing: 0.7 },
  title: { ...v3.typography.h5, color: v3.colors.ink },
  count: { minWidth: 38, height: 38, borderRadius: 19, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  countText: { ...v3.typography.bodyBold, color: v3.colors.paper },
  search: { marginHorizontal: 18, height: 50, borderRadius: 16, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  searchInput: { flex: 1, marginLeft: 8, color: v3.colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 13 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingTop: 12, paddingBottom: 34 },
  card: { backgroundColor: v3.colors.paper, borderRadius: 20, borderWidth: 1, borderColor: v3.colors.line, padding: 16, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  openPill: { backgroundColor: v3.colors.successSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  openText: { ...v3.typography.smallBold, color: v3.colors.success },
  budget: { ...v3.typography.bodyBold, color: v3.colors.ink },
  jobTitle: { ...v3.typography.title, color: v3.colors.ink, marginTop: 11 },
  description: { ...v3.typography.caption, color: v3.colors.textSecondary, lineHeight: 17, marginTop: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  metaText: { ...v3.typography.small, color: v3.colors.textMuted },
  date: { ...v3.typography.small, color: v3.colors.textMuted },
  quoteButton: { height: 45, borderRadius: 14, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 13 },
  quoteButtonText: { ...v3.typography.bodyBold, color: v3.colors.paper },
  empty: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 70 },
  emptyTitle: { ...v3.typography.title, color: v3.colors.ink, marginTop: 12 },
  emptyText: { ...v3.typography.caption, color: v3.colors.textMuted, textAlign: 'center', lineHeight: 17, marginTop: 5 },
})
