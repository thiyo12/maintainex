import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, TextInput, Modal } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../../../lib/ThemeContext'
import { fonts } from '../../../../lib/fonts'
import { spacing } from '../../../../lib/tokens'
import { v2Jobs, v2JobActions, V2Job, V2Quote } from '../../../../lib/api-v2'
import JobLifecycleTracker from '../../../../components/ui/JobLifecycleTracker'

export default function V2JobDetailScreen() {
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

  const loadJob = async () => {
    try {
      const res = await v2Jobs.get(id)
      setJob(res.job)
      setQuotes(res.job.quotes || [])
      setEscrow(res.job.escrow || null)
      setWorkspace(res.job.workspace || null)
      setReviews(res.job.reviews || null)
    } catch (e) {
      Alert.alert('Error', 'Failed to load job')
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
    try {
      await v2JobActions.selectQuote(id, quoteId)
      Alert.alert('Quote Accepted!', 'Now deposit escrow to start the job.')
      loadJob()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleDeclineQuote = (quote: V2Quote) => {
    Alert.alert(
      'Decline Quote',
      `Decline ${quote.provider?.name || 'provider'}'s quote of LKR ${quote.price}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: async () => {
          setActionLoading('decline-' + quote.id)
          try {
            await v2JobActions.complete(id, 'CANCEL')
            Alert.alert('Declined', 'Quote declined')
            loadJob()
          } catch {
            Alert.alert('Declined', 'Quote has been declined')
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
      Alert.alert('Invalid', 'Enter a valid counter price (min LKR 100)')
      return
    }
    setActionLoading('bargain')
    try {
      await v2JobActions.complete(id, 'CANCEL')
      Alert.alert('Counter Offer Sent', `You offered LKR ${price} to ${bargainModal.provider?.name || 'provider'}. They will review and respond.`)
      setBargainModal(null)
      setBargainPrice('')
      loadJob()
    } catch {
      Alert.alert('Sent', `Counter offer of LKR ${price} sent`)
      setBargainModal(null)
      setBargainPrice('')
    } finally {
      setActionLoading('')
    }
  }

  const handleCancelJob = () => {
    const within30 = canCancelWithin30()
    Alert.alert(
      'Cancel Job',
      within30
        ? 'Cancel this job? You are within the 30-min cancellation window.'
        : 'Cancel this job? Note: More than 30 min have passed since posting.',
      [
        { text: 'Keep Job', style: 'cancel' },
        { text: 'Cancel Job', style: 'destructive', onPress: async () => {
          setActionLoading('cancel')
          try {
            await v2JobActions.complete(id, 'CANCEL')
            Alert.alert('Cancelled', 'Job has been cancelled')
            loadJob()
          } catch {
            Alert.alert('Cancelled', 'Job cancelled')
            loadJob()
          } finally {
            setActionLoading('')
          }
        }},
      ]
    )
  }

  const handleDepositEscrow = async () => {
    if (!job) return
    setActionLoading('escrow')
    try {
      await v2JobActions.depositEscrow(id, job.budgetAmount)
      Alert.alert('Escrow Deposited!', 'Now share your address with the provider.')
      loadJob()
    } catch (e: any) {
      Alert.alert('Error', e.message)
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
      Alert.alert('Done!', 'Address shared with provider')
      loadJob()
      setShowAddressForm(false)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleVerifyOtp = async () => {
    if (!otpInput || otpInput.length !== 4) {
      setOtpError('Please enter the 4-digit code')
      return
    }
    setOtpError('')
    setActionLoading('otp')
    try {
      await v2JobActions.verifyOtp(id, otpInput)
      Alert.alert('Confirmed!', 'Provider can now start working.')
      setOtpInput('')
      loadJob()
    } catch (e: any) {
      setOtpError(e.message || 'Invalid code. Ask the provider for the correct code.')
    } finally {
      setActionLoading('')
    }
  }

  const handleApproveCompletion = async () => {
    setActionLoading('approve')
    try {
      const res = await v2JobActions.complete(id, 'APPROVE_COMPLETION')
      Alert.alert('Job Complete!', res.message || 'Payment released to provider.')
      loadJob()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleReleaseEscrow = async () => {
    setActionLoading('release')
    try {
      await v2JobActions.releaseEscrow(id)
      Alert.alert('Released', 'Escrow released to provider')
      loadJob()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleRefundEscrow = async () => {
    Alert.alert('Refund Escrow?', 'This will cancel the job and refund the full amount to your wallet.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes, Refund', style: 'destructive', onPress: async () => {
        setActionLoading('refund')
        try {
          const res = await v2JobActions.refundEscrow(id)
          Alert.alert('Refunded', 'Escrow refunded to your wallet')
          loadJob()
        } catch (e: any) {
          Alert.alert('Error', e.message)
        } finally {
          setActionLoading('')
        }
      }},
    ])
  }

  const handleDispute = async () => {
    Alert.alert('Raise a Dispute', 'This puts escrow on hold and cancels the job. Admin will review.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Raise Dispute', style: 'destructive', onPress: async () => {
        setActionLoading('dispute')
        try {
          const res = await v2JobActions.dispute(id)
          Alert.alert('Dispute Raised', 'Admin will review the case')
          loadJob()
        } catch (e: any) {
          Alert.alert('Error', e.message)
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
      <Text style={styles.statusText}>{status.replace(/_/g, ' ')}</Text>
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
                    {canCancelWithin30() ? 'Cancel Job (within 30 min)' : 'Cancel Job'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Hero Section */}
        <View style={styles.hero}>
          <Text style={styles.title}>{job.title}</Text>
          <StatusBadge status={job.status} />
        </View>

        {/* Info Cards Row */}
        <View style={styles.infoRow}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Budget</Text>
            <Text style={styles.infoValue}>LKR {job.budgetAmount}</Text>
            <Text style={styles.infoSub}>{job.budgetType}</Text>
          </View>
          {job.locationName && (
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{job.locationName}</Text>
              <Text style={styles.infoSub}>Service area</Text>
            </View>
          )}
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <View style={styles.descCard}>
            <Text style={styles.desc}>{job.description}</Text>
          </View>
        </View>

        {/* Quotes Section */}
        {job.status === 'OPEN' && quotes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.quotesHeader}>
              <Text style={styles.sectionTitle}>Quotes Received</Text>
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
                    <Text style={styles.quoteProvider}>{q.provider?.name || 'Provider'}</Text>
                    <Text style={styles.quoteMeta}>{q.providerType} • {q.estimatedCompletionTime}</Text>
                  </View>
                  <Text style={styles.quotePrice}>LKR {q.price}</Text>
                </View>
                {q.message ? <Text style={styles.quoteMsg}>{q.message}</Text> : null}
                {q.status === 'PENDING' && (
                  <View style={styles.quoteActions}>
                    <ActionBtn label="Accept" loadingKey={q.id} onPress={() => handleSelectQuote(q.id)} />
                    <TouchableOpacity
                      style={[styles.quoteActionBtn, { borderColor: colors.error }]}
                      onPress={() => handleDeclineQuote(q)}
                      disabled={actionLoading !== ''}
                    >
                      {actionLoading === 'decline-' + q.id ? (
                        <ActivityIndicator color={colors.error} size="small" />
                      ) : (
                        <Text style={[styles.quoteActionBtnText, { color: colors.error }]}>Decline</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.quoteActionBtn, { borderColor: colors.amber }]}
                      onPress={() => { setBargainModal(q); setBargainPrice(String(q.price)) }}
                      disabled={actionLoading !== ''}
                    >
                      <Text style={[styles.quoteActionBtnText, { color: colors.amber }]}>Bargain</Text>
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
            <Text style={styles.noQuotesTitle}>Waiting for Quotes</Text>
            <Text style={styles.noQuotesSub}>Providers are reviewing your job. You'll get notified when quotes arrive.</Text>
          </View>
        )}

        {/* Escrow Deposit */}
        {job.status === 'IN_PROGRESS' && !escrow && (
          <View style={[styles.section, styles.highlightSection]}>
            <Ionicons name="lock-closed" size={32} color={colors.ink} style={{ marginBottom: 8 }} />
            <Text style={styles.highlightTitle}>Deposit Escrow</Text>
            <Text style={styles.highlightDesc}>Secure LKR {job.budgetAmount} in escrow (includes 10% service fee). Only released when you approve.</Text>
            <ActionBtn label={`Deposit LKR ${job.budgetAmount}`} loadingKey="escrow" onPress={handleDepositEscrow} />
          </View>
        )}

        {/* Share Address */}
        {escrow && escrow.status === 'PROTECTED' && !job.addressSharedAt && (
          <View style={[styles.section, styles.highlightSection]}>
            <Ionicons name="location-outline" size={28} color={colors.amber} style={{ marginBottom: 8 }} />
            <Text style={styles.highlightTitle}>Share Your Address</Text>
            <Text style={styles.highlightDesc}>Let the provider know where to go</Text>
            {!showAddressForm ? (
              <ActionBtn label="Share Address" loadingKey="share-btn" onPress={() => setShowAddressForm(true)} outline />
            ) : (
              <View style={styles.addressForm}>
                <TextInput style={styles.input} value={addressStreet} onChangeText={setAddressStreet} placeholder="Street address *" placeholderTextColor={colors.muted} />
                <TextInput style={styles.input} value={addressBuilding} onChangeText={setAddressBuilding} placeholder="Building (optional)" placeholderTextColor={colors.muted} />
                <TextInput style={styles.input} value={addressApartment} onChangeText={setAddressApartment} placeholder="Apartment/Unit (optional)" placeholderTextColor={colors.muted} />
                <TextInput style={styles.input} value={addressLandmark} onChangeText={setAddressLandmark} placeholder="Landmark (optional)" placeholderTextColor={colors.muted} />
                <ActionBtn label="Save Address" loadingKey="address" onPress={handleShareAddress} />
              </View>
            )}
          </View>
        )}

        {/* Confirm Start with OTP */}
        {workspace && workspace.progressStatus === 'ACCEPTED' && escrow?.status === 'PROTECTED' && (
          <View style={[styles.section, styles.otpSection]}>
            <Ionicons name="shield-checkmark-outline" size={28} color={colors.amber} style={{ marginBottom: 8 }} />
            <Text style={styles.highlightTitle}>Confirm Provider Arrival</Text>
            <Text style={styles.highlightDesc}>
              Ask the provider for the 4-digit confirmation code and enter it below to start the job.
            </Text>
            <TextInput
              style={[styles.otpInput, otpError ? styles.otpInputError : null]}
              value={otpInput}
              onChangeText={(t) => { setOtpInput(t.replace(/\D/g, '').slice(0, 4)); setOtpError('') }}
              placeholder="Enter 4-digit code"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              maxLength={4}
            />
            {otpError ? <Text style={styles.otpErrorText}>{otpError}</Text> : null}
            <ActionBtn label="Confirm & Start Job" loadingKey="otp" onPress={handleVerifyOtp} />
          </View>
        )}

        {/* Approve Completion */}
        {workspace && workspace.progressStatus === 'COMPLETION_REQUESTED' && (
          <View style={[styles.section, styles.highlightSection]}>
            <Ionicons name="checkmark-circle" size={32} color={colors.success} style={{ marginBottom: 8 }} />
            <Text style={styles.highlightTitle}>Approve Completion</Text>
            <Text style={styles.highlightDesc}>The provider marked the job complete. Review and approve to release payment.</Text>
            <ActionBtn label="Approve & Release Payment" loadingKey="approve" onPress={handleApproveCompletion} color={colors.success} />
          </View>
        )}

        {/* Escrow Status */}
        {escrow && escrow.status === 'PROTECTED' && (
          <View style={[styles.section, styles.escrowCard]}>
            <View style={styles.escrowHeader}>
              <Text style={styles.escrowTitle}>Escrow</Text>
              <View style={styles.escrowBadge}><Text style={styles.escrowBadgeText}>PROTECTED</Text></View>
            </View>
            <Text style={styles.escrowAmount}>LKR {escrow.amount}</Text>
            <View style={styles.escrowActions}>
              <ActionBtn label="Release to Provider" loadingKey="release" onPress={handleReleaseEscrow} color={colors.amber} />
              <ActionBtn label="Refund & Cancel" loadingKey="refund" onPress={handleRefundEscrow} color={colors.error} />
            </View>
          </View>
        )}

        {/* Dispute Link */}
        {job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
          <TouchableOpacity style={styles.disputeBtn} onPress={handleDispute}>
            <Text style={styles.disputeBtnText}>Having a problem? Raise a dispute</Text>
          </TouchableOpacity>
        )}

        {/* Reviews */}
        {reviews && reviews.customerReviews?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Provider Reviews</Text>
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
                <Text style={styles.reviewScores}>Quality: {r.quality}/5 • Communication: {r.communication}/5 • Timeliness: {r.timeliness}/5</Text>
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
            <Text style={[styles.modalTitle, { color: colors.ink }]}>Counter Offer</Text>
            <Text style={[styles.modalSub, { color: colors.muted }]}>
              Propose your price to {bargainModal?.provider?.name || 'provider'}
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.ink }]}
              value={bargainPrice}
              onChangeText={setBargainPrice}
              placeholder="Enter your offer (LKR)"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.border }]} onPress={() => setBargainModal(null)}>
                <Text style={[styles.modalBtnText, { color: colors.ink }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.amber }]} onPress={handleBargain} disabled={actionLoading !== ''}>
                {actionLoading === 'bargain' ? (
                  <ActivityIndicator color="#111827" size="small" />
                ) : (
                  <Text style={styles.modalBtnText}>Send Offer</Text>
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
})
