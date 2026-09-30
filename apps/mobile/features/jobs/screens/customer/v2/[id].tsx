import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, TextInput, Modal, Animated } from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { XCircle, CalendarBlank, MapPin, Lock, ShieldCheck, CheckCircle, Users, CaretRight, Clock, Wallet, Star, Envelope, Wrench, Handshake, WarningCircle, FileText, ChatCircle, Hourglass, Note, Clipboard } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { translateJobStatus } from '@/lib/i18n'
import { getCategoryImageUrl } from '@/lib/categories'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { v2Jobs, v2JobActions, v2Match } from '@/api/v2-jobs'
import { V2Job, V2Quote } from '@/api/v2-types'
import JobLifecycleTracker from '@/components/ui/JobLifecycleTracker'
import { emit, removedJobs } from '@/lib/events'
import NewChatModal from '@/features/messaging/components/NewChatModal'

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
  const [bargainModal, setBargainModal] = useState<V2Quote | null>(null)
  const [msgRecipient, setMsgRecipient] = useState<{ id: string; name: string } | null>(null)
  const [msgPrefill, setMsgPrefill] = useState('')
  const [bargainPrice, setBargainPrice] = useState('')
  const [cancelReasonVisible, setCancelReasonVisible] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const currencyCode = job?.countryCode === 'CA' ? 'CAD' : 'LKR'

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

  useFocusEffect(
    useCallback(() => {
      loadJob()
    }, [id])
  )

  const handleSelectQuote = (quoteId: string) => {
    const quote = quotes.find(q => q.id === quoteId)
    if (!quote || !job) return
    router.push({ pathname: '/(customer)/payment/escrow-confirm', params: { bookingId: id, jobTitle: job.title, taskerName: quote.provider?.name || '', quotedAmount: String(quote.price), currency: currencyCode, quoteId } })
  }

  const handleBargain = () => {
    if (!bargainModal || !bargainPrice) return
    const price = Number.parseFloat(bargainPrice)
    if (!Number.isFinite(price) || price < 100) {
      Alert.alert(t('common.error'), t('errors.enterValidPrice'))
      return
    }

    const contactUserId = bargainModal.providerType === 'COMPANY'
      ? bargainModal.provider?.userId
      : bargainModal.providerId

    if (!contactUserId) {
      Alert.alert(t('common.error'), 'Provider chat is not available for this quote.')
      return
    }

    setMsgRecipient({
      id: contactUserId,
      name: bargainModal.provider?.name || 'Provider',
    })
    setMsgPrefill(
      `Counter offer: ${currencyCode} ${price.toLocaleString()}. If you agree, please revise your quote in MaintainEX so I can accept the updated price.`
    )
    setBargainModal(null)
    setBargainPrice('')
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
      await v2JobActions.complete(id, 'CANCEL', cancelReason || '')
      removedJobs.add(id)
      emit('jobsChanged', id)
      router.back()
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Could not cancel this booking.')
    } finally {
      setActionLoading('')
    }
  }

  const handleDepositEscrow = () => {
    router.push(`/(customer)/jobs/v2/confirm/${id}`)
  }

  const handleCashPayment = () => {
    Alert.alert(
      'Use Cash Payment?',
      'MaintainEX will not hold cash for this booking. Pay the provider directly as agreed after the work. The provider remains responsible for MaintainEX platform commission.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Use Cash',
          onPress: async () => {
            setActionLoading('cash')
            try {
              const result = await v2JobActions.confirmCashPayment(id)
              Alert.alert(
                'Cash Selected',
                `Cash amount due: ${result.currency} ${Number(result.amountDue || 0).toLocaleString()}. Use the verification PIN before work starts.`,
              )
              await loadJob()
            } catch (e: any) {
              Alert.alert(t('common.error'), e?.message || 'Could not select cash payment.')
            } finally {
              setActionLoading('')
            }
          },
        },
      ],
    )
  }

  const handleShareAddress = async () => {
    setActionLoading('address')
    try { await v2JobActions.shareAddress(id, { street: addressStreet, building: addressBuilding, apartment: addressApartment, landmark: addressLandmark }); Alert.alert(t('common.done'), t('jobDetail.addressShared')); loadJob(); setShowAddressForm(false) }
    catch (e: any) { Alert.alert(t('common.error'), e.message) }
    finally { setActionLoading('') }
  }

  const handleApproveCompletion = () => {
    if (!job || !escrow || workspace?.progressStatus !== 'COMPLETION_REQUESTED') return
    const aq = quotes.find(q => q.status === 'ACCEPTED')
    router.push({
      pathname: '/(customer)/payment/confirm-complete',
      params: {
        bookingId: id,
        jobTitle: job.title,
        taskerName: aq?.provider?.name || 'Provider',
      },
    })
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
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ─── Lifecycle ─── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
          <JobLifecycleTracker status={job.status} escrowStatus={escrow?.status} createdAt={job.createdAt} />
        </View>

        {/* ─── Cancel Button ─── */}
        {(job.status === 'OPEN' || job.status === 'QUOTE_ACCEPTED') && (
          <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCancelReasonVisible(true)} disabled={actionLoading !== ''}>
              <XCircle size={16} color={colors.error} weight="fill" />
              <Text style={styles.cancelBtnText}>Cancel Booking</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Hero ─── */}
        <View style={styles.hero}>
          <Animated.View style={[styles.statusPill, { backgroundColor: statusColor(job.status), transform: [{ translateY: bounceY }] }]}>
            {(() => { const SI = statusMeta[job.status]?.icon || Clipboard; return <SI size={14} color="#fff" weight="fill" />; })()}
            <Text style={styles.statusPillText}>{statusMeta[job.status]?.label || t(translateJobStatus(job.status))}</Text>
          </Animated.View>
          <Text style={[styles.title, { color: colors.ink }]}>{job.title}</Text>
        </View>

        {/* ─── Scheduled Date ─── */}
        {job.preferredDate && (
          <View style={styles.section}>
            <View style={[styles.scheduleCard, { backgroundColor: colors.amberBg, borderColor: colors.amberLight }]}>
              <CalendarBlank size={18} color={colors.amberDark} weight="fill" />
              <Text style={[styles.scheduleText, { color: colors.amberDark }]}>
                {job.preferredTimeSlot ? `${job.preferredDate} at ${job.preferredTimeSlot}` : job.preferredDate}
              </Text>
            </View>
          </View>
        )}

        {/* ─── Info Cards ─── */}
        <View style={styles.infoRow}>
          <View style={[styles.infoCard, { backgroundColor: colors.white }]}>
            <Wallet size={20} color={colors.amber} weight="fill" />
            <Text style={styles.infoLabel}>Budget</Text>
            <Text style={[styles.infoValue, { color: colors.ink }]}>{currencyCode} {job.budgetAmount?.toLocaleString() ?? 'Not set'}</Text>
            <Text style={[styles.infoSub, { color: colors.muted }]}>{job.budgetType}</Text>
          </View>
          {job.locationName && (
            <View style={[styles.infoCard, { backgroundColor: colors.white }]}>
              <MapPin size={20} color={colors.amber} weight="fill" />
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={[styles.infoValue, { color: colors.ink }]} numberOfLines={1}>{job.locationName}</Text>
              <Text style={[styles.infoSub, { color: colors.muted }]}>Service area</Text>
            </View>
          )}
        </View>

        {/* ─── Description ─── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.ink }]}>Description</Text>
          <View style={[styles.descCard, { backgroundColor: colors.white }]}>
            <Text style={[styles.desc, { color: colors.ink }]}>{job.description}</Text>
          </View>
        </View>

        {/* ─── Quotes ─── */}
        {job.status === 'OPEN' && quotes.length > 0 && (
          <View style={styles.section}>
            {(job as any).aiEstimate && (
              <View style={[styles.aiEstimateBanner, { backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }]}>
                <WarningCircle size={16} color="#D48900" weight="fill" />
                <Text style={[styles.aiEstimateBannerText, { color: '#92400E' }]}>
                  AI estimate was {((job as any).aiEstimate.symbol || 'LKR')} {((job as any).aiEstimate.priceRange?.min || 0).toLocaleString()}–{((job as any).aiEstimate.priceRange?.max || 0).toLocaleString()}
                  {((job as any).aiEstimate.materialHandling === 'tasker_brings') ? ' with materials' : ''}. Quotes below show how taskers compare.
                </Text>
              </View>
            )}
            <View style={styles.quotesHeader}>
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>Quotes Received</Text>
              <View style={styles.quoteCountBadge}><Text style={styles.quoteCountText}>{quotes.length}</Text></View>
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
              <View key={q.id} style={[styles.quoteCard, { backgroundColor: colors.white }]}>
                <View style={styles.quoteTop}>
                  <View style={[styles.quoteAvatar, { backgroundColor: colors.amberLight }]}>
                    <Text style={styles.quoteAvatarText}>{(q.provider?.name || 'P')[0]}</Text>
                  </View>
                  <View style={styles.quoteInfo}>
                    <Text style={[styles.quoteProvider, { color: colors.ink }]}>{q.provider?.name || 'Provider'}</Text>
                    <Text style={[styles.quoteMeta, { color: colors.muted }]}>{q.providerType} • {q.estimatedCompletionTime}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.quotePrice}>{currencyCode} {q.price.toLocaleString()}</Text>
                    {quoteTag && (
                      <View style={[styles.quoteTag, { backgroundColor: quoteTag.bg }]}>
                        <Text style={[styles.quoteTagText, { color: quoteTag.color }]}>{quoteTag.label}</Text>
                      </View>
                    )}
                  </View>
                </View>
                {q.message ? <Text style={[styles.quoteMsg, { color: colors.ink }]}>{q.message}</Text> : null}
                {q.status === 'PENDING' ? (
                  <View style={styles.quoteActions}>
                    <ActionBtn label="Accept" loadingKey={q.id} onPress={() => handleSelectQuote(q.id)} />
<TouchableOpacity style={[styles.quoteActionBtn, { borderColor: colors.amber, flexDirection: 'row' }]}
  onPress={() => { setBargainModal(q); setBargainPrice(String(q.price)) }} disabled={actionLoading !== ''}>
  <Handshake size={14} color={colors.amber} weight="fill" style={{ marginRight: 6 }} />
  <Text style={[styles.quoteActionBtnText, { color: colors.amber }]}>Bargain</Text>
</TouchableOpacity>
                  </View>
                ) : null}
                {q.provider?.id && (
                  <TouchableOpacity
                    style={[styles.messageRow, { borderTopColor: colors.border }]}
                    onPress={() => {
                      setMsgPrefill(`Hi ${q.provider?.name || ''}, I'm interested in your service for "${job?.title || 'this job'}".`)
                      setMsgRecipient({ id: q.provider.id, name: q.provider.name || 'Provider' })
                    }}
                  >
                    <ChatCircle size={16} color={colors.amber} weight="fill" />
                    <Text style={[styles.messageRowText, { color: colors.ink }]}>Message {q.provider?.name || 'provider'}</Text>
                  </TouchableOpacity>
                )}
              </View>
              )
            })}
          </View>
        )}

        {/* ─── No Quotes ─── */}
        {job.status === 'OPEN' && quotes.length === 0 && (
          <View style={styles.noQuotesCard}>
            <Animated.View style={{ opacity: pulseOpacity }}><Hourglass size={48} color={colors.amber} weight="fill" /></Animated.View>
            <Text style={[styles.noQuotesTitle, { color: colors.ink }]}>Waiting for heroes...</Text>
            <Text style={[styles.noQuotesSub, { color: colors.muted }]}>Providers are reviewing your mission. Hang tight!</Text>
          </View>
        )}

        {/* ─── Taskers ─── */}
        {job.status === 'OPEN' && providers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.providersHeader}>
              <Users size={20} color={colors.amber} weight="fill" />
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>Nearby Heroes ({providers.length})</Text>
            </View>
            {providers.map((p: any, i: number) => (
              <TouchableOpacity key={p.id || i} style={[styles.providerCard, { backgroundColor: colors.white }]}
                activeOpacity={0.7} onPress={() => router.push(`/(customer)/find/taskers/${job.id}`)}>
                <View style={[styles.providerAvatar, { backgroundColor: colors.amberLight }]}>
                  <Text style={styles.providerAvatarText}>{(p.name || 'T')[0]}</Text>
                </View>
                <View style={styles.providerInfo}>
                  <View style={styles.providerTop}>
                    <Text style={[styles.providerName, { color: colors.ink }]}>{p.name || 'Tasker'}</Text>
                    {p.isVerified && <CheckCircle size={14} color="#3B82F6" weight="fill" />}
                  </View>
                  <View style={styles.providerMeta}>
                    {p.rating ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}><Star size={11} color={colors.amber} weight="fill" /><Text style={[styles.providerMetaText, { color: colors.amber }]}> {p.rating.toFixed(1)}</Text></View> : null}
                    {p.completedJobs > 0 && <Text style={[styles.providerMetaText, { color: colors.muted }]}>{p.completedJobs} jobs</Text>}
                    {p.distance && <Text style={[styles.providerMetaText, { color: colors.muted }]}>{p.distance}</Text>}
                  </View>
                  {p.hourlyRate ? <Text style={[styles.providerRate, { color: colors.success }]}>{currencyCode} {p.hourlyRate}/hr</Text> : p.fixedRate ? <Text style={[styles.providerRate, { color: colors.success }]}>{currencyCode} {p.fixedRate}</Text> : null}
                </View>
                <TouchableOpacity
                  hitSlop={8}
                  onPress={() => {
                    setMsgPrefill(`Hi ${p.name || ''}, I saw your profile for "${job?.title || 'this job'}". Are you available?`)
                    setMsgRecipient({ id: p.id, name: p.name || 'Tasker' })
                  }}
                  style={[styles.messageIconBtn, { backgroundColor: colors.amberLight }]}
                >
                  <ChatCircle size={16} color={colors.amber} weight="fill" />
                </TouchableOpacity>
                <CaretRight size={16} color={colors.muted} weight="bold" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ─── Action Cards ─── */}
        {job.status === 'QUOTE_ACCEPTED' && escrow?.status === 'PENDING_PAYMENT' ? (
          <View style={[styles.actionCard, { backgroundColor: colors.amberBg, borderColor: colors.amberLight }]}>
            <Lock size={32} color={colors.ink} weight="fill" />
            <Text style={styles.actionCardTitle}>Secure Payment</Text>
            <Text style={styles.actionCardDesc}>
              Choose secure online payment or cash. Online payment is protected by MaintainEX. Cash is paid directly to the provider and is not held by MaintainEX.
            </Text>
            <ActionBtn label="Pay Securely" loadingKey="escrow" onPress={handleDepositEscrow} />
            <ActionBtn label="Use Cash" loadingKey="cash" onPress={handleCashPayment} outline />
          </View>
        ) : null}

        {escrow && ['PROTECTED', 'CASH_CONFIRMED'].includes(escrow.status) && !job.addressSharedAt && (
          <View style={[styles.actionCard, { backgroundColor: colors.amberBg, borderColor: colors.amberLight }]}>
            <MapPin size={28} color={colors.amber} weight="fill" />
            <Text style={styles.actionCardTitle}>Share Address</Text>
            <Text style={styles.actionCardDesc}>Let your hero know where to go</Text>
            {!showAddressForm ? (
              <ActionBtn label="Share Address" loadingKey="share-btn" onPress={() => setShowAddressForm(true)} outline />
            ) : (
              <View style={styles.addressForm}>
                <TextInput style={[styles.input, { backgroundColor: colors.white, borderColor: colors.border, color: colors.ink }]} value={addressStreet} onChangeText={setAddressStreet} placeholder="Street" placeholderTextColor={colors.muted} />
                <TextInput style={[styles.input, { backgroundColor: colors.white, borderColor: colors.border, color: colors.ink }]} value={addressBuilding} onChangeText={setAddressBuilding} placeholder="Building" placeholderTextColor={colors.muted} />
                <TextInput style={[styles.input, { backgroundColor: colors.white, borderColor: colors.border, color: colors.ink }]} value={addressApartment} onChangeText={setAddressApartment} placeholder="Apartment" placeholderTextColor={colors.muted} />
                <TextInput style={[styles.input, { backgroundColor: colors.white, borderColor: colors.border, color: colors.ink }]} value={addressLandmark} onChangeText={setAddressLandmark} placeholder="Landmark" placeholderTextColor={colors.muted} />
                <ActionBtn label="Save" loadingKey="address" onPress={handleShareAddress} />
              </View>
            )}
          </View>
        )}

        {workspace?.progressStatus === 'ACCEPTED' && ['PROTECTED', 'CASH_CONFIRMED'].includes(escrow?.status) && (
          <View style={[styles.actionCard, { backgroundColor: colors.amberBg, borderColor: colors.amber }]}>
            <ShieldCheck size={28} color={colors.amber} weight="fill" />
            <Text style={styles.actionCardTitle}>Arrival & Work Start Verification</Text>
            <Text style={styles.actionCardDesc}>
              Generate a one-time arrival PIN when the provider reaches you. After arrival is confirmed, generate a fresh PIN only when you are ready for work to start.
            </Text>
            <ActionBtn
              label="Open Verification PIN"
              loadingKey=""
              onPress={() => router.push(`/(customer)/jobs/v2/${id}/pin`)}
            />
          </View>
        )}

        {workspace?.progressStatus === 'COMPLETION_REQUESTED' && (
          <View style={[styles.actionCard, { backgroundColor: colors.amberBg, borderColor: colors.success }]}>
            <CheckCircle size={32} color={colors.success} weight="fill" />
            <Text style={styles.actionCardTitle}>Job Complete?</Text>
            <Text style={styles.actionCardDesc}>
              {escrow?.status === 'CASH_CONFIRMED'
                ? 'Your provider says the work is complete. Approve completion to close the job and record the provider platform settlement.'
                : 'Your hero says they are done. Check the work and release the protected payment.'}
            </Text>
            <ActionBtn
              label={escrow?.status === 'CASH_CONFIRMED' ? 'Approve Completion' : 'Approve & Release'}
              loadingKey="approve"
              onPress={handleApproveCompletion}
              color={colors.success}
            />
          </View>
        )}

        {/* ─── Escrow Status ─── */}
        {escrow && ['PROTECTED', 'CASH_CONFIRMED'].includes(escrow.status) && (
          <View style={[styles.escrowCard, { backgroundColor: colors.white, borderColor: colors.border }]}>
            <View style={styles.escrowHeader}>
              <Text style={[styles.escrowTitle, { color: colors.ink }]}>Escrow</Text>
              <View style={styles.escrowBadge}>
                <Text style={styles.escrowBadgeText}>
                  {escrow.status === 'CASH_CONFIRMED' ? 'Cash selected' : 'Protected'}
                </Text>
              </View>
            </View>
            <Text style={[styles.escrowAmount, { color: colors.ink }]}>
              {escrow.currency || 'LKR'} {Number(escrow.totalAmount || escrow.amount || 0).toLocaleString()}
            </Text>
            <Text style={[styles.actionCardDesc, { marginBottom: 0 }]}>
              {escrow.status === 'CASH_CONFIRMED'
                ? 'Cash is paid directly to the provider and is not held by MaintainEX. Use the verification PIN before work begins.'
                : 'Payment stays protected until you approve completed work. Before work starts, use the booking cancellation action above.'}
            </Text>
          </View>
        )}

        {/* ─── Dispute ─── */}
        {job.status === 'IN_PROGRESS' && workspace?.progressStatus !== 'DISPUTED' && (
          <TouchableOpacity style={styles.disputeBtn} onPress={handleDispute}>
            <Text style={styles.disputeBtnText}>Raise a Dispute</Text>
          </TouchableOpacity>
        )}

        {/* ─── Reviews ─── */}
        {reviews?.customerReviews?.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>Reviews</Text>
            {reviews.customerReviews.map((r: any) => (
              <View key={r.id} style={[styles.reviewCard, { backgroundColor: colors.white }]}>
                <View style={styles.reviewStars}>
                  {[1, 2, 3, 4, 5].map((s) => {
                    const active = s <= Math.round((r.quality + r.communication + r.timeliness) / 3)
                    return <Star key={s} size={18} color={active ? colors.amber : colors.border} weight={active ? 'fill' : 'regular'} style={{ marginRight: 2 }} />
                  })}
                </View>
                <Text style={[styles.reviewScores, { color: colors.muted }]}>Quality: {r.quality} · Communication: {r.communication} · Timeliness: {r.timeliness}</Text>
                {r.comment ? <Text style={[styles.reviewComment, { color: colors.ink }]}>{r.comment}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ─── Bargain Modal ─── */}
      <Modal visible={!!bargainModal} transparent animationType="slide" onRequestClose={() => setBargainModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.white }]}>
            <Handshake size={36} color={colors.amber} weight="fill" style={{ alignSelf: 'center', marginBottom: 8 }} />
            <Text style={[styles.modalTitle, { color: colors.ink }]}>Counter Offer</Text>
            <Text style={[styles.modalSub, { color: colors.muted }]}>Propose your price to {bargainModal?.provider?.name || 'the hero'}</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.ink }]}
              value={bargainPrice} onChangeText={setBargainPrice} placeholder={`${currencyCode} 0`} placeholderTextColor={colors.muted} keyboardType="numeric" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.border }]} onPress={() => setBargainModal(null)}>
                <Text style={[styles.modalBtnText, { color: colors.ink }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.amber }]} onPress={handleBargain} disabled={actionLoading !== ''}>
                {actionLoading === 'bargain' ? <ActivityIndicator color="#111827" size="small" /> : <Text style={styles.modalBtnText}>Send Offer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Cancel Reason Modal ─── */}
      <Modal visible={cancelReasonVisible} transparent animationType="slide" onRequestClose={() => setCancelReasonVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.white }]}>
            <XCircle size={36} color={colors.error} weight="fill" style={{ alignSelf: 'center', marginBottom: 8 }} />
            <Text style={[styles.modalTitle, { color: colors.ink }]}>Cancel Mission</Text>
            <View style={styles.reasonList}>
              {cancelReasons.map((r) => (
                <TouchableOpacity key={r.key} style={[styles.reasonOption, cancelReason === r.label && { backgroundColor: colors.amberBg }]}
                  onPress={() => setCancelReason(r.label)} activeOpacity={0.7}>
                  <View style={[styles.radio, { borderColor: colors.border }, cancelReason === r.label && { borderColor: colors.amber }]}>
                    {cancelReason === r.label && <View style={[styles.radioDot, { backgroundColor: colors.amber }]} />}
                  </View>
                  <Text style={[styles.reasonText, { color: colors.ink }]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
              <TextInput style={[styles.reasonInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.ink }]}
                value={cancelReason} onChangeText={setCancelReason} placeholder="Other reason..." placeholderTextColor={colors.muted} multiline />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.border }]} onPress={() => setCancelReasonVisible(false)}>
                <Text style={[styles.modalBtnText, { color: colors.ink }]}>Keep Job</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.error }]} onPress={handleCancelWithReason} disabled={actionLoading !== ''}>
                {actionLoading === 'cancel' ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>Cancel</Text>}
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
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },

  hero: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  heroImg: { width: '100%', height: 120, borderRadius: 18, marginBottom: 6 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, marginBottom: 8 },
  statusPillText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#fff' },
  title: { fontSize: 26, fontFamily: fonts.heading, lineHeight: 34, letterSpacing: -0.5 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, borderColor: colors.error, backgroundColor: colors.errorBg },
  cancelBtnText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.error },

  infoRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 4 },
  infoCard: { flex: 1, borderRadius: 20, padding: 14, gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  infoLabel: { fontSize: 11, fontFamily: fonts.body, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 16, fontFamily: fonts.headingBold },
  infoSub: { fontSize: 12, fontFamily: fonts.body },

  section: { padding: 16, paddingBottom: 6 },
  sectionTitle: { fontSize: 18, fontFamily: fonts.heading, marginBottom: 4 },
  quotesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  quoteCountBadge: { backgroundColor: colors.amber, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  quoteCountText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#111827' },
  descCard: { borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  desc: { fontSize: 14, fontFamily: fonts.body, lineHeight: 22, opacity: 0.8 },

  scheduleCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 14, borderWidth: 1.5 },
  scheduleText: { fontSize: 13, fontFamily: fonts.bodyMedium, flex: 1 },

  noQuotesCard: { alignItems: 'center', padding: 32, gap: 10 },
  noQuotesTitle: { fontSize: 18, fontFamily: fonts.heading },
  noQuotesSub: { fontSize: 13, fontFamily: fonts.body, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

  providersHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  providerCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  providerAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  providerAvatarText: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.amberDark },
  providerInfo: { flex: 1 },
  providerTop: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  providerName: { fontSize: 15, fontFamily: fonts.bodyMedium },
  providerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  providerMetaText: { fontSize: 11, fontFamily: fonts.bodyMedium },
  providerRate: { fontSize: 13, fontFamily: fonts.headingBold },

  actionCard: { borderWidth: 1.5, borderRadius: 24, marginHorizontal: 16, marginBottom: 12, padding: 24, alignItems: 'center' },
  actionCardTitle: { fontSize: 18, fontFamily: fonts.heading, color: colors.ink, marginBottom: 6, marginTop: 4 },
  actionCardDesc: { fontSize: 13, fontFamily: fonts.body, color: colors.muted, textAlign: 'center', lineHeight: 20, marginBottom: 16 },

  quoteCard: { borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  quoteTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  quoteAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  quoteAvatarText: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.amberDark },
  quoteInfo: { flex: 1 },
  quoteProvider: { fontSize: 15, fontFamily: fonts.bodyMedium },
  quoteMeta: { fontSize: 12, fontFamily: fonts.body, marginTop: 2 },
  quotePrice: { fontSize: 18, fontFamily: fonts.heading, letterSpacing: -0.3, color: colors.amberDark },
  quoteTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  quoteTagText: { fontSize: 10, fontFamily: fonts.bodySemiBold },
  quoteMsg: { fontSize: 13, fontFamily: fonts.body, opacity: 0.7, lineHeight: 20, marginBottom: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  quoteActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  quoteActionBtn: { flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  quoteActionBtnText: { fontSize: 13, fontFamily: fonts.bodyMedium },
  messageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, marginTop: 10, borderTopWidth: 1 },
  messageRowText: { fontSize: 13, fontFamily: fonts.bodyMedium },
  messageIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 4 },

  aiEstimateBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1.5, marginBottom: 12 },
  aiEstimateBannerText: { fontSize: 13, fontFamily: fonts.bodyMedium, flex: 1, lineHeight: 18 },

  addressForm: { width: '100%', marginTop: 8 },
  input: { borderWidth: 1.5, borderRadius: 16, padding: 14, fontSize: 14, fontFamily: fonts.body, marginBottom: 10 },

  actionBtn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16, alignItems: 'center', justifyContent: 'center', minWidth: 120, marginTop: 8 },
  actionBtnText: { fontSize: 15, fontFamily: fonts.bodyMedium },

  escrowCard: { borderRadius: 24, marginHorizontal: 16, marginBottom: 12, padding: 20, borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  escrowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  escrowTitle: { fontSize: 16, fontFamily: fonts.heading },
  escrowBadge: { backgroundColor: colors.amberBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  escrowBadgeText: { fontSize: 11, fontFamily: fonts.bodyMedium, color: colors.amberDark },
  escrowAmount: { fontSize: 28, fontFamily: fonts.heading, letterSpacing: -1, marginBottom: 16 },
  escrowActions: { gap: 4 },

  disputeBtn: { alignItems: 'center', paddingVertical: 16, marginBottom: 12 },
  disputeBtnText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.muted },

  reviewCard: { borderRadius: 20, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  reviewStars: { flexDirection: 'row', gap: 2, marginBottom: 8 },
  reviewScores: { fontSize: 13, fontFamily: fonts.body, marginBottom: 6 },
  reviewComment: { fontSize: 13, fontFamily: fonts.body, opacity: 0.7, lineHeight: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44 },
  modalTitle: { fontSize: 20, fontFamily: fonts.heading, marginBottom: 4, textAlign: 'center' },
  modalSub: { fontSize: 13, fontFamily: fonts.body, textAlign: 'center', marginBottom: 20 },
  modalInput: { borderWidth: 1.5, borderRadius: 16, padding: 16, fontSize: 16, fontFamily: fonts.headingBold, textAlign: 'center', marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontFamily: fonts.bodyMedium, color: '#111827' },
  reasonList: { marginVertical: 16, gap: 4 },
  reasonOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  reasonText: { fontSize: 15, fontFamily: fonts.bodyMedium, flex: 1 },
  reasonInput: { borderWidth: 1.5, borderRadius: 16, padding: 14, fontSize: 14, fontFamily: fonts.body, minHeight: 60, textAlignVertical: 'top', marginTop: 8 },
})
