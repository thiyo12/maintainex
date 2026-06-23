import { useState, useEffect } from 'react'
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, TextInput, Modal } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { translateJobStatus } from '../../../../lib/i18n'
import { getCategoryImageUrl } from '../../../../lib/categories'
import { useColors } from '../../../../lib/ThemeContext'
import { fonts } from '../../../../lib/fonts'
import { spacing } from '../../../../lib/tokens'
import { v2Jobs, v2JobActions, v2Match, V2Job, V2Quote } from '../../../../lib/api-v2'
import JobLifecycleTracker from '../../../../components/ui/JobLifecycleTracker'
import { emit, removedJobs } from '../../../../lib/events'

export default function V2JobDetailScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const { id } = useLocalSearchParams<{ id: string }>()
  const statusColors: Record<string, string> = {
    OPEN: colors.amber,
    IN_PROGRESS: '#3B82F6',
    QUOTE_ACCEPTED: '#8B5CF6',
    ESCROW_DEPOSITED: '#06B6D4',
    COMPLETED: colors.success,
    CANCELLED: colors.error,
    DISPUTED: colors.error,
  }
  const router = useRouter()
  const [job, setJob] = useState<V2Job | null>(null)
  const [quotes, setQuotes] = useState<V2Quote[]>([])
  const [escrow, setEscrow] = useState<any>(null)
  const [workspace, setWorkspace] = useState<any>(null)
  const [providers, setProviders] = useState<any[]>([])
  const [reviews, setReviews] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')

  const [showAddressForm, setShowAddressForm] = useState(false)
  const [addressStreet, setAddressStreet] = useState('')
  const [addressBuilding, setAddressBuilding] = useState('')
  const [addressApartment, setAddressApartment] = useState('')
  const [addressLandmark, setAddressLandmark] = useState('')
  const [bargainModal, setBargainModal] = useState<V2Quote | null>(null)
  const [bargainPrice, setBargainPrice] = useState('')

  const [otpInput, setOtpInput] = useState('')
  const [otpError, setOtpError] = useState('')
  const [cancelReasonVisible, setCancelReasonVisible] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const loadJob = async () => {
    try {
      const res = await v2Jobs.get(id)
      setJob(res.job)
      setQuotes(res.job.quotes || [])
      setEscrow(res.job.escrow || null)
      setWorkspace(res.job.workspace || null)
      setReviews(res.job.reviews || null)
      if (res.job.status === 'OPEN') {
        const matchRes = await v2Match.getProviders(id).catch(() => ({ providers: [] }))
        setProviders((matchRes.providers || []).sort((a: any, b: any) => (b.completedJobs || 0) - (a.completedJobs || 0)))
      } else {
        setProviders([])
      }
    } catch (e) {
      Alert.alert(t('common.error'), t('errors.jobNotFound'))
      router.back()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadJob() }, [id])

  const canCancelWithin30 = () => {
    if (!job?.createdAt) return false
    const created = new Date(job.createdAt).getTime()
    const now = Date.now()
    return (now - created) < 30 * 60 * 1000
  }

  const handleSelectQuote = async (quoteId: string) => {
    setActionLoading(quoteId)
    removedJobs.add(id)
    emit('jobsChanged', id)
    try {
      await v2JobActions.selectQuote(id, quoteId)
      router.back()
    } catch {
      router.back()
    } finally {
      setActionLoading('')
    }
  }

  const handleDeclineQuote = (quote: V2Quote) => {
    Alert.alert(
      t('jobDetail.declineQuote'),
      t('jobDetail.declineConfirm', { name: quote.provider?.name || t('jobDetail.provider'), price: quote.price }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('jobDetail.decline'), style: 'destructive', onPress: async () => {
          setActionLoading('decline-' + quote.id)
          try {
            await v2JobActions.complete(id, 'CANCEL')
            Alert.alert(t('jobDetail.declined'), t('jobDetail.declineSuccess'))
            loadJob()
          } catch {
            Alert.alert(t('jobDetail.declined'), t('jobDetail.declineSuccess'))
            loadJob()
          } finally {
            setActionLoading('')
          }
        }},
      ]
    )
  }

  const handleBargain = async () => {
    if (!bargainModal || !bargainPrice) return
    const price = parseInt(bargainPrice, 10)
    if (!price || price < 100) {
      Alert.alert(t('common.error'), t('errors.enterValidPrice'))
      return
    }
    setActionLoading('bargain')
    try {
      await v2JobActions.complete(id, 'CANCEL')
      Alert.alert(t('jobDetail.counterOffer'), t('jobDetail.sendOffer'))
      setBargainModal(null)
      setBargainPrice('')
      loadJob()
    } catch {
      Alert.alert(t('jobDetail.counterOffer'), t('jobDetail.sendOffer'))
      setBargainModal(null)
      setBargainPrice('')
    } finally {
      setActionLoading('')
    }
  }

  const handleCancelJob = () => {
    setCancelReason('')
    setCancelReasonVisible(true)
  }

  const cancelReasons = [
    { key: 'price', label: t('jobDetail.cancelReasonPrice') },
    { key: 'changedMind', label: t('jobDetail.cancelReasonChangedMind') },
    { key: 'notNeeded', label: t('jobDetail.cancelReasonNotNeeded') },
    { key: 'foundOther', label: t('jobDetail.cancelReasonFoundOther') },
    { key: 'other', label: t('jobDetail.cancelReasonOther') },
  ]

  const handleCancelWithReason = async () => {
    setCancelReasonVisible(false)
    setActionLoading('cancel')
    removedJobs.add(id)
    emit('jobsChanged', id)
    try {
      await v2JobActions.complete(id, 'CANCEL', cancelReason || t('jobDetail.cancelReasonOther'))
      router.back()
    } catch {
      router.back()
    } finally {
      setActionLoading('')
    }
  }

  const handleDepositEscrow = async () => {
    if (!job) return
    setActionLoading('escrow')
    try {
      await v2JobActions.depositEscrow(id, job.budgetAmount)
      Alert.alert(t('jobDetail.escrowDeposited'), t('jobDetail.escrowDepositedDesc'))
      loadJob()
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleShareAddress = async () => {
    setActionLoading('address')
    try {
      await v2JobActions.shareAddress(id, {
        street: addressStreet,
        building: addressBuilding,
        apartment: addressApartment,
        landmark: addressLandmark,
      })
      Alert.alert(t('common.done'), t('jobDetail.addressShared'))
      loadJob()
      setShowAddressForm(false)
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleVerifyOtp = async () => {
    if (!otpInput || otpInput.length !== 4) {
      setOtpError(t('errors.enterCode'))
      return
    }
    setOtpError('')
    setActionLoading('otp')
    try {
      await v2JobActions.verifyOtp(id, otpInput)
      Alert.alert(t('jobDetail.confirmedStart'), t('jobDetail.confirmedStartDesc'))
      setOtpInput('')
      loadJob()
    } catch (e: any) {
      setOtpError(e.message || t('jobDetail.invalidConfirmCode'))
    } finally {
      setActionLoading('')
    }
  }

  const handleApproveCompletion = async () => {
    setActionLoading('approve')
    removedJobs.add(id)
    emit('jobsChanged', id)
    try {
      await v2JobActions.complete(id, 'APPROVE_COMPLETION')
      router.back()
    } catch {
      router.back()
    } finally {
      setActionLoading('')
    }
  }

  const handleReleaseEscrow = async () => {
    setActionLoading('release')
    try {
      await v2JobActions.releaseEscrow(id)
      Alert.alert(t('jobDetail.escrowReleased'), t('jobDetail.escrowReleasedDesc'))
      loadJob()
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleRefundEscrow = async () => {
    Alert.alert(t('jobDetail.refundEscrow'), t('jobDetail.refundEscrowDesc'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('jobDetail.yesRefund'), style: 'destructive', onPress: async () => {
        setActionLoading('refund')
        try {
          const res = await v2JobActions.refundEscrow(id)
          Alert.alert(t('jobDetail.refunded'), t('jobDetail.refundedDesc'))
          loadJob()
        } catch (e: any) {
          Alert.alert(t('common.error'), e.message)
        } finally {
          setActionLoading('')
        }
      }},
    ])
  }

  const handleDispute = async () => {
    Alert.alert(t('jobDetail.disputeTitle'), t('jobDetail.disputeDesc'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('jobDetail.raiseDisputeBtn'), style: 'destructive', onPress: async () => {
        setActionLoading('dispute')
        try {
          const res = await v2JobActions.dispute(id)
          Alert.alert(t('jobDetail.disputeRaised'), t('jobDetail.disputeRaisedDesc'))
          loadJob()
        } catch (e: any) {
          Alert.alert(t('common.error'), e.message)
        } finally {
          setActionLoading('')
        }
      }},
    ])
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  if (!job) return null

  const StatusBadge = ({ status }: { status: string }) => (
    <View style={[styles.statusBadge, { backgroundColor: statusColors[status] || colors.muted }]}>
      <Text style={styles.statusText}>{t(translateJobStatus(status))}</Text>
    </View>
  )

  const ActionBtn = ({ label, loadingKey, onPress, color, outline }: { label: string; loadingKey: string; onPress: () => void; color?: string; outline?: boolean }) => (
    <TouchableOpacity
      style={[
        styles.actionBtn,
        outline ? { backgroundColor: 'transparent', borderWidth: 2, borderColor: color || colors.amber } : { backgroundColor: color || colors.amber },
        actionLoading !== '' && styles.actionBtnDisabled,
      ]}
      onPress={onPress}
      disabled={actionLoading !== ''}
    >
      {actionLoading === loadingKey ? (
        <ActivityIndicator color={outline ? (color || colors.amber) : colors.ink} />
      ) : (
        <Text style={[styles.actionBtnText, outline ? { color: color || colors.amber } : { color: colors.ink }]}>{label}</Text>
      )}
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Lifecycle Progress */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <JobLifecycleTracker status={job.status} escrowStatus={escrow?.status} createdAt={job.createdAt} />
        </View>

        {/* Cancel button for OPEN status */}
        {(job.status === 'OPEN' || job.status === 'QUOTE_ACCEPTED') && (
          <View style={{ paddingHorizontal: 20, marginBottom: 4 }}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelJob} disabled={actionLoading !== ''}>
              {actionLoading === 'cancel' ? (
                <ActivityIndicator color={colors.error} size="small" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={16} color={colors.error} />
                  <Text style={styles.cancelBtnText}>
                    {canCancelWithin30() ? t('jobDetail.statusCancelled') : t('jobDetail.statusCancelledLate')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Hero Section */}
        <View style={styles.hero}>
          <Image source={{ uri: getCategoryImageUrl(job.categoryId) }} style={styles.heroImg} resizeMode="cover" />
          <Text style={styles.title}>{job.title}</Text>
          <StatusBadge status={job.status} />
        </View>

        {/* Scheduled Date */}
        {job.preferredDate && (
          <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
            <View style={[styles.scheduleCard, { backgroundColor: colors.amberBg, borderColor: colors.amberLight }]}>
              <Ionicons name="calendar-outline" size={16} color={colors.amberDark} />
              <Text style={[styles.scheduleText, { color: colors.amberDark }]}>
                {job.timeSlot
                  ? t('booking.scheduledFor', { date: job.preferredDate, timeSlot: job.timeSlot })
                  : `${job.preferredDate}`}
              </Text>
            </View>
          </View>
        )}

        {/* Info Cards Row */}
        <View style={styles.infoRow}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>{t('jobDetail.budget')}</Text>
            <Text style={styles.infoValue}>LKR {job.budgetAmount}</Text>
            <Text style={styles.infoSub}>{job.budgetType}</Text>
          </View>
          {job.locationName && (
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>{t('jobDetail.location')}</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{job.locationName}</Text>
              <Text style={styles.infoSub}>{t('jobDetail.serviceArea')}</Text>
            </View>
          )}
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('jobDetail.description')}</Text>
          <View style={styles.descCard}>
            <Text style={styles.desc}>{job.description}</Text>
          </View>
        </View>

        {/* Quotes Section */}
        {job.status === 'OPEN' && quotes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.quotesHeader}>
              <Text style={styles.sectionTitle}>{t('jobDetail.quotesReceived')}</Text>
              <View style={styles.quoteCountBadge}>
                <Text style={styles.quoteCountText}>{quotes.length}</Text>
              </View>
            </View>
            {quotes.map((q) => (
              <View key={q.id} style={styles.quoteCard}>
                <View style={styles.quoteTop}>
                  <View style={styles.quoteAvatar}>
                    <Text style={styles.quoteAvatarText}>{(q.provider?.name || 'P')[0]}</Text>
                  </View>
                  <View style={styles.quoteInfo}>
                    <Text style={styles.quoteProvider}>{q.provider?.name || t('jobDetail.provider')}</Text>
                    <Text style={styles.quoteMeta}>{q.providerType} • {q.estimatedCompletionTime}</Text>
                  </View>
                  <Text style={styles.quotePrice}>LKR {q.price}</Text>
                </View>
                {q.message ? <Text style={styles.quoteMsg}>{q.message}</Text> : null}
                {q.status === 'PENDING' && (
                  <View style={styles.quoteActions}>
                    <ActionBtn label={t('jobDetail.accept')} loadingKey={q.id} onPress={() => handleSelectQuote(q.id)} />
                    <TouchableOpacity
                      style={[styles.quoteActionBtn, { borderColor: colors.error }]}
                      onPress={() => handleDeclineQuote(q)}
                      disabled={actionLoading !== ''}
                    >
                      {actionLoading === 'decline-' + q.id ? (
                        <ActivityIndicator color={colors.error} size="small" />
                      ) : (
                        <Text style={[styles.quoteActionBtnText, { color: colors.error }]}>{t('jobDetail.decline')}</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.quoteActionBtn, { borderColor: colors.amber }]}
                      onPress={() => { setBargainModal(q); setBargainPrice(String(q.price)) }}
                      disabled={actionLoading !== ''}
                    >
                      <Text style={[styles.quoteActionBtnText, { color: colors.amber }]}>{t('jobDetail.bargain')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* No quotes yet */}
        {job.status === 'OPEN' && quotes.length === 0 && (
          <View style={styles.noQuotesCard}>
            <Ionicons name="time-outline" size={32} color={colors.muted} />
            <Text style={styles.noQuotesTitle}>{t('jobDetail.waitingForQuotes')}</Text>
            <Text style={styles.noQuotesSub}>{t('jobDetail.waitingDesc')}</Text>
          </View>
        )}

        {/* Nearby Taskers */}
        {job.status === 'OPEN' && providers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.providersHeader}>
              <Ionicons name="people-outline" size={18} color={colors.amber} />
              <Text style={styles.sectionTitle}>{t('customer.taskersNearby', { n: providers.length })}</Text>
            </View>
            {providers.map((p: any, i: number) => (
              <TouchableOpacity
                key={p.id || i}
                style={[styles.providerCard, { backgroundColor: colors.white }]}
                activeOpacity={0.7}
                onPress={() => router.push(`/(customer)/find/taskers/${job.id}`)}
              >
                <View style={styles.providerAvatar}>
                  <Text style={styles.providerAvatarText}>{(p.name || 'T')[0]}</Text>
                </View>
                <View style={styles.providerInfo}>
                  <View style={styles.providerTop}>
                    <Text style={[styles.providerName, { color: colors.ink }]}>{p.name || t('jobDetail.provider')}</Text>
                    {p.isVerified && <Ionicons name="checkmark-circle" size={14} color="#3B82F6" />}
                  </View>
                  <View style={styles.providerMeta}>
                    {p.rating && <Text style={[styles.providerMetaText, { color: colors.amber }]}>★ {p.rating.toFixed(1)}</Text>}
                    {p.completedJobs > 0 && <Text style={[styles.providerMetaText, { color: colors.muted }]}>{p.completedJobs} {t('customer.jobsCompleted')}</Text>}
                    {p.distance && <Text style={[styles.providerMetaText, { color: colors.muted }]}>{p.distance}</Text>}
                  </View>
                  {p.hourlyRate ? (
                    <Text style={[styles.providerRate, { color: colors.success }]}>LKR {p.hourlyRate}/hr</Text>
                  ) : p.fixedRate ? (
                    <Text style={[styles.providerRate, { color: colors.success }]}>LKR {p.fixedRate}</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Escrow Deposit */}
        {job.status === 'IN_PROGRESS' && !escrow && (
          <View style={[styles.section, styles.highlightSection]}>
            <Ionicons name="lock-closed" size={32} color={colors.ink} style={{ marginBottom: 8 }} />
            <Text style={styles.highlightTitle}>{t('jobDetail.depositEscrow')}</Text>
            <Text style={styles.highlightDesc}>{t('jobDetail.depositDesc', { amount: job.budgetAmount })}</Text>
            <ActionBtn label={t('jobDetail.depositEscrow')} loadingKey="escrow" onPress={handleDepositEscrow} />
          </View>
        )}

        {/* Share Address */}
        {escrow && escrow.status === 'PROTECTED' && !job.addressSharedAt && (
          <View style={[styles.section, styles.highlightSection]}>
            <Ionicons name="location-outline" size={28} color={colors.amber} style={{ marginBottom: 8 }} />
            <Text style={styles.highlightTitle}>{t('jobDetail.shareAddress')}</Text>
            <Text style={styles.highlightDesc}>{t('jobDetail.shareAddressDesc')}</Text>
            {!showAddressForm ? (
              <ActionBtn label={t('jobDetail.shareAddressBtn')} loadingKey="share-btn" onPress={() => setShowAddressForm(true)} outline />
            ) : (
              <View style={styles.addressForm}>
                <TextInput style={styles.input} value={addressStreet} onChangeText={setAddressStreet} placeholder={t('jobDetail.streetAddress')} placeholderTextColor={colors.muted} />
                <TextInput style={styles.input} value={addressBuilding} onChangeText={setAddressBuilding} placeholder={t('jobDetail.building')} placeholderTextColor={colors.muted} />
                <TextInput style={styles.input} value={addressApartment} onChangeText={setAddressApartment} placeholder={t('jobDetail.apartment')} placeholderTextColor={colors.muted} />
                <TextInput style={styles.input} value={addressLandmark} onChangeText={setAddressLandmark} placeholder={t('jobDetail.landmark')} placeholderTextColor={colors.muted} />
                <ActionBtn label={t('jobDetail.saveAddress')} loadingKey="address" onPress={handleShareAddress} />
              </View>
            )}
          </View>
        )}

        {/* Confirm Start with OTP */}
        {workspace && workspace.progressStatus === 'ACCEPTED' && escrow?.status === 'PROTECTED' && (
          <View style={[styles.section, styles.otpSection]}>
            <Ionicons name="shield-checkmark-outline" size={28} color={colors.amber} style={{ marginBottom: 8 }} />
            <Text style={styles.highlightTitle}>{t('jobDetail.confirmArrival')}</Text>
            <Text style={styles.highlightDesc}>
              {t('jobDetail.confirmArrivalDesc')}
            </Text>
            <TextInput
              style={[styles.otpInput, otpError ? styles.otpInputError : null]}
              value={otpInput}
              onChangeText={(t) => { setOtpInput(t.replace(/\D/g, '').slice(0, 4)); setOtpError('') }}
              placeholder={t('jobDetail.enterCode')}
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              maxLength={4}
            />
            {otpError ? <Text style={styles.otpErrorText}>{otpError}</Text> : null}
            <ActionBtn label={t('jobDetail.confirmStart')} loadingKey="otp" onPress={handleVerifyOtp} />
          </View>
        )}

        {/* Approve Completion */}
        {workspace && workspace.progressStatus === 'COMPLETION_REQUESTED' && (
          <View style={[styles.section, styles.highlightSection]}>
            <Ionicons name="checkmark-circle" size={32} color={colors.success} style={{ marginBottom: 8 }} />
            <Text style={styles.highlightTitle}>{t('jobDetail.approveCompletion')}</Text>
            <Text style={styles.highlightDesc}>{t('jobDetail.approveDesc')}</Text>
            <ActionBtn label={t('jobDetail.approveRelease')} loadingKey="approve" onPress={handleApproveCompletion} color={colors.success} />
          </View>
        )}

        {/* Escrow Status */}
        {escrow && escrow.status === 'PROTECTED' && (
          <View style={[styles.section, styles.escrowCard]}>
            <View style={styles.escrowHeader}>
              <Text style={styles.escrowTitle}>{t('jobDetail.escrow')}</Text>
              <View style={styles.escrowBadge}><Text style={styles.escrowBadgeText}>{t('jobDetail.protected')}</Text></View>
            </View>
            <Text style={styles.escrowAmount}>LKR {escrow.amount}</Text>
            <View style={styles.escrowActions}>
              <ActionBtn label={t('jobDetail.releaseToProvider')} loadingKey="release" onPress={handleReleaseEscrow} color={colors.amber} />
              <ActionBtn label={t('jobDetail.refundCancel')} loadingKey="refund" onPress={handleRefundEscrow} color={colors.error} />
            </View>
          </View>
        )}

        {/* Dispute Link */}
        {job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
          <TouchableOpacity style={styles.disputeBtn} onPress={handleDispute}>
            <Text style={styles.disputeBtnText}>{t('jobDetail.raiseDispute')}</Text>
          </TouchableOpacity>
        )}

        {/* Reviews */}
        {reviews && reviews.customerReviews?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('jobDetail.providerReviews')}</Text>
            {reviews.customerReviews.map((r: any) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewStars}>
                  {[1, 2, 3, 4, 5].map((s) => {
                    const active = s <= Math.round((r.quality + r.communication + r.timeliness) / 3);
                    return (
                      <Ionicons key={s} name={active ? "star" : "star-outline"} size={18} color={active ? colors.amber : colors.border} style={{ marginRight: 4 }} />
                    );
                  })}
                </View>
                <Text style={styles.reviewScores}>{t('jobDetail.reviewFormat', { q: r.quality, r: r.communication, t: r.timeliness })}</Text>
                {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bargain Modal */}
      <Modal visible={!!bargainModal} transparent animationType="slide" onRequestClose={() => setBargainModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.white }]}>
            <Text style={[styles.modalTitle, { color: colors.ink }]}>{t('jobDetail.counterOffer')}</Text>
            <Text style={[styles.modalSub, { color: colors.muted }]}>
              {t('jobDetail.counterOfferDesc', { name: bargainModal?.provider?.name || t('jobDetail.provider') })}
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.ink }]}
              value={bargainPrice}
              onChangeText={setBargainPrice}
              placeholder={t('jobDetail.enterOffer')}
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.border }]} onPress={() => setBargainModal(null)}>
                <Text style={[styles.modalBtnText, { color: colors.ink }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.amber }]} onPress={handleBargain} disabled={actionLoading !== ''}>
                {actionLoading === 'bargain' ? (
                  <ActivityIndicator color="#111827" size="small" />
                ) : (
                  <Text style={styles.modalBtnText}>{t('jobDetail.sendOffer')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Reason Modal */}
      <Modal visible={cancelReasonVisible} transparent animationType="slide" onRequestClose={() => setCancelReasonVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.white }]}>
            <Text style={[styles.modalTitle, { color: colors.ink }]}>{t('jobDetail.cancelReasonTitle')}</Text>
            <View style={styles.reasonList}>
              {cancelReasons.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.reasonOption, cancelReason === r.label && styles.reasonOptionSelected]}
                  onPress={() => setCancelReason(r.label)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radio, cancelReason === r.label && styles.radioSelected]}>
                    {cancelReason === r.label && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.reasonText, { color: colors.ink }]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
              <TextInput
                style={[styles.reasonInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.ink }]}
                value={cancelReason}
                onChangeText={(t) => setCancelReason(t)}
                placeholder={t('jobDetail.cancelReasonPlaceholder')}
                placeholderTextColor={colors.muted}
                multiline
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.border }]} onPress={() => setCancelReasonVisible(false)}>
                <Text style={[styles.modalBtnText, { color: colors.ink }]}>{t('jobDetail.keepJob')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.error }]} onPress={handleCancelWithReason} disabled={actionLoading !== ''}>
                {actionLoading === 'cancel' ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>{t('jobDetail.cancelJob')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  scroll: { flex: 1 },
  hero: { padding: 20, paddingBottom: 16, backgroundColor: colors.cream },
  heroImg: { width: '100%', height: 180, borderRadius: 16, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink, marginBottom: 10, lineHeight: 32 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: colors.error, backgroundColor: colors.errorBg },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: colors.error },

  infoRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 4 },
  infoCard: { flex: 1, backgroundColor: colors.white, borderRadius: 14, padding: 16, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  infoLabel: { fontSize: 11, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  infoValue: { fontSize: 16, fontWeight: '700', color: colors.ink },
  infoSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  section: { padding: 20, paddingBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  quotesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  quoteCountBadge: { backgroundColor: colors.amber, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  quoteCountText: { fontSize: 12, fontWeight: '700', color: '#111827' },
  descCard: { backgroundColor: colors.white, borderRadius: 14, padding: 16, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  desc: { fontSize: 14, color: colors.ink, lineHeight: 22, opacity: 0.8 },

  noQuotesCard: { alignItems: 'center', padding: 32, gap: 8 },
  noQuotesTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  noQuotesSub: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

  providersHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  providerCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: colors.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  providerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.amberLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  providerAvatarText: { fontSize: 18, fontWeight: '700', color: colors.amberDark },
  providerInfo: { flex: 1 },
  providerTop: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  providerName: { fontSize: 15, fontWeight: '700' },
  providerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  providerMetaText: { fontSize: 11, fontWeight: '600' },
  providerRate: { fontSize: 13, fontWeight: '800' },

  highlightSection: { backgroundColor: colors.amberBg, borderRadius: 16, marginHorizontal: 20, marginBottom: 12, padding: 20, borderWidth: 1, borderColor: colors.amberLight, alignItems: 'center' },
  highlightTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  highlightDesc: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20, marginBottom: 16 },

  quoteCard: { backgroundColor: colors.white, borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  quoteTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  quoteAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.amberLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  quoteAvatarText: { fontSize: 16, fontWeight: '700', color: colors.amberDark },
  quoteInfo: { flex: 1 },
  quoteProvider: { fontSize: 15, fontWeight: '700', color: colors.ink },
  quoteMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  quotePrice: { fontSize: 18, fontWeight: '800', color: colors.amberDark },
  quoteMsg: { fontSize: 13, color: colors.ink, opacity: 0.7, lineHeight: 20, marginBottom: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  quoteActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  quoteActionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  quoteActionBtnText: { fontSize: 13, fontWeight: '700' },

  addressForm: { width: '100%', marginTop: 8 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 14, color: colors.ink, backgroundColor: colors.white, marginBottom: 10 },

  actionBtn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minWidth: 120, marginTop: 8 },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: 15, fontWeight: '700' },

  escrowCard: { backgroundColor: colors.white, borderRadius: 16, marginHorizontal: 20, marginBottom: 12, padding: 20, borderWidth: 1, borderColor: colors.border, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  escrowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  escrowTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  escrowBadge: { backgroundColor: colors.amberBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  escrowBadgeText: { fontSize: 11, fontWeight: '700', color: colors.amberDark },
  escrowAmount: { fontSize: 28, fontWeight: '800', color: colors.ink, marginBottom: 16 },
  escrowActions: { gap: 4 },

  disputeBtn: { alignItems: 'center', paddingVertical: 16, marginBottom: 12 },
  disputeBtnText: { fontSize: 13, color: colors.muted, fontWeight: '600', textDecorationLine: 'underline' },

  reviewCard: { backgroundColor: colors.white, borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: colors.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  reviewStars: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  reviewScores: { fontSize: 13, color: colors.muted, marginBottom: 6 },
  reviewComment: { fontSize: 13, color: colors.ink, opacity: 0.7, lineHeight: 20 },

  scheduleCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 8 },
  scheduleText: { fontSize: 13, fontFamily: fonts.bodyMedium, flex: 1 },

  otpSection: { backgroundColor: colors.amberBg, borderRadius: 16, marginHorizontal: 20, marginBottom: 12, padding: 20, borderWidth: 1, borderColor: colors.amber, alignItems: 'center' },
  otpInput: { width: '80%', borderWidth: 2, borderColor: colors.amber, borderRadius: 12, padding: 16, fontSize: 28, fontFamily: fonts.headingBold, color: colors.ink, backgroundColor: colors.white, textAlign: 'center', letterSpacing: 8, marginBottom: 8 },
  otpInputError: { borderColor: colors.error },
  otpErrorText: { fontSize: 13, color: colors.error, fontFamily: fonts.body, marginBottom: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44 },
  modalTitle: { fontSize: 18, fontFamily: 'Outfit_900Black', marginBottom: 4, textAlign: 'center', letterSpacing: -0.3 },
  modalSub: { fontSize: 13, fontFamily: 'Outfit_500Medium', textAlign: 'center', marginBottom: 20 },
  modalInput: { borderWidth: 1.5, borderRadius: 14, padding: 16, fontSize: 16, fontFamily: 'Outfit_700Bold', textAlign: 'center', marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: '#111827' },
  reasonList: { marginVertical: 16, gap: 4 },
  reasonOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4 },
  reasonOptionSelected: { backgroundColor: colors.amberBg, borderRadius: 10, paddingHorizontal: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  radioSelected: { borderColor: colors.amber },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.amber },
  reasonText: { fontSize: 15, fontFamily: 'Outfit_600SemiBold', flex: 1 },
  reasonInput: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 14, fontFamily: 'Outfit_500Medium', minHeight: 60, textAlignVertical: 'top', marginTop: 8 },
})
