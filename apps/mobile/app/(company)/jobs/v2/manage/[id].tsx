import { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../../../lib/ThemeContext'
import { fonts } from '../../../../../lib/fonts'
import { v2Jobs, v2JobActions } from '../../../../../lib/api-v2'
import { useAuth } from '../../../../../lib/auth'
import Avatar from '../../../../../components/ui/Avatar'
import NewChatModal from '../../../../../components/chat/NewChatModal'

export default function CompanyManageJobScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [chatVisible, setChatVisible] = useState(false)
  const [pinState, setPinState] = useState<any>(null)

  const loadJob = async () => {
    try {
      const [jobRes, pinRes] = await Promise.all([
        v2Jobs.get(id, 'company'),
        v2JobActions.getPinState(id).catch(() => ({ pinState: null })),
      ])
      setJob(jobRes.job)
      setPinState(pinRes.pinState)
    } catch {
      Alert.alert(t('common.error'), t('errors.jobNotFound'))
      router.back()
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadJob()
    }, [id])
  )

  const myQuote = job?.quotes?.[0] || null

  const handleMarkComplete = async () => {
    setActionLoading('complete')
    try {
      await v2JobActions.complete(id, 'MARK_COMPLETE')
      await loadJob()
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setActionLoading('')
    }
  }

  const quoteStatusLabel = (q: any) => {
    if (!q) return null
    switch (q.status) {
      case 'PENDING': return { text: t('company.quoteOpen'), color: colors.amberDark, bg: colors.amberBg }
      case 'ACCEPTED': return job?.status === 'QUOTE_ACCEPTED'
        ? { text: t('company.quoteAwaitingPayment'), color: '#6D28D9', bg: '#EDE9FE' }
        : { text: t('company.quoteAccepted'), color: '#065F46', bg: '#DCFCE7' }
      case 'REJECTED': return { text: t('company.quoteRejected'), color: colors.error, bg: colors.errorBg }
      default: return { text: q.status, color: colors.muted, bg: colors.surface }
    }
  }

  const worksCard = (ws: any) => {
    if (!ws) return null
    switch (ws.progressStatus) {
      case 'COMPLETED': return { text: t('company.quoteCompleted'), color: colors.success, bg: colors.successBg }
      case 'DISPUTED': return { text: t('company.quoteCancelled'), color: colors.error, bg: colors.errorBg }
      default: return { text: ws.progressStatus.replace('_', ' '), color: colors.muted, bg: colors.surface }
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.companyAccent} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  if (!job) return null

  const qs = quoteStatusLabel(myQuote)
  const wsCard = worksCard(job.workspace)
  const assignment = job.companyAssignment
  const isAssignedWorker =
    !!user?.id &&
    assignment?.workerUserId === user.id &&
    ['ACCEPTED', 'IN_PROGRESS'].includes(assignment?.status)
  const canStart =
    isAssignedWorker &&
    assignment?.status === 'ACCEPTED' &&
    job.workspace?.progressStatus === 'ACCEPTED' &&
    job.escrow?.status === 'PROTECTED'
  const canComplete =
    isAssignedWorker &&
    assignment?.status === 'IN_PROGRESS' &&
    job.workspace?.progressStatus === 'IN_PROGRESS'

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('company.manageJob')}</Text>
          <TouchableOpacity onPress={() => router.push('/(company)/jobs/v2/browse')} hitSlop={8}>
            <Ionicons name="add-circle-outline" size={24} color={colors.companyAccent} />
          </TouchableOpacity>
        </View>

        {/* Job Card */}
        <View style={styles.jobCard}>
          <View style={styles.jobTop}>
            <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
            {job.status === 'OPEN' && (
              <View style={styles.openBadge}><Text style={styles.openBadgeText}>{t('jobs.status.open')}</Text></View>
            )}
          </View>
          <Text style={styles.jobDesc} numberOfLines={2}>{job.description}</Text>
          <View style={styles.jobMeta}>
            <Text style={styles.budget}>LKR {job.budgetAmount?.toLocaleString() ?? 'Not set'}</Text>
            <Text style={styles.budgetType}>{job.budgetType}</Text>
          </View>
          {job.locationName && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={colors.muted} />
              <Text style={styles.locationText}>{job.locationName}</Text>
            </View>
          )}
        </View>

        {/* Customer */}
        {job.customer && (
          <View style={styles.customerCard}>
            <Avatar name={job.customer.name || t('customer.unknown')} size={40} color={colors.companyAccent} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.customerName}>{job.customer.name || t('customer.unknown')}</Text>
              <Text style={styles.customerLabel}>{t('profile.customer')}</Text>
            </View>
            <TouchableOpacity style={styles.chatBtn} onPress={() => setChatVisible(true)}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFFFFF" />
              <Text style={styles.chatBtnText}>{t('company.messageCustomer')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* My Quote */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('quotes.yourQuote')}</Text>
          {myQuote ? (
            <View style={styles.quoteCard}>
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>{t('quotes.price')}</Text>
                <Text style={styles.quotePrice}>LKR {myQuote.price.toLocaleString()}</Text>
              </View>
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>{t('quotes.estimatedTime')}</Text>
                <Text style={styles.quoteValue}>{myQuote.estimatedCompletionTime || '—'}</Text>
              </View>
              {myQuote.message ? (
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>{t('quotes.message')}</Text>
                  <Text style={[styles.quoteValue, { flex: 1, marginLeft: 8, textAlign: 'right' }]} numberOfLines={3}>{myQuote.message}</Text>
                </View>
              ) : null}
              {qs && (
                <View style={[styles.statusPill, { backgroundColor: qs.bg }]}>
                  <Text style={[styles.statusPillText, { color: qs.color }]}>{qs.text}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t('company.noQuotesYet')}</Text>
              <Text style={styles.emptyDesc}>{t('company.noQuotesYetDesc')}</Text>
              <TouchableOpacity style={styles.browseBtn} onPress={() => router.push('/(company)/jobs/v2/browse')}>
                <Text style={styles.browseBtnText}>{t('company.browseJobs')} →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Escrow Status */}
        {job.escrow && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Escrow</Text>
            <View style={styles.escrowCard}>
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>{t('wallet.balance')}</Text>
                <Text style={styles.quotePrice}>{job.escrow.currency || 'LKR'} {job.escrow.totalAmount?.toLocaleString?.() ?? job.escrow.amount?.toLocaleString?.()}</Text>
              </View>
              {wsCard && (
                <View style={[styles.statusPill, { backgroundColor: wsCard.bg }]}>
                  <Text style={[styles.statusPillText, { color: wsCard.color }]}>{wsCard.text}</Text>
                </View>
              )}
              {job.escrow.status === 'PROTECTED' && (
                <Text style={styles.escrowHint}>{t('booking.escrowInfo')}</Text>
              )}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('company.manageJob')}</Text>
          <View style={styles.actions}>
            {canStart && !pinState?.arrivalVerifiedAt && (
              <TouchableOpacity
                style={[styles.actionBtn, actionLoading !== '' && styles.btnDisabled]}
                onPress={() => router.push(`/(company)/jobs/v2/manage/${id}/verify-pin?purpose=ARRIVAL`)}
                disabled={actionLoading !== ''}
              >
                <Ionicons name="location-outline" size={18} color="#111827" />
                <Text style={styles.actionBtnText}>Verify Arrival PIN</Text>
              </TouchableOpacity>
            )}
            {canStart && pinState?.arrivalVerifiedAt && !pinState?.workStartVerifiedAt && (
              <TouchableOpacity
                style={[styles.actionBtn, actionLoading !== '' && styles.btnDisabled]}
                onPress={() => router.push(`/(company)/jobs/v2/manage/${id}/verify-pin?purpose=WORK_START`)}
                disabled={actionLoading !== ''}
              >
                <Ionicons name="play" size={18} color="#111827" />
                <Text style={styles.actionBtnText}>Start Work with PIN</Text>
              </TouchableOpacity>
            )}
            {canComplete && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.completeBtn, actionLoading !== '' && styles.btnDisabled]}
                onPress={handleMarkComplete}
                disabled={actionLoading !== ''}
              >
                <Ionicons name="checkmark-done" size={18} color="#111827" />
                <Text style={styles.actionBtnText}>{t('tracking.confirmComplete')}</Text>
              </TouchableOpacity>
            )}
            {assignment && !isAssignedWorker && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Assigned worker</Text>
                <Text style={styles.emptyDesc}>
                  {assignment.worker?.name || 'A company employee'} is assigned to perform this job. Managers can monitor the booking, but only the assigned worker can start or complete the work.
                </Text>
              </View>
            )}
            {!assignment && myQuote?.status === 'ACCEPTED' && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Assign an employee</Text>
                <Text style={styles.emptyDesc}>Assign and have an employee accept this job before work can start.</Text>
                <TouchableOpacity
                  style={styles.browseBtn}
                  onPress={() => router.push(`/(company)/workforce/assign?jobId=${id}` as any)}
                >
                  <Text style={styles.browseBtnText}>Assign Worker →</Text>
                </TouchableOpacity>
              </View>
            )}
            {!canStart && !canComplete && !assignment && myQuote?.status !== 'ACCEPTED' && (
              <TouchableOpacity style={styles.browseBtn} onPress={() => router.push('/(company)/jobs/v2/browse')}>
                <Text style={styles.browseBtnText}>{t('company.browseJobs')} →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      <NewChatModal
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        recipient={job.customer ? { id: job.customer.id, name: job.customer.name || t('customer.unknown') } : null}
        jobId={job.id}
        jobTitle={job.title}
      />
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, fontFamily: fonts.heading },

  jobCard: { backgroundColor: colors.white, marginHorizontal: 20, marginTop: 8, borderRadius: 16, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  jobTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  jobTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, flex: 1, marginRight: 8, fontFamily: fonts.heading },
  openBadge: { backgroundColor: colors.amberBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  openBadgeText: { fontSize: 11, fontWeight: '700', color: colors.amberDark },
  jobDesc: { fontSize: 13, color: colors.ink, opacity: 0.65, lineHeight: 20, marginBottom: 12 },
  jobMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budget: { fontSize: 17, fontWeight: '800', color: colors.amberDark },
  budgetType: { fontSize: 12, fontWeight: '600', color: colors.muted, textTransform: 'uppercase' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  locationText: { fontSize: 13, color: colors.muted },

  customerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, marginHorizontal: 20, marginTop: 12, borderRadius: 16, padding: 14 },
  customerName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  customerLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  chatBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.companyAccent, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  chatBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  section: { marginHorizontal: 20, marginTop: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 10, fontFamily: fonts.heading },

  quoteCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16 },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  quoteLabel: { fontSize: 13, fontWeight: '600', color: colors.muted },
  quotePrice: { fontSize: 17, fontWeight: '800', color: colors.ink },
  quoteValue: { fontSize: 13, color: colors.ink },

  statusPill: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  statusPillText: { fontSize: 12, fontWeight: '700' },

  escrowCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16 },
  escrowHint: { fontSize: 12, color: colors.muted, marginTop: 8, lineHeight: 18 },

  emptyCard: { backgroundColor: colors.white, borderRadius: 16, padding: 20, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  emptyDesc: { fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: 12 },

  browseBtn: { backgroundColor: colors.amber, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11, alignSelf: 'center', marginTop: 6 },
  browseBtnText: { fontSize: 14, fontWeight: '800', color: '#111827' },

  actions: { gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.amber, borderRadius: 14, paddingVertical: 15 },
  completeBtn: { backgroundColor: colors.success },
  actionBtnText: { fontSize: 15, fontWeight: '800', color: '#111827' },
  btnDisabled: { opacity: 0.5 },
})