import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../../../lib/ThemeContext'
import { fonts } from '../../../../../lib/fonts'
import { v2Jobs, v2JobActions, V2Job, V2Quote } from '../../../../../lib/api-v2'
import QuoteCard from '../../../../../components/jobs/QuoteCard'

export default function V2QuotesScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<V2Job | null>(null)
  const [quotes, setQuotes] = useState<V2Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')

  useEffect(() => { loadData() }, [id])

  const loadData = async () => {
    try {
      const res = await v2Jobs.get(id)
      setJob(res.job)
      setQuotes(res.job.quotes || [])
    } catch (e) {
      Alert.alert(t('common.error'), t('errors.generic'))
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (quoteId: string) => {
    setActionLoading(quoteId)
    try {
      await v2JobActions.selectQuote(id, quoteId)
      Alert.alert(t('quotes.acceptSuccess'), t('quotes.acceptSuccessDesc'), [
        { text: t('common.ok'), onPress: () => router.push(`/(customer)/jobs/v2/${id}`) },
      ])
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setActionLoading('')
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  const sorted = [...quotes].sort((a, b) => a.price - b.price)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('quotes.title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      {job && (
        <View style={styles.jobSummary}>
          <Text style={styles.jobTitle}>{job.title}</Text>
          <View style={styles.jobMetaRow}>
            <Text style={styles.jobMeta}>{t('quotes.budget', { amount: job.budgetAmount })}</Text>
            <Text style={styles.jobMeta}>{t('quotes.title')} ({sorted.length})</Text>
          </View>
        </View>
      )}

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {sorted.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="chatbubble-ellipses" size={48} color={colors.muted} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>{t('quotes.noQuotes')}</Text>
            <Text style={styles.emptySub}>{t('quotes.noQuotesMsg')}</Text>
          </View>
        ) : (
          sorted.map((q) => (
            <QuoteCard
              key={q.id}
              providerName={q.provider?.name || t('quotes.provider')}
              providerType={(q.providerType || 'FREELANCER') as 'FREELANCER' | 'COMPANY'}
              price={q.price}
              message={q.message}
              estimatedCompletion={q.estimatedCompletionTime}
              rating={q.provider?.rating}
              onAccept={() => handleAccept(q.id)}
              onViewProfile={q.providerId ? () => router.push(`/(customer)/find/tasker-profile/${q.providerId}`) : undefined}
              loading={actionLoading === q.id}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backText: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.amber },
  headerTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.ink },
  jobSummary: { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  jobTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.ink, marginBottom: 4 },
  jobMetaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  jobMeta: { fontSize: 13, fontFamily: fonts.body, color: colors.muted },
  list: { flex: 1, padding: 16 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.ink, marginBottom: 6 },
  emptySub: { fontSize: 14, fontFamily: fonts.body, color: colors.muted },
})
