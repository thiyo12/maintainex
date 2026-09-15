import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../../lib/ThemeContext'
import { fonts } from '../../../../lib/fonts'
import { v2Jobs, V2Job } from '../../../../lib/api-v2'

export default function CompanyMyQuotesScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const [jobs, setJobs] = useState<V2Job[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadJobs = useCallback(async () => {
    try {
      const res = await v2Jobs.list('myQuotes=true')
      setJobs(res.jobs)
    } catch {
      // fail silently
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  const statusLabel = (status: string) => {
    switch (status) {
      case 'OPEN': return { text: t('company.quoteOpen'), color: colors.amberDark, bg: colors.amberBg }
      case 'QUOTE_ACCEPTED': return { text: t('company.quoteAwaitingPayment'), color: '#6D28D9', bg: '#EDE9FE' }
      case 'IN_PROGRESS': return { text: t('company.quoteInProgress'), color: '#1D4ED8', bg: '#DBEAFE' }
      case 'COMPLETED': return { text: t('company.quoteCompleted'), color: '#065F46', bg: '#DCFCE7' }
      case 'CANCELLED': return { text: t('company.quoteCancelled'), color: colors.error, bg: colors.errorBg }
      case 'DISPUTED': return { text: t('company.quoteCancelled'), color: colors.error, bg: colors.errorBg }
      default: return { text: status.replace('_', ' '), color: colors.muted, bg: colors.surface }
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('company.myQuotes')}</Text>
        <TouchableOpacity onPress={() => router.push('/(company)/jobs/v2/browse')} hitSlop={8}>
          <Ionicons name="search-outline" size={24} color={colors.companyAccent} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.companyAccent} style={{ marginTop: 60 }} />
      ) : jobs.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={48} color={colors.muted} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>{t('company.noQuotesYet')}</Text>
          <Text style={styles.emptyDesc}>{t('company.noQuotesYetDesc')}</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => router.push('/(company)/jobs/v2/browse')}>
            <Text style={styles.browseBtnText}>{t('company.browseJobs')} →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, padding: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadJobs() }} tintColor={colors.amber} />}
        >
          {jobs.map((job) => {
            const s = statusLabel(job.status)
            return (
              <TouchableOpacity
                key={job.id}
                style={styles.jobCard}
                onPress={() => router.push(`/(company)/jobs/v2/manage/${job.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                  <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
                    <Text style={[styles.statusPillText, { color: s.color }]}>{s.text}</Text>
                  </View>
                </View>
                <Text style={styles.jobDesc} numberOfLines={2}>{job.description}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.budget}>LKR {job.budgetAmount?.toLocaleString() ?? 'Not set'}</Text>
                  <Text style={styles.meta}>{t('jobs.posted')} {new Date(job.createdAt).toLocaleDateString()}</Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, fontFamily: fonts.heading },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  browseBtn: { backgroundColor: colors.amber, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  browseBtnText: { fontSize: 14, fontWeight: '800', color: '#111827' },
  jobCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  jobTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, flex: 1, marginRight: 8, fontFamily: fonts.heading },
  statusPill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  jobDesc: { fontSize: 13, color: colors.ink, opacity: 0.6, lineHeight: 19, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budget: { fontSize: 16, fontWeight: '800', color: colors.amberDark },
  meta: { fontSize: 12, color: colors.muted },
})