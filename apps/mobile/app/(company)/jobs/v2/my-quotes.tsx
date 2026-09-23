import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Briefcase, CaretLeft, MagnifyingGlass } from 'phosphor-react-native'
import { v2Jobs, type V2Job } from '../../../../lib/api-v2'
import { v3 } from '../../../../theme/v3/tokens'

type Filter = 'all' | 'open' | 'active' | 'done'

export default function CompanyMyQuotesScreen() {
  const router = useRouter()
  const [jobs, setJobs] = useState<V2Job[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const response = await v2Jobs.list('myQuotes=true')
      setJobs(response.jobs || [])
    } catch {
      setJobs([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => jobs.filter((job) => {
    if (filter === 'all') return true
    if (filter === 'open') return job.status === 'OPEN'
    if (filter === 'active') return ['QUOTE_ACCEPTED', 'IN_PROGRESS'].includes(job.status)
    return ['COMPLETED', 'CANCELLED'].includes(job.status)
  }), [jobs, filter])

  const summary = useMemo(() => ({
    all: jobs.length,
    open: jobs.filter((job) => job.status === 'OPEN').length,
    active: jobs.filter((job) => ['QUOTE_ACCEPTED', 'IN_PROGRESS'].includes(job.status)).length,
    done: jobs.filter((job) => ['COMPLETED', 'CANCELLED'].includes(job.status)).length,
  }), [jobs])

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color={v3.colors.ink} /></View></SafeAreaView>
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.circle} onPress={() => router.back()}>
          <CaretLeft size={18} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>COMPANY PIPELINE</Text>
          <Text style={styles.title}>Quotes & jobs</Text>
        </View>
        <TouchableOpacity style={styles.circle} onPress={() => router.push('/(company)/jobs/v2/browse' as any)}>
          <MagnifyingGlass size={18} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        {([
          ['all', 'All', summary.all],
          ['open', 'Waiting', summary.open],
          ['active', 'Active', summary.active],
          ['done', 'Closed', summary.done],
        ] as const).map(([key, label, count]) => (
          <TouchableOpacity key={key} style={[styles.filter, filter === key && styles.filterActive]} onPress={() => setFilter(key)}>
            <Text style={[styles.filterLabel, filter === key && styles.filterLabelActive]}>{label}</Text>
            <Text style={[styles.filterCount, filter === key && styles.filterCountActive]}>{count}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
      >
        {filtered.length ? filtered.map((job) => {
          const status = statusMeta(job.status)
          return (
            <TouchableOpacity
              key={job.id}
              style={styles.card}
              activeOpacity={0.74}
              onPress={() => router.push(`/(company)/jobs/v2/manage/${job.id}` as any)}
            >
              <View style={styles.cardTop}>
                <View style={[styles.status, { backgroundColor: status.bg }]}>
                  <Text style={[styles.statusText, { color: status.fg }]}>{status.label}</Text>
                </View>
                <Text style={styles.date}>{new Date(job.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
              <Text style={styles.jobText} numberOfLines={2}>{job.description}</Text>
              <View style={styles.bottom}>
                <Text style={styles.money}>{job.budgetAmount ? `LKR ${Number(job.budgetAmount).toLocaleString()}` : 'Customer requested quotes'}</Text>
                <Text style={styles.open}>Open →</Text>
              </View>
            </TouchableOpacity>
          )
        }) : (
          <View style={styles.empty}>
            <Briefcase size={31} color={v3.colors.textMuted} />
            <Text style={styles.emptyTitle}>Nothing in this view</Text>
            <Text style={styles.emptyText}>Browse matching opportunities and send a quote. Submitted company quotes will stay visible here.</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/(company)/jobs/v2/browse' as any)}>
              <Text style={styles.emptyButtonText}>Find opportunities</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function statusMeta(status: string) {
  switch (status) {
    case 'OPEN': return { label: 'QUOTE SENT', fg: v3.colors.amberDark, bg: v3.colors.amberSoft }
    case 'QUOTE_ACCEPTED': return { label: 'SELECTED', fg: v3.colors.info, bg: v3.colors.infoSoft }
    case 'IN_PROGRESS': return { label: 'IN PROGRESS', fg: v3.colors.success, bg: v3.colors.successSoft }
    case 'COMPLETED': return { label: 'COMPLETED', fg: v3.colors.success, bg: v3.colors.successSoft }
    case 'CANCELLED': return { label: 'CLOSED', fg: v3.colors.error, bg: v3.colors.errorSoft }
    default: return { label: status.replaceAll('_', ' '), fg: v3.colors.textSecondary, bg: v3.colors.surfaceGray }
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 },
  circle: { width: 40, height: 40, borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, marginHorizontal: 11 },
  eyebrow: { ...v3.typography.smallBold, color: v3.colors.amberDark, letterSpacing: 0.7 },
  title: { ...v3.typography.title, color: v3.colors.ink, marginTop: 1 },
  filters: { flexDirection: 'row', marginHorizontal: 18, backgroundColor: v3.colors.paper, borderRadius: 17, borderWidth: 1, borderColor: v3.colors.line, padding: 4 },
  filter: { flex: 1, minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  filterActive: { backgroundColor: v3.colors.ink },
  filterLabel: { ...v3.typography.smallBold, color: v3.colors.textMuted },
  filterLabelActive: { color: v3.colors.paper },
  filterCount: { ...v3.typography.captionBold, color: v3.colors.ink, marginTop: 1 },
  filterCountActive: { color: v3.colors.amber },
  content: { padding: 18, paddingTop: 12, paddingBottom: 36 },
  card: { backgroundColor: v3.colors.paper, borderRadius: 20, borderWidth: 1, borderColor: v3.colors.line, padding: 15, marginBottom: 9 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { ...v3.typography.smallBold },
  date: { ...v3.typography.small, color: v3.colors.textMuted },
  jobTitle: { ...v3.typography.title, color: v3.colors.ink, marginTop: 11 },
  jobText: { ...v3.typography.caption, color: v3.colors.textSecondary, lineHeight: 17, marginTop: 4 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 13 },
  money: { ...v3.typography.captionBold, color: v3.colors.ink, flex: 1 },
  open: { ...v3.typography.captionBold, color: v3.colors.amberDark },
  empty: { alignItems: 'center', paddingHorizontal: 34, paddingTop: 68 },
  emptyTitle: { ...v3.typography.title, color: v3.colors.ink, marginTop: 12 },
  emptyText: { ...v3.typography.caption, color: v3.colors.textMuted, textAlign: 'center', lineHeight: 17, marginTop: 5 },
  emptyButton: { height: 46, borderRadius: 14, backgroundColor: v3.colors.ink, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  emptyButtonText: { ...v3.typography.bodyBold, color: v3.colors.paper },
})
