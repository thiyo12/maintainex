import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Buildings, MagnifyingGlass } from 'phosphor-react-native'
import { v2Jobs, v2Quotes, v2Request } from '../../../lib/api-v2'
import { fonts } from '../../../lib/fonts'
import { v3 } from '../../../theme/v3/tokens'

function formatDateLabel(job: any) {
  if (job.status === 'COMPLETED') return 'Completed · paid'
  if (job.status === 'CANCELLED') return 'Cancelled'
  if (job.myQuote && !['QUOTE_ACCEPTED', 'ESCROW_DEPOSITED', 'IN_PROGRESS', 'COMPLETED'].includes(job.status)) return 'Quote pending'

  const rawDate = job.preferredDate || job.scheduledAt
  if (!rawDate) {
    if (job.status === 'IN_PROGRESS') return 'In progress'
    if (['QUOTE_ACCEPTED', 'PENDING_PAYMENT', 'ESCROW_DEPOSITED'].includes(job.status)) return 'Accepted'
    return String(job.status || 'Open').replaceAll('_', ' ').toLowerCase()
  }

  const date = new Date(rawDate)
  const now = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(now.getDate() + 1)

  let day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (date.toDateString() === now.toDateString()) day = 'Today'
  else if (date.toDateString() === tomorrow.toDateString()) day = 'Tomorrow'

  const time = job.timeSlot || (job.scheduledAt
    ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : '')

  if (job.status === 'IN_PROGRESS') return 'In progress · ' + day
  if (['QUOTE_ACCEPTED', 'PENDING_PAYMENT', 'ESCROW_DEPOSITED'].includes(job.status)) return 'Accepted · ' + day
  return time ? day + ' · ' + time : day
}

export default function TaskerMyJobs() {
  const router = useRouter()
  const [jobs, setJobs] = useState<any[]>([])
  const [companyAssignments, setCompanyAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadJobs = useCallback(async () => {
    try {
      const [res, workerRes] = await Promise.all([
        v2Jobs.list('myQuotes=true'),
        v2Request<{ assignments: any[] }>('/api/mobile/worker/assignments').catch(() => ({ assignments: [] })),
      ])
      const allJobs = res.jobs || []
      setCompanyAssignments(workerRes.assignments || [])
      const hydrated = await Promise.all(
        allJobs.map(async (job: any) => {
          try {
            const qRes = await v2Quotes.list(job.id)
            const myQuote = qRes.quotes.find((quote: any) => quote.status !== 'REJECTED')
            return { ...job, myQuote: myQuote || null }
          } catch {
            return { ...job, myQuote: null }
          }
        })
      )
      setJobs(hydrated)
    } catch (error) {
      console.error('Load my jobs error:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  const pipeline = useMemo(() => {
    const rank: Record<string, number> = {
      IN_PROGRESS: 0,
      ESCROW_DEPOSITED: 1,
      PENDING_PAYMENT: 2,
      QUOTE_ACCEPTED: 3,
      OPEN: 4,
      COMPLETED: 5,
      CANCELLED: 6,
    }
    return [...jobs].sort((a, b) => {
      const aRank = rank[a.status] ?? 4
      const bRank = rank[b.status] ?? 4
      if (aRank !== bRank) return aRank - bRank
      return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
    })
  }, [jobs])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <View style={styles.topSpacer} />
        <Text style={styles.topTitle}>My jobs</Text>
        <TouchableOpacity
          style={styles.roundAction}
          activeOpacity={0.75}
          onPress={() => router.push('/(tasker)/jobs/v2/browse' as any)}
        >
          <MagnifyingGlass size={15} color={v3.colors.ink} weight="bold" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadJobs() }} tintColor={v3.colors.ink} />}
      >
        <Text style={styles.hero}>Your work pipeline</Text>
        <Text style={styles.subtitle}>Direct marketplace work and jobs assigned by companies you work with.</Text>

        {companyAssignments.length > 0 ? (
          <View style={styles.companySection}>
            <View style={styles.companySectionHead}>
              <View style={styles.companySectionIcon}><Buildings size={17} color={v3.colors.ink} weight="fill" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.companySectionTitle}>Company assignments</Text>
                <Text style={styles.companySectionText}>Accept or continue work dispatched by your company.</Text>
              </View>
              <View style={styles.companyCount}><Text style={styles.companyCountText}>{companyAssignments.length}</Text></View>
            </View>

            {companyAssignments.map((assignment: any) => (
              <TouchableOpacity
                key={assignment.id}
                style={styles.assignmentRow}
                activeOpacity={0.72}
                onPress={() => router.push((`/(tasker)/company-assignments/${assignment.id}`) as any)}
              >
                <View style={styles.assignmentBadge}>
                  <Text style={styles.assignmentBadgeText}>{String(assignment.status).replaceAll('_', ' ')}</Text>
                </View>
                <View style={styles.assignmentCopy}>
                  <Text style={styles.assignmentTitle} numberOfLines={1}>{assignment.job?.title || 'Company job'}</Text>
                  <Text style={styles.assignmentMeta} numberOfLines={1}>
                    {assignment.company?.companyName || 'Company'} · {assignment.job?.preferredDate ? new Date(assignment.job.preferredDate).toLocaleDateString() : 'Schedule in job'}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={v3.colors.ink} />
          </View>
        ) : pipeline.length === 0 && companyAssignments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No jobs in your pipeline yet.</Text>
            <Text style={styles.emptyText}>Browse nearby work and send your first quote.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(tasker)/jobs/v2/browse' as any)}>
              <Text style={styles.primaryButtonText}>Browse jobs</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.pipeline}>
            {pipeline.map((job, index) => (
              <TouchableOpacity
                key={job.id}
                style={styles.jobRow}
                activeOpacity={0.72}
                onPress={() => router.push(('/(tasker)/jobs/v2/manage/' + job.id) as any)}
              >
                <View style={styles.indexCircle}>
                  <Text style={styles.indexText}>{index + 1}</Text>
                </View>
                <View style={styles.jobCopy}>
                  <Text style={styles.jobTitle} numberOfLines={1}>{job.title || 'MaintainEX job'}</Text>
                  <Text style={styles.jobMeta} numberOfLines={1}>{formatDateLabel(job)}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {pipeline.length > 0 || companyAssignments.length > 0 ? (
          <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.76} onPress={() => router.push('/(tasker)/jobs/v2/browse' as any)}>
            <Text style={styles.secondaryButtonText}>Browse more jobs</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  topBar: {
    height: 66,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topSpacer: { width: 40, height: 40 },
  topTitle: {
    fontSize: 13,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  roundAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 32,
  },
  hero: {
    fontSize: 25,
    lineHeight: 31,
    fontFamily: fonts.heading,
    color: v3.colors.ink,
    letterSpacing: -0.35,
  },
  subtitle: {
    marginTop: 7,
    fontSize: 10.2,
    lineHeight: 16,
    fontFamily: fonts.bodySemiBold,
    color: v3.colors.textSecondary,
  },
  loading: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companySection: {
    marginTop: 20,
    backgroundColor: v3.colors.amberSoft,
    borderRadius: 18,
    padding: 12,
  },
  companySectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  companySectionIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: v3.colors.amber, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  companySectionTitle: { fontSize: 11.5, fontFamily: fonts.headingBold, color: v3.colors.ink },
  companySectionText: { marginTop: 1, fontSize: 8.8, lineHeight: 12, fontFamily: fonts.body, color: v3.colors.textSecondary },
  companyCount: { minWidth: 28, height: 28, borderRadius: 14, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  companyCountText: { fontSize: 10, fontFamily: fonts.headingBold, color: v3.colors.paper },
  assignmentRow: { minHeight: 58, borderRadius: 14, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  assignmentBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999, backgroundColor: v3.colors.surfaceGray },
  assignmentBadgeText: { fontSize: 7.5, fontFamily: fonts.headingBold, color: v3.colors.textSecondary },
  assignmentCopy: { flex: 1, marginLeft: 9 },
  assignmentTitle: { fontSize: 10.5, fontFamily: fonts.headingBold, color: v3.colors.ink },
  assignmentMeta: { marginTop: 2, fontSize: 8.2, fontFamily: fonts.body, color: v3.colors.textMuted },
  pipeline: {
    marginTop: 24,
    gap: 10,
  },
  jobRow: {
    height: 56,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    flexDirection: 'row',
    alignItems: 'center',
  },
  indexCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: v3.colors.surfaceGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    fontSize: 10,
    fontFamily: fonts.heading,
    color: v3.colors.ink,
  },
  jobCopy: {
    flex: 1,
    marginLeft: 10,
  },
  jobTitle: {
    fontSize: 11.2,
    lineHeight: 15,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  jobMeta: {
    marginTop: 2,
    fontSize: 8.8,
    lineHeight: 12,
    fontFamily: fonts.bodySemiBold,
    color: v3.colors.textSecondary,
    textTransform: 'capitalize',
  },
  chevron: {
    fontSize: 20,
    lineHeight: 22,
    fontFamily: fonts.body,
    color: v3.colors.textSecondary,
  },
  emptyCard: {
    marginTop: 24,
    padding: 20,
    borderRadius: 18,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  emptyText: {
    marginTop: 5,
    fontSize: 10,
    lineHeight: 15,
    fontFamily: fonts.body,
    color: v3.colors.textMuted,
  },
  primaryButton: {
    marginTop: 16,
    height: 44,
    borderRadius: 13,
    backgroundColor: v3.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 11,
    fontFamily: fonts.headingBold,
    color: v3.colors.paper,
  },
  secondaryButton: {
    marginTop: 22,
    height: 46,
    borderRadius: 14,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 11,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
})
