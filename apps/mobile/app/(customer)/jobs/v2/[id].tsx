import { useState, useEffect, useRef } from 'react'
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, TextInput, Modal, Animated } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CaretLeft, XCircle, CalendarBlank, MapPin, Lock, ShieldCheck, CheckCircle, Users, CaretRight, Clock, Wallet, Star, Envelope, Wrench, Handshake, WarningCircle, FileText, ChatCircle, Hourglass, Note, Clipboard } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { translateJobStatus } from '../../../../lib/i18n'
import { getCategoryImageUrl } from '../../../../lib/categories'
import { useColors } from '../../../../lib/ThemeContext'
import { fonts } from '../../../../lib/fonts'
import { v2Jobs, v2JobActions, v2Match, V2Job, V2Quote } from '../../../../lib/api-v2'
import JobLifecycleTracker from '../../../../components/ui/JobLifecycleTracker'
import { emit, removedJobs } from '../../../../lib/events'
import NewChatModal from '../../../../components/chat/NewChatModal'

function usePulse() {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start()
  }, [])
  return anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] })
}

function useBounce() {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.spring(anim, { toValue: 1, friction: 3, tension: 80, useNativeDriver: true }),
        Animated.spring(anim, { toValue: 0, friction: 3, tension: 80, useNativeDriver: true }),
        Animated.delay(4000),
      ])
    ).start()
  }, [])
  return anim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] })
}

const statusMeta: Record<string, { icon: any; label: string }> = {
  OPEN: { icon: Envelope, label: 'Open for quotes' },
  IN_PROGRESS: { icon: Wrench, label: 'Work in progress' },
  QUOTE_ACCEPTED: { icon: Handshake, label: 'Quote accepted' },
  ESCROW_DEPOSITED: { icon: Lock, label: 'Payment secured' },
  COMPLETED: { icon: CheckCircle, label: 'All done!' },
  CANCELLED: { icon: XCircle, label: 'Cancelled' },
  DISPUTED: { icon: WarningCircle, label: 'Under review' },
}

export default function V2JobDetailScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const bounceY = useBounce()
  const pulseOpacity = usePulse()

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
  const [msgRecipient, setMsgRecipient] = useState<{ id: string; name: string } | null>(null)
  const [msgPrefill, setMsgPrefill] = useState('')
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
      } else setProviders([])
    } catch { Alert.alert(t('common.error'), t('errors.jobNotFound')); router.back()
    } finally { setLoading(false) }
  }

  useEffect(() => { loadJob() }, [id])

  const handleSelectQuote = (quoteId: string) => {
    const quote = quotes.find(q => q.id === quoteId)
    if (!quote || !job) return
    router.push({ pathname: '/(customer)/payment/escrow-confirm', params: { bookingId: id, jobTitle: job.title, taskerName: quote.provider?.name || '', quotedAmount: String(quote.price), quoteId } })
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
    try {
      await v2JobActions.cancel(id, { reason: cancelReason || undefined })
      removedJobs.add(id)
      emit('jobsChanged', id)
      router.back()
    } catch (error: any) {
      Alert.alert(
        'Cancellation unavailable',
        error?.message || 'This job can no longer be cancelled. If work already started, use Dispute.',
      )
      await loadJob()
    } finally {
      setActionLoading('')
    }
  }

  const handleDepositEscrow = async () => {
    if (!job) return
    setActionLoading('escrow')
    try { await v2JobActions.depositEscrow(id, job.budgetAmount ?? 0); Alert.alert(t('jobDetail.escrowDeposited'), t('jobDetail.escrowDepositedDesc')); loadJob() }
    catch (e: any) { Alert.alert(t('common.error'), e.message) }
    finally { setActionLoading('') }
  }

  const handleShareAddress = async () => {
    setActionLoading('address')
    try { await v2JobActions.shareAddress(id, { street: addressStreet, building: addressBuilding, apartment: addressApartment, landmark: addressLandmark }); Alert.alert(t('common.done'), t('jobDetail.addressShared')); loadJob(); setShowAddressForm(false) }
    catch (e: any) { Alert.alert(t('common.error'), e.message) }
    finally { setActionLoading('') }
  }

  const handleApproveCompletion = () => {
    if (!job || !escrow) return
    const aq = quotes.find(q => q.status === 'ACCEPTED')
    router.push({ pathname: '/(customer)/payment/confirm-complete', params: { bookingId: id, jobTitle: job.title, taskerName: aq?.provider?.name || '', taskerPayout: String(Number(escrow.amount) - Number(escrow.serviceFee || 0)), platformFee: String(Number(escrow.serviceFee || 0)) } })
  }

  const handleReleaseEscrow = async () => {
    setActionLoading('release')
    try { await v2JobActions.releaseEscrow(id); Alert.alert(t('jobDetail.escrowReleased'), ''); loadJob() }
    catch (e: any) { Alert.alert(t('common.error'), e.message) }
    finally { setActionLoading('') }
  }

  const handleRefundEscrow = async () => {
    Alert.alert(t('jobDetail.refundEscrow'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('jobDetail.yesRefund'), style: 'destructive', onPress: async () => {
        setActionLoading('refund')
        try { await v2JobActions.refundEscrow(id); Alert.alert(t('jobDetail.refunded'), ''); loadJob() }
        catch (e: any) { Alert.alert(t('common.error'), e.message) }
        finally { setActionLoading('') }
      }},
    ])
  }

  const handleDispute = () => {
    const aq = quotes.find(q => q.status === 'ACCEPTED')
    router.push({ pathname: '/(customer)/payment/dispute', params: { bookingId: id, jobTitle: job?.title || '', taskerName: aq?.provider?.name || '' } })
  }

  if (loading) return <SafeAreaView style={styles.container}><ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 60 }} /></SafeAreaView>
  if (!job) return null

  const statusColor = (status: string) => {
    const m: Record<string, string> = { OPEN: colors.amber, IN_PROGRESS: '#3B82F6', QUOTE_ACCEPTED: '#8B5CF6', ESCROW_DEPOSITED: '#06B6D4', COMPLETED: colors.success, CANCELLED: colors.error, DISPUTED: colors.error }
    return m[status] || colors.muted
  }

  const ActionBtn = ({ label, loadingKey, onPress, color, outline }: { label: string; loadingKey: string; onPress: () => void; color?: string; outline?: boolean }) => (
    <TouchableOpacity style={[styles.actionBtn, outline ? { backgroundColor: 'transparent', borderWidth: 2, borderColor: color || colors.amber } : { backgroundColor: color || colors.amber }, actionLoading !== '' && { opacity: 0.5 }]}
      onPress={onPress} disabled={actionLoading !== ''}>
      {actionLoading === loadingKey ? <ActivityIndicator color={outline ? (color || colors.amber) : '#111827'} /> :
        <Text style={[styles.actionBtnText, outline ? { color: color || colors.amber } : { color: '#111827' }]}>{label}</Text>}
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container}>
      {/* ─── App Bar ─── */}
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.appBarBack}>
          <CaretLeft size={20} color={colors.ink} weight="bold" />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Job details</Text>
        <View style={styles.appBarRight}>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarSmallText}>U</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ─── Status Badge ─── */}
        <View style={styles.statusBadgeRow}>
          <Animated.View style={[styles.statusBadge, { backgroundColor: statusColor(job.status) + '22', transform: [{ translateY: bounceY }] }]}>
            {(() => { const SI = statusMeta[job.status]?.icon || Clipboard; return <SI size={12} color={statusColor(job.status)} weight="fill" />; })()}
            <Text style={[styles.statusBadgeText, { color: statusColor(job.status) }]}>
              {(statusMeta[job.status]?.label || t(translateJobStatus(job.status))).toUpperCase()}
            </Text>
          </Animated.View>
        </View>

        {/* ─── Title + Meta ─── */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>{job.title}</Text>
          <View style={styles.metaRow}>
            {job.preferredDate && (
              <View style={styles.metaItem}>
                <CalendarBlank size={12} color="#6F6B6B" weight="fill" />
                <Text style={styles.metaText}>{job.timeSlot ? `${job.preferredDate} · ${job.timeSlot}` : job.preferredDate}</Text>
              </View>
            )}
            {job.locationName && (
              <View style={styles.metaItem}>
                <MapPin size={12} color="#6F6B6B" weight="fill" />
                <Text style={styles.metaText} numberOfLines={1}>{job.locationName}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ─── Lifecycle ─── */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
          <JobLifecycleTracker status={job.status} escrowStatus={escrow?.status} createdAt={job.createdAt} />
        </View>

        {/* ─── Cancel Button ─── */}
        {(job.status === 'OPEN' || job.status === 'QUOTE_ACCEPTED' || (job.status === 'IN_PROGRESS' && workspace?.progressStatus === 'ACCEPTED')) && (
          <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCancelReasonVisible(true)} disabled={actionLoading !== ''}>
              <XCircle size={16} color={colors.error} weight="fill" />
              <Text style={styles.cancelBtnText}>Cancel before work starts</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Professional Card (first accepted quote provider) ─── */}
        {quotes.find(q => q.status === 'ACCEPTED') && (() => {
          const aq = quotes.find(q => q.status === 'ACCEPTED')!
          return (
            <View style={styles.card}>
              <View style={styles.professionalRow}>
                <View style={styles.professionalAvatar}>
                  <Text style={styles.professionalAvatarText}>{(aq.provider?.name || 'P')[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.professionalName}>{aq.provider?.name || 'Provider'}</Text>
                  <View style={styles.professionalMeta}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <Star size={12} color={colors.amber} weight="fill" />
                      <Text style={styles.professionalRating}>{aq.provider?.rating?.toFixed(1) || '—'}</Text>
                    </View>
                    <Text style={styles.professionalDot}>·</Text>
                    <Text style={styles.professionalJobs}>{aq.provider?.completedJobs || 0} jobs</Text>
                  </View>
                </View>
              </View>
            </View>
          )
        })()}

        {/* ─── Job Details Card ─── */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Job details</Text>
          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Wrench size={14} color={colors.amber} weight="fill" />
              <Text style={styles.detailLabel}>Category</Text>
            </View>
            <Text style={styles.detailValue}>{job.categoryName || job.title}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Wallet size={14} color={colors.amber} weight="fill" />
              <Text style={styles.detailLabel}>Budget</Text>
            </View>
            <Text style={styles.detailValue}>LKR {job.budgetAmount?.toLocaleString() ?? 'Not set'}</Text>
          </View>
          <View style={styles.detailDivider} />
          {job.preferredDate && (
            <>
              <View style={styles.detailRow}>
                <View style={styles.detailLeft}>
                  <CalendarBlank size={14} color={colors.amber} weight="fill" />
                  <Text style={styles.detailLabel}>Date</Text>
                </View>
                <Text style={styles.detailValue}>{job.preferredDate}</Text>
              </View>
              <View style={styles.detailDivider} />
            </>
          )}
          {job.timeSlot && (
            <>
              <View style={styles.detailRow}>
                <View style={styles.detailLeft}>
                  <Clock size={14} color={colors.amber} weight="fill" />
                  <Text style={styles.detailLabel}>Time</Text>
                </View>
                <Text style={styles.detailValue}>{job.timeSlot}</Text>
              </View>
              <View style={styles.detailDivider} />
            </>
          )}
          {job.locationName && (
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <MapPin size={14} color={colors.amber} weight="fill" />
                <Text style={styles.detailLabel}>Location</Text>
              </View>
              <Text style={styles.detailValue} numberOfLines={1}>{job.locationName}</Text>
            </View>
          )}
          {job.description ? (
            <>
              <View style={styles.detailDivider} />
              <Text style={styles.detailDesc}>{job.description}</Text>
            </>
          ) : null}
        </View>

        {/* ─── Quotes Section ─── */}
        {job.status === 'OPEN' && quotes.length > 0 && (
          <View style={styles.sectionBlock}>
            {(job as any).aiEstimate && (
              <View style={styles.aiBanner}>
                <WarningCircle size={16} color="#D48900" weight="fill" />
                <Text style={styles.aiBannerText}>
                  AI estimate was {((job as any).aiEstimate.symbol || 'LKR')} {((job as any).aiEstimate.priceRange?.min || 0).toLocaleString()}–{((job as any).aiEstimate.priceRange?.max || 0).toLocaleString()}
                  {((job as any).aiEstimate.materialHandling === 'tasker_brings') ? ' with materials' : ''}. Quotes below show how taskers compare.
                </Text>
              </View>
            )}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Quotes received</Text>
              <View style={styles.quoteCountPill}><Text style={styles.quoteCountText}>{quotes.length}</Text></View>
            </View>
            {quotes.map((q) => {
              const aiEst = (job as any).aiEstimate
              let quoteTag: { label: string; color: string; bg: string } | null = null
              if (aiEst?.priceRange) {
                const price = Number(q.price)
                if (price < aiEst.priceRange.min) {
                  quoteTag = { label: 'Below AI estimate', color: '#065F46', bg: '#DCFCE7' }
                } else if (price > aiEst.priceRange.max) {
                  quoteTag = { label: 'Above AI estimate', color: '#92400E', bg: '#FEF3C7' }
                }
              }
              return (
              <View key={q.id} style={styles.quoteCard}>
                <View style={styles.quoteTop}>
                  <View style={styles.quoteAvatar}>
                    <Text style={styles.quoteAvatarText}>{(q.provider?.name || 'P')[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quoteProviderName}>{q.provider?.name || 'Provider'}</Text>
                    <Text style={styles.quoteProviderMeta}>{q.providerType} · {q.estimatedCompletionTime}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.quotePrice}>LKR {q.price}</Text>
                    {quoteTag && (
                      <View style={[styles.quoteTag, { backgroundColor: quoteTag.bg }]}>
                        <Text style={[styles.quoteTagText, { color: quoteTag.color }]}>{quoteTag.label}</Text>
                      </View>
                    )}
                  </View>
                </View>
                {q.message ? <Text style={styles.quoteMessage}>{q.message}</Text> : null}
                {q.status === 'PENDING' ? (
                  <View style={styles.quoteActions}>
                    <TouchableOpacity style={styles.quoteAcceptBtn} onPress={() => handleSelectQuote(q.id)} disabled={actionLoading !== ''}>
                      {actionLoading === q.id ? <ActivityIndicator color="#111827" size="small" /> : <Text style={styles.quoteAcceptText}>Accept</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quoteBargainBtn}
                      onPress={() => {
                        const recipientId = String((q.provider as any)?.userId || q.provider?.id || q.providerId || '')
                        if (!recipientId) return
                        setMsgPrefill(`Hi ${q.provider?.name || ''}, I want to discuss your LKR ${q.price.toLocaleString()} quote. If we agree on a new price, please send me an updated quote in MaintainEX.`)
                        setMsgRecipient({ id: recipientId, name: q.provider?.name || 'Provider' })
                      }}
                      disabled={actionLoading !== ''}
                    >
                      <Handshake size={14} color={colors.amber} weight="fill" />
                      <Text style={styles.quoteBargainText}>Discuss price</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {q.provider?.id && (
                  <TouchableOpacity
                    style={styles.quoteMessageRow}
                    onPress={() => {
                      setMsgPrefill(`Hi ${q.provider?.name || ''}, I'm interested in your service for "${job?.title || 'this job'}".`)
                      setMsgRecipient({
                        id: String((q.provider as any)?.userId || q.provider.id),
                        name: q.provider.name || 'Provider',
                      })
                    }}
                  >
                    <ChatCircle size={14} color={colors.amber} weight="fill" />
                    <Text style={styles.quoteMessageText}>Message {q.provider?.name || 'provider'}</Text>
                  </TouchableOpacity>
                )}
              </View>
              )
            })}
          </View>
        )}

        {/* ─── No Quotes ─── */}
        {job.status === 'OPEN' && quotes.length === 0 && (
          <View style={styles.emptyState}>
            <Animated.View style={{ opacity: pulseOpacity }}><Hourglass size={48} color={colors.amber} weight="fill" /></Animated.View>
            <Text style={styles.emptyTitle}>Waiting for heroes...</Text>
            <Text style={styles.emptySub}>Providers are reviewing your mission. Hang tight!</Text>
          </View>
        )}

        {/* ─── Nearby Heroes ─── */}
        {job.status === 'OPEN' && providers.length > 0 && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Users size={18} color={colors.amber} weight="fill" />
              <Text style={styles.sectionHeading}>Nearby Heroes ({providers.length})</Text>
            </View>
            {providers.map((p: any, i: number) => (
              <TouchableOpacity key={p.id || i} style={styles.heroCard}
                activeOpacity={0.7} onPress={() => router.push(`/(customer)/find/taskers/${job.id}`)}>
                <View style={styles.heroAvatar}>
                  <Text style={styles.heroAvatarText}>{(p.name || 'T')[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.heroName}>{p.name || 'Tasker'}</Text>
                    {p.isVerified && <CheckCircle size={12} color="#3B82F6" weight="fill" />}
                  </View>
                  <View style={styles.heroMeta}>
                    {p.rating ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}><Star size={10} color={colors.amber} weight="fill" /><Text style={styles.heroMetaText}> {p.rating.toFixed(1)}</Text></View> : null}
                    {p.completedJobs > 0 && <Text style={styles.heroMetaText}>{p.completedJobs} jobs</Text>}
                    {p.distance && <Text style={styles.heroMetaText}>{p.distance}</Text>}
                  </View>
                  {p.hourlyRate ? <Text style={styles.heroRate}>LKR {p.hourlyRate}/hr</Text> : p.fixedRate ? <Text style={styles.heroRate}>LKR {p.fixedRate}</Text> : null}
                </View>
                <TouchableOpacity
                  hitSlop={8}
                  onPress={() => {
                    setMsgPrefill(`Hi ${p.name || ''}, I saw your profile for "${job?.title || 'this job'}". Are you available?`)
                    setMsgRecipient({ id: p.id, name: p.name || 'Tasker' })
                  }}
                  style={styles.heroMsgBtn}
                >
                  <ChatCircle size={16} color={colors.amber} weight="fill" />
                </TouchableOpacity>
                <CaretRight size={16} color={colors.muted} weight="bold" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ─── Action Cards ─── */}
        {(job.status === 'QUOTE_ACCEPTED' && escrow?.status === 'PENDING_PAYMENT') || (job.status === 'IN_PROGRESS' && !escrow) ? (
          <View style={styles.actionCard}>
            <View style={styles.actionIconCircle}>
              <Lock size={28} color={colors.ink} weight="fill" />
            </View>
            <Text style={styles.actionCardTitle}>Fund Escrow</Text>
            <Text style={styles.actionCardDesc}>
              Deposit LKR {escrow?.amount || job.budgetAmount} into escrow to start the work
              {escrow?.createdAt ? ` — fund within 24 hours or the job will reopen` : ''}
            </Text>
            <ActionBtn label="Deposit Now" loadingKey="escrow" onPress={handleDepositEscrow} />
          </View>
        ) : null}

        {escrow && escrow.status === 'PROTECTED' && !job.addressSharedAt && (
          <View style={styles.actionCard}>
            <View style={styles.actionIconCircle}>
              <MapPin size={28} color={colors.amber} weight="fill" />
            </View>
            <Text style={styles.actionCardTitle}>Share Address</Text>
            <Text style={styles.actionCardDesc}>Let your hero know where to go</Text>
            {!showAddressForm ? (
              <ActionBtn label="Share Address" loadingKey="share-btn" onPress={() => setShowAddressForm(true)} outline />
            ) : (
              <View style={styles.addressForm}>
                <TextInput style={styles.inputField} value={addressStreet} onChangeText={setAddressStreet} placeholder="Street" placeholderTextColor="#6F6B6B" />
                <TextInput style={styles.inputField} value={addressBuilding} onChangeText={setAddressBuilding} placeholder="Building" placeholderTextColor="#6F6B6B" />
                <TextInput style={styles.inputField} value={addressApartment} onChangeText={setAddressApartment} placeholder="Apartment" placeholderTextColor="#6F6B6B" />
                <TextInput style={styles.inputField} value={addressLandmark} onChangeText={setAddressLandmark} placeholder="Landmark" placeholderTextColor="#6F6B6B" />
                <ActionBtn label="Save" loadingKey="address" onPress={handleShareAddress} />
              </View>
            )}
          </View>
        )}

        {workspace?.progressStatus === 'ACCEPTED' && escrow?.status === 'PROTECTED' && (
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push(`/(customer)/jobs/v2/${id}/pin`)}
          >
            <View style={styles.actionIconCircle}>
              <ShieldCheck size={28} color={colors.amber} weight="fill" />
            </View>
            <Text style={styles.actionCardTitle}>Confirm Arrival</Text>
            <Text style={styles.actionCardDesc}>Enter the verification PIN from your hero</Text>
            <ActionBtn label="Verify PIN" loadingKey="" onPress={() => router.push(`/(customer)/jobs/v2/${id}/pin`)} />
          </TouchableOpacity>
        )}

        {workspace?.progressStatus === 'COMPLETION_REQUESTED' && (
          <View style={[styles.actionCard, { borderColor: '#06C16744' }]}>
            <View style={[styles.actionIconCircle, { backgroundColor: '#06C16722' }]}>
              <CheckCircle size={28} color="#06C167" weight="fill" />
            </View>
            <Text style={styles.actionCardTitle}>Job Complete?</Text>
            <Text style={styles.actionCardDesc}>Your hero says they're done. Check the work and release payment</Text>
            <ActionBtn label="Approve & Release" loadingKey="approve" onPress={handleApproveCompletion} color="#06C167" />
          </View>
        )}

        {/* ─── Escrow Status Card ─── */}
        {escrow && escrow.status === 'PROTECTED' && (
          <View style={styles.escrowCard}>
            <View style={styles.escrowHeader}>
              <Text style={styles.escrowTitle}>Escrow</Text>
              <View style={styles.escrowBadge}><Text style={styles.escrowBadgeText}>Protected</Text></View>
            </View>
            <Text style={styles.escrowAmount}>LKR {escrow.amount}</Text>
            <View style={styles.escrowActions}>
              <ActionBtn label="Release to Hero" loadingKey="release" onPress={handleReleaseEscrow} color={colors.amber} />
              <ActionBtn label="Refund & Cancel" loadingKey="refund" onPress={handleRefundEscrow} color={colors.error} />
            </View>
          </View>
        )}

        {/* ─── Dispute ─── */}
        {job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
          <TouchableOpacity style={styles.linkBtn} onPress={handleDispute}>
            <Text style={styles.linkBtnText}>Raise a Dispute</Text>
          </TouchableOpacity>
        )}

        {/* ─── Job PIN ─── */}
        {(job.status === 'QUOTE_ACCEPTED' || job.status === 'IN_PROGRESS') && (
          <TouchableOpacity
            style={[styles.linkBtn, { borderColor: colors.amber }]}
            onPress={() => router.push(`/(customer)/jobs/v2/${id}/pin`)}
          >
            <ShieldCheck size={16} color={colors.amber} />
            <Text style={[styles.linkBtnText, { color: colors.amber, marginLeft: 8 }]}>Job Verification PIN</Text>
          </TouchableOpacity>
        )}

        {/* ─── Reviews ─── */}
        {reviews?.customerReviews?.length > 0 && (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>Reviews</Text>
            {reviews.customerReviews.map((r: any) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewStars}>
                  {[1, 2, 3, 4, 5].map((s) => {
                    const active = s <= Math.round((r.quality + r.communication + r.timeliness) / 3)
                    return <Star key={s} size={16} color={active ? colors.amber : '#2E2E2E'} weight={active ? 'fill' : 'regular'} style={{ marginRight: 2 }} />
                  })}
                </View>
                <Text style={styles.reviewScores}>Quality: {r.quality} · Communication: {r.communication} · Timeliness: {r.timeliness}</Text>
                {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ─── Cancel Reason Modal ─── */}
      <Modal visible={cancelReasonVisible} transparent animationType="slide" onRequestClose={() => setCancelReasonVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={[styles.modalIconCircle, { backgroundColor: '#E1190022' }]}>
              <XCircle size={32} color="#E11900" weight="fill" />
            </View>
            <Text style={styles.modalTitle}>Cancel Mission</Text>
            <View style={styles.reasonList}>
              {cancelReasons.map((r) => (
                <TouchableOpacity key={r.key} style={[styles.reasonOption, cancelReason === r.label && { backgroundColor: colors.amberBg }]}
                  onPress={() => setCancelReason(r.label)} activeOpacity={0.7}>
                  <View style={[styles.radio, { borderColor: '#2E2E2E' }, cancelReason === r.label && { borderColor: colors.amber }]}>
                    {cancelReason === r.label && <View style={[styles.radioDot, { backgroundColor: colors.amber }]} />}
                  </View>
                  <Text style={styles.reasonText}>{r.label}</Text>
                </TouchableOpacity>
              ))}
              <TextInput style={styles.reasonInput}
                value={cancelReason} onChangeText={setCancelReason} placeholder="Other reason..." placeholderTextColor="#6F6B6B" multiline />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setCancelReasonVisible(false)}>
                <Text style={styles.modalCancelText}>Keep Job</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, { backgroundColor: '#E11900' }]} onPress={handleCancelWithReason} disabled={actionLoading !== ''}>
                {actionLoading === 'cancel' ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={[styles.modalConfirmText, { color: '#FFFFFF' }]}>Cancel</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <NewChatModal
        visible={!!msgRecipient}
        onClose={() => setMsgRecipient(null)}
        recipient={msgRecipient}
        jobId={id}
        jobTitle={job?.title}
        prefilled={msgPrefill}
      />
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  scroll: { flex: 1 },

  appBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  appBarBack: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  appBarTitle: { fontSize: 13, fontFamily: fonts.headingBold, color: '#FFFFFF', textAlign: 'center', flex: 1 },
  appBarRight: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  avatarSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2E2E2E', alignItems: 'center', justifyContent: 'center' },
  avatarSmallText: { fontSize: 13, fontFamily: fonts.headingBold, color: '#F5A623' },

  statusBadgeRow: { paddingHorizontal: 16, marginBottom: 6 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  statusBadgeText: { fontSize: 10, fontFamily: fonts.headingBold, letterSpacing: 0.8 },

  titleSection: { paddingHorizontal: 16, marginBottom: 10 },
  title: { fontSize: 25, fontFamily: fonts.heading, color: '#FFFFFF', lineHeight: 32, letterSpacing: -0.5, marginBottom: 6 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 10, fontFamily: fonts.bodyMedium, color: '#6F6B6B' },

  card: { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginBottom: 12, borderRadius: 18, padding: 16 },
  cardHeading: { fontSize: 14, fontFamily: fonts.headingBold, color: '#000000', marginBottom: 12 },

  professionalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  professionalAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(245,166,35,0.14)', alignItems: 'center', justifyContent: 'center' },
  professionalAvatarText: { fontSize: 18, fontFamily: fonts.headingBold, color: '#F5A623' },
  professionalName: { fontSize: 15, fontFamily: fonts.headingBold, color: '#000000' },
  professionalMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  professionalRating: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#F5A623' },
  professionalDot: { fontSize: 12, color: '#6F6B6B' },
  professionalJobs: { fontSize: 12, fontFamily: fonts.body, color: '#6F6B6B' },

  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  detailLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  detailLabel: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#6F6B6B' },
  detailValue: { fontSize: 13, fontFamily: fonts.headingBold, color: '#000000', textAlign: 'right', flex: 1, marginLeft: 8 },
  detailDivider: { height: 1, backgroundColor: '#2E2E2E' },
  detailDesc: { fontSize: 13, fontFamily: fonts.body, color: '#000000', lineHeight: 20, marginTop: 10, opacity: 0.8 },

  sectionBlock: { paddingHorizontal: 16, marginBottom: 8 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionHeading: { fontSize: 17, fontFamily: fonts.heading, color: '#FFFFFF' },

  quoteCountPill: { backgroundColor: '#F5A623', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  quoteCountText: { fontSize: 11, fontFamily: fonts.headingBold, color: '#111827' },

  quoteCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 10 },
  quoteTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  quoteAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(245,166,35,0.14)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  quoteAvatarText: { fontSize: 15, fontFamily: fonts.headingBold, color: '#F5A623' },
  quoteProviderName: { fontSize: 14, fontFamily: fonts.headingBold, color: '#000000' },
  quoteProviderMeta: { fontSize: 11, fontFamily: fonts.body, color: '#6F6B6B', marginTop: 2 },
  quotePrice: { fontSize: 17, fontFamily: fonts.heading, color: '#F5A623', letterSpacing: -0.3 },
  quoteTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  quoteTagText: { fontSize: 10, fontFamily: fonts.bodyMedium },
  quoteMessage: { fontSize: 12, fontFamily: fonts.body, color: '#000000', opacity: 0.65, lineHeight: 18, marginBottom: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#2E2E2E' },
  quoteActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  quoteAcceptBtn: { flex: 1, paddingVertical: 11, borderRadius: 14, backgroundColor: '#F5A623', alignItems: 'center', justifyContent: 'center' },
  quoteAcceptText: { fontSize: 13, fontFamily: fonts.headingBold, color: '#111827' },
  quoteBargainBtn: { flex: 1, paddingVertical: 11, borderRadius: 14, borderWidth: 1.5, borderColor: '#F5A623', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  quoteBargainText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: '#F5A623' },
  quoteMessageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: '#2E2E2E' },
  quoteMessageText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#000000' },

  emptyState: { alignItems: 'center', padding: 40, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: fonts.heading, color: '#FFFFFF' },
  emptySub: { fontSize: 13, fontFamily: fonts.body, color: '#6F6B6B', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

  heroCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, marginBottom: 10 },
  heroAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(245,166,35,0.14)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  heroAvatarText: { fontSize: 16, fontFamily: fonts.headingBold, color: '#F5A623' },
  heroName: { fontSize: 14, fontFamily: fonts.headingBold, color: '#000000' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  heroMetaText: { fontSize: 11, fontFamily: fonts.bodyMedium, color: '#6F6B6B' },
  heroRate: { fontSize: 13, fontFamily: fonts.headingBold, color: '#06C167', marginTop: 2 },
  heroMsgBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(245,166,35,0.14)', alignItems: 'center', justifyContent: 'center', marginRight: 4 },

  actionCard: { backgroundColor: 'rgba(245,166,35,0.12)', marginHorizontal: 16, marginBottom: 12, borderRadius: 18, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(245,166,35,0.2)' },
  actionIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(245,166,35,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionCardTitle: { fontSize: 17, fontFamily: fonts.headingBold, color: '#FFFFFF', marginBottom: 4, marginTop: 2 },
  actionCardDesc: { fontSize: 12, fontFamily: fonts.body, color: '#6F6B6B', textAlign: 'center', lineHeight: 18, marginBottom: 16 },

  addressForm: { width: '100%', marginTop: 8 },
  inputField: { borderWidth: 1.5, borderRadius: 14, padding: 13, fontSize: 14, fontFamily: fonts.body, color: '#000000', backgroundColor: '#FFFFFF', borderColor: '#2E2E2E', marginBottom: 10 },

  escrowCard: { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginBottom: 12, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#2E2E2E' },
  escrowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  escrowTitle: { fontSize: 15, fontFamily: fonts.headingBold, color: '#000000' },
  escrowBadge: { backgroundColor: 'rgba(245,166,35,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  escrowBadgeText: { fontSize: 10, fontFamily: fonts.bodyMedium, color: '#F5A623' },
  escrowAmount: { fontSize: 26, fontFamily: fonts.heading, color: '#000000', letterSpacing: -1, marginBottom: 16 },
  escrowActions: { gap: 4 },

  linkBtn: { alignItems: 'center', paddingVertical: 16, marginBottom: 4, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  linkBtnText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: '#6F6B6B' },

  reviewCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 10 },
  reviewStars: { flexDirection: 'row', gap: 2, marginBottom: 8 },
  reviewScores: { fontSize: 12, fontFamily: fonts.body, color: '#6F6B6B', marginBottom: 6 },
  reviewComment: { fontSize: 12, fontFamily: fonts.body, color: '#000000', opacity: 0.65, lineHeight: 18 },

  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 14, borderWidth: 1.5, borderColor: '#E11900', backgroundColor: '#E1190014' },
  cancelBtnText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#E11900' },

  actionBtn: { paddingVertical: 13, paddingHorizontal: 24, borderRadius: 16, alignItems: 'center', justifyContent: 'center', minWidth: 120, marginTop: 8 },
  actionBtnText: { fontSize: 14, fontFamily: fonts.headingBold },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#2E2E2E', alignSelf: 'center', marginBottom: 20 },
  modalIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(245,166,35,0.12)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 19, fontFamily: fonts.heading, color: '#000000', textAlign: 'center', marginBottom: 4 },
  modalSub: { fontSize: 12, fontFamily: fonts.body, color: '#6F6B6B', textAlign: 'center', marginBottom: 20 },
  modalInput: { borderWidth: 1.5, borderRadius: 14, padding: 15, fontSize: 16, fontFamily: fonts.headingBold, textAlign: 'center', color: '#000000', backgroundColor: '#F5F5F5', borderColor: '#2E2E2E', marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: '#2E2E2E' },
  modalCancelText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: '#FFFFFF' },
  modalConfirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: '#F5A623' },
  modalConfirmText: { fontSize: 14, fontFamily: fonts.headingBold, color: '#111827' },

  reasonList: { marginVertical: 16, gap: 2 },
  reasonOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  reasonText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: '#000000', flex: 1 },
  reasonInput: { borderWidth: 1.5, borderRadius: 14, padding: 13, fontSize: 13, fontFamily: fonts.body, color: '#000000', backgroundColor: '#F5F5F5', borderColor: '#2E2E2E', minHeight: 56, textAlignVertical: 'top', marginTop: 8 },

  aiBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1.5, marginBottom: 12, backgroundColor: '#FFFBEB', borderColor: '#FCD34D' },
  aiBannerText: { fontSize: 12, fontFamily: fonts.bodyMedium, flex: 1, lineHeight: 17, color: '#92400E' },
})
