import { useState, useRef, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image, Modal } from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PaperPlaneRight, CaretLeft, DotsThreeVertical, Image as ImageIcon, XCircle, Info, Lock, ShieldCheck, Wrench, CaretRight, Clock, WarningCircle, Check, User } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { conversations, auth, resolveImageUri } from '../../lib/api'
import { v2Jobs, v2Quotes } from '../../lib/api-v2'
import { useColors } from '../../lib/ThemeContext'
import { fonts } from '../../lib/fonts'

const CLOSED_STATUSES = ['COMPLETED', 'CANCELLED', 'REJECTED']
const CLIENT_CONTACT = /\+?\d[\d\s\-.]{6,}\d|[\w.+-]+@[\w-]+\.[\w.-]{2,}/g
const CLIENT_PAYMENT = /\b(paypal|bank\s*transfer|bank\s*deposit|wire\s*transfer|cash\s*app|cashapp|pay\s*me\s*directly|outside\s*(the\s*)?app|venmo|payoneer|zelle|upi|gcash|paytm)\b/gi
const CONTACT_PLACEHOLDER = '[Contact details removed]'

function detectWarnings(text: string): string[] {
  const warnings: string[] = []
  CLIENT_CONTACT.lastIndex = 0
  CLIENT_PAYMENT.lastIndex = 0
  if (CLIENT_CONTACT.test(text)) warnings.push('Please keep all communications on MΛINTΛINEX.')
  if (CLIENT_PAYMENT.test(text)) warnings.push('Reminder: all payments must go through MΛINTΛINEX')
  return warnings
}

export default function ChatDetailScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const router = useRouter()
  const { id, status, testMsg, testUser } = useLocalSearchParams()
  const isDemo = (id as string || '').startsWith('demo_')
  const [messages, setMessages] = useState<any[]>(() => {
    if (isDemo && testMsg) {
      return [{
        id: 'demo_msg',
        text: decodeURIComponent(testMsg as string),
        senderId: '__me__',
        createdAt: new Date().toISOString(),
        status: 'sent',
      }]
    }
    return []
  })
  const [inputText, setInputText] = useState('')
  const [preWarn, setPreWarn] = useState<string[]>([])
  const [loading, setLoading] = useState(isDemo ? false : true)
  const [userId, setUserId] = useState<string | null>(isDemo ? '__me__' : null)
  const [otherUser, setOtherUser] = useState<any>(isDemo ? { id: (id as string || '').replace('demo_', ''), name: decodeURIComponent(testUser as string || '') } : null)
  const [job, setJob] = useState<any>(null)
  const [myQuote, setMyQuote] = useState<any>(null)
  const [revisionVisible, setRevisionVisible] = useState(false)
  const [revisionPrice, setRevisionPrice] = useState('')
  const [revisionEta, setRevisionEta] = useState('')
  const [revisionMessage, setRevisionMessage] = useState('')
  const [revising, setRevising] = useState(false)
  const [sending, setSending] = useState(false)
  const [isClosed, setIsClosed] = useState(() => isDemo || CLOSED_STATUSES.includes((status as string || '').toUpperCase()))
  const flatListRef = useRef<FlatList>(null)

  const fetchUserId = useCallback(async () => {
    try {
      const user = await auth.me()
      setUserId(user.user.id)
    } catch {
      // fail silently
    }
  }, [])

  const fetchMessages = useCallback(async () => {
    if (!userId) return
    try {
      const data = await conversations.get(id as string)
      setMessages(data.messages || [])
      if (data.job) {
        setJob(data.job)
        try {
          const detail = await v2Jobs.get(data.job.id)
          const pending = (detail.job.quotes || [])
            .filter((quote: any) => quote.status === 'PENDING')
            .sort((a: any, b: any) => (b.revisionNumber || 1) - (a.revisionNumber || 1))
          const mine = pending.find((quote: any) =>
            quote.providerId === userId || quote.provider?.chatUserId === userId || quote.actorUserId === userId
          )
          setMyQuote(mine || null)
        } catch {
          setMyQuote(null)
        }
      }
      if (data.participants?.length > 0 && !otherUser) {
        const other = data.participants.find((p: any) => p.id !== userId)
        if (other) setOtherUser(other)
      }
      if (data.job?.status && CLOSED_STATUSES.includes(data.job.status)) {
        setIsClosed(true)
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false)
    }
  }, [id, userId, otherUser])

  useFocusEffect(
    useCallback(() => {
      if (!userId) return
      fetchMessages()
      const interval = setInterval(fetchMessages, 5000)
      return () => clearInterval(interval)
    }, [fetchMessages, userId])
  )

  useFocusEffect(
    useCallback(() => {
      fetchUserId()
    }, [fetchUserId])
  )

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return
    const text = inputText.trim()
    const optimisticMsg = {
      id: Date.now().toString(),
      text,
      senderId: userId,
      createdAt: new Date().toISOString(),
      status: isDemo ? 'sent' : 'sending',
    }
    setMessages(prev => [...prev, optimisticMsg])
    setInputText('')
    setPreWarn([])
    setSending(true)
    if (isDemo) {
      setTimeout(() => setSending(false), 250)
      return
    }
    try {
      const res = await conversations.sendMessage(id as string, text)
      setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? { ...m, status: 'sent', text: res?.text || m.text } : m))
    } catch {
      setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? { ...m, status: 'failed' } : m))
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return t('common.yesterday')
    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
  }

  const shouldShowDate = (index: number) => {
    if (index === 0) return true
    const curr = new Date(messages[index]?.createdAt || messages[index]?.updatedAt)
    const prev = new Date(messages[index - 1]?.createdAt || messages[index - 1]?.updatedAt)
    return curr.toDateString() !== prev.toDateString()
  }

  const retrySend = (msg: any) => {
    Alert.alert(t('common.error'), t('chat.sendFailed'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.retry'), onPress: async () => {
        setMessages(prev => prev.filter(m => m.id !== msg.id))
        setInputText(msg.text)
      }},
    ])
  }

  const openRevision = () => {
    if (!myQuote) return
    setRevisionPrice(String(myQuote.price || ''))
    setRevisionEta(myQuote.estimatedCompletionTime || '')
    setRevisionMessage(myQuote.message || '')
    setRevisionVisible(true)
  }

  const submitRevision = async () => {
    if (!myQuote || revising) return
    const price = Number(revisionPrice)
    if (!Number.isFinite(price) || price <= 0 || !revisionEta.trim()) {
      Alert.alert('Complete the revised quote', 'Enter the agreed price and expected completion time.')
      return
    }

    setRevising(true)
    try {
      await v2Quotes.revise(myQuote.id, {
        price,
        estimatedCompletionTime: revisionEta.trim(),
        message: revisionMessage.trim() || myQuote.message || undefined,
        revisionReason: 'Price updated after in-app negotiation',
        ...(myQuote.providerType === 'COMPANY' ? { companyId: myQuote.providerId } : {}),
      })
      setRevisionVisible(false)
      try {
        await conversations.sendMessage(
          id as string,
          `I updated my formal quote to LKR ${price.toLocaleString()}. Please review the revised quote before booking.`,
        )
      } catch {}
      await fetchMessages()
      Alert.alert('Revised quote sent', 'The customer has been notified. The new quote is now the price that can be accepted.')
    } catch (error: any) {
      Alert.alert('Could not revise quote', error?.message || 'Please try again.')
    } finally {
      setRevising(false)
    }
  }

  const otherName = otherUser?.name || t('home.chat')
  const otherAvatar = resolveImageUri(otherUser?.profileImage || otherUser?.avatar)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.topBar, { borderBottomColor: '#2E2E2E', backgroundColor: '#FFFFFF' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <CaretLeft size={22} color='#FFFFFF' weight='bold' />
        </TouchableOpacity>
        <View style={styles.topInfo}>
          {otherAvatar ? (
            <Image source={{ uri: otherAvatar }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarSmall, { backgroundColor: '#F5A623' }]}>
              <Text style={[styles.avatarText, { color: '#111827' }]}>{otherName[0]?.toUpperCase() || '?'}</Text>
            </View>
          )}
          <View>
            <Text style={[styles.chatName, { color: '#FFFFFF' }]}>{otherName}</Text>
            {job ? (
              <Text style={[styles.chatJobSub, { color: '#6F6B6B' }]} numberOfLines={1}>
                {job.title} • {job.ref}
              </Text>
            ) : null}
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push(`/(customer)/find/tasker-profile/${otherUser?.id || ''}`)}>
          <User size={24} color='#6F6B6B' />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color='#F5A623' />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id || Math.random().toString()}
            contentContainerStyle={styles.messagesContainer}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            ListHeaderComponent={
              <View>
                {isClosed ? (
                  <View style={[styles.closedBanner, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
                    <Lock size={16} color="#DC2626" />
                    <Text style={[styles.safetyText, { color: '#991B1B' }]}>{t('chat.conversationClosed')}</Text>
                  </View>
                ) : null}
                <View style={[styles.safetyBanner, { backgroundColor: 'rgba(245,166,35,0.08)', borderColor: 'rgba(245,166,35,0.19)' }]}>
                  <ShieldCheck size={16} color='#F5A623' />
                  <Text style={[styles.safetyText, { color: '#FFFFFF' }]}>{t('chat.safetyMessage')}</Text>
                </View>
                {myQuote && job?.status === 'OPEN' ? (
                  <View style={styles.quoteControl}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.quoteControlLabel}>YOUR FORMAL QUOTE</Text>
                      <Text style={styles.quoteControlPrice}>LKR {Number(myQuote.price || 0).toLocaleString()}</Text>
                      <Text style={styles.quoteControlHint}>Negotiate here, then update the quote so the final price is recorded before booking.</Text>
                    </View>
                    <TouchableOpacity style={styles.quoteControlButton} onPress={openRevision}>
                      <Text style={styles.quoteControlButtonText}>Update quote</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {job?.categoryName || job?.photos?.length ? (
                  <TouchableOpacity
                    style={[styles.jobCard, { backgroundColor: '#FFFFFF', borderColor: '#2E2E2E' }]}
                    onPress={() => router.push(`/(customer)/jobs/v2/${job.id}`)}
                  >
                    {job.photos?.length ? (
                      <Image source={{ uri: resolveImageUri(job.photos[0]) }} style={styles.jobCardImg} />
                    ) : (
                      <View style={[styles.jobCardImg, styles.jobCardImgPlaceholder, { backgroundColor: '#FFF1D2' }]}>
                        <Wrench size={20} color='#F5A623' />
                      </View>
                    )}
                    <View style={styles.jobCardBody}>
                      <Text style={[styles.jobCardCat, { color: '#D4900A' }]} numberOfLines={1}>
                        {job.categoryName || 'Maintenance job'}
                      </Text>
                      <Text style={[styles.jobCardTitle, { color: '#FFFFFF' }]} numberOfLines={2}>{job.title}</Text>
                      <Text style={[styles.jobCardMeta, { color: '#6F6B6B' }]}>
                        {job.ref}
                        {job.aiEstimate?.priceRange ? ` • Estimate Rs ${job.aiEstimate.priceRange.min?.toLocaleString?.()} – ${job.aiEstimate.priceRange.max?.toLocaleString?.()}` : (job.budgetAmount ? ` • Budget Rs ${Number(job.budgetAmount).toLocaleString()}` : '')}
                      </Text>
                    </View>
                    <CaretRight size={18} color='#6F6B6B' />
                  </TouchableOpacity>
                ) : null}
              </View>
            }
            renderItem={({ item, index }) => {
              const isUser = userId ? item.senderId === userId : false
              const showDate = shouldShowDate(index)
              const flagged = item.text?.includes(CONTACT_PLACEHOLDER)
              return (
                <View>
                  {showDate && (
                    <View style={styles.dateSep}>
                      <Text style={[styles.dateSepText, { color: '#6F6B6B' }]}>{formatDate(item.createdAt || item.updatedAt)}</Text>
                    </View>
                  )}
                  {flagged && !isUser && (
                    <View style={[styles.flagBanner, { backgroundColor: 'rgba(245,166,35,0.08)', borderColor: 'rgba(245,166,35,0.19)' }]}>
                      <ShieldCheck size={12} color='#F5A623' />
                      <Text style={[styles.flagBannerText, { color: '#FFFFFF' }]}>Reminder: all payments must go through MΛINTΛINEX</Text>
                    </View>
                  )}
                  <View style={[styles.messageWrap, { maxWidth: '78%' }, isUser ? styles.messageSent : styles.messageReceived]}>
                    <View style={[styles.messageBubble, isUser ? { backgroundColor: '#F5A623', borderBottomRightRadius: 4 } : { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#2E2E2E' }]}>
                      <Text style={[styles.messageText, { color: isUser ? '#111827' : '#FFFFFF' }]}>{item.text}</Text>
                    </View>
                    <View style={[styles.messageFooter, isUser ? styles.footerSent : styles.footerReceived]}>
                      <Text style={[styles.messageTime, { color: '#6F6B6B' }]}>{formatTime(item.createdAt || item.updatedAt)}</Text>
                      {isUser && (
                        item.status === 'sending' ? (
                          <Clock size={11} color='#6F6B6B' />
                        ) : item.status === 'failed' ? (
                          <TouchableOpacity onPress={() => retrySend(item)}>
                            <WarningCircle size={11} color="#EF4444" />
                          </TouchableOpacity>
                        ) : (
                          <Check size={11} color='#6F6B6B' />
                        )
                      )}
                    </View>
                  </View>
                </View>
              )
            }}
          />
        )}

        {isClosed ? (
          <View style={[styles.closedInputBar, { borderTopColor: '#2E2E2E', backgroundColor: '#FEF2F2' }]}>
            <Lock size={14} color="#DC2626" />
            <Text style={[styles.closedInputText, { color: '#991B1B' }]}>{t('chat.conversationClosed')}</Text>
          </View>
        ) : (
          <View style={[styles.inputBar, { borderTopColor: '#2E2E2E', backgroundColor: '#FFFFFF' }]}>
            {preWarn.length > 0 && (
              <View style={[styles.flagBanner, { backgroundColor: 'rgba(245,166,35,0.08)', borderColor: 'rgba(245,166,35,0.19)' }]}>
                <ShieldCheck size={12} color='#F5A623' />
                <Text style={[styles.flagBannerText, { color: '#FFFFFF' }]}>{preWarn.join(' · ')}</Text>
              </View>
            )}
            <View style={[styles.inputWrap, { backgroundColor: '#FFFFFF', borderColor: '#2E2E2E' }]}>
              <TextInput
                style={[styles.input, { color: '#FFFFFF' }]}
                value={inputText}
                onChangeText={(t) => { setInputText(t); setPreWarn(detectWarnings(t)) }}
                placeholder={t('chat.inputPlaceholder')}
                placeholderTextColor='#6F6B6B'
                multiline
              />
            </View>
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: inputText.trim() ? '#F5A623' : '#2E2E2E' }]}
              onPress={sendMessage}
              disabled={!inputText.trim() || sending}
              activeOpacity={0.7}
            >
              <PaperPlaneRight size={16} color={inputText.trim() ? '#111827' : '#6F6B6B'} />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal
        visible={revisionVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !revising && setRevisionVisible(false)}
      >
        <View style={styles.revisionOverlay}>
          <View style={styles.revisionSheet}>
            <Text style={styles.revisionTitle}>Send revised quote</Text>
            <Text style={styles.revisionSubtitle}>Use the price you agreed in chat. The customer must still explicitly accept it.</Text>

            <Text style={styles.revisionLabel}>Agreed price (LKR)</Text>
            <TextInput
              value={revisionPrice}
              onChangeText={setRevisionPrice}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#6F6B6B"
              style={styles.revisionInput}
            />

            <Text style={styles.revisionLabel}>Expected completion</Text>
            <TextInput
              value={revisionEta}
              onChangeText={setRevisionEta}
              placeholder="e.g. Today · 2 hours"
              placeholderTextColor="#6F6B6B"
              style={styles.revisionInput}
            />

            <Text style={styles.revisionLabel}>Updated scope / note</Text>
            <TextInput
              value={revisionMessage}
              onChangeText={setRevisionMessage}
              placeholder="What is included in this revised price?"
              placeholderTextColor="#6F6B6B"
              style={[styles.revisionInput, styles.revisionTextArea]}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.revisionActions}>
              <TouchableOpacity style={styles.revisionCancel} onPress={() => setRevisionVisible(false)} disabled={revising}>
                <Text style={styles.revisionCancelText}>Back to chat</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.revisionSend, revising && { opacity: 0.55 }]} onPress={submitRevision} disabled={revising}>
                {revising ? <ActivityIndicator size="small" color="#111827" /> : <Text style={styles.revisionSendText}>Send revised quote</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: { marginRight: 8, padding: 4 },
  topInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarSmall: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: 36, height: 36, borderRadius: 18 },
  avatarText: { fontSize: 14, fontFamily: fonts.heading },
  chatName: { fontSize: 15, fontFamily: fonts.bodyMedium },
  chatJobSub: { fontSize: 11, fontFamily: fonts.body, marginTop: 1 },
  safetyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  safetyText: { fontSize: 12, fontFamily: fonts.body, flex: 1, lineHeight: 16 },
  quoteControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF1D2',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  quoteControlLabel: { fontSize: 10, fontFamily: fonts.bodyMedium, color: '#8A5C00', letterSpacing: 0.8 },
  quoteControlPrice: { fontSize: 18, fontFamily: fonts.heading, color: '#111827', marginTop: 2 },
  quoteControlHint: { fontSize: 11, fontFamily: fonts.body, color: '#6B5A32', lineHeight: 15, marginTop: 2 },
  quoteControlButton: { backgroundColor: '#111827', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 },
  quoteControlButtonText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#FFFFFF' },
  revisionOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  revisionSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  revisionTitle: { fontSize: 20, fontFamily: fonts.heading, color: '#111827' },
  revisionSubtitle: { fontSize: 12, fontFamily: fonts.body, color: '#6F6B6B', lineHeight: 17, marginTop: 5, marginBottom: 8 },
  revisionLabel: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#4B5563', marginTop: 12, marginBottom: 6 },
  revisionInput: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 13, color: '#111827', fontFamily: fonts.bodyMedium, fontSize: 14 },
  revisionTextArea: { minHeight: 92, paddingTop: 12, paddingBottom: 12 },
  revisionActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  revisionCancel: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  revisionCancelText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: '#111827' },
  revisionSend: { flex: 1.35, height: 50, borderRadius: 14, backgroundColor: '#F5A623', alignItems: 'center', justifyContent: 'center' },
  revisionSendText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: '#111827' },
  flagBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  flagBannerText: { fontSize: 11, fontFamily: fonts.body, flex: 1, lineHeight: 15 },
  messagesContainer: { padding: 16, paddingBottom: 8 },
  dateSep: { alignItems: 'center', marginVertical: 12 },
  dateSepText: { fontSize: 11, fontFamily: fonts.body },
  messageWrap: { marginBottom: 12 },
  messageSent: { alignSelf: 'flex-end' },
  messageReceived: { alignSelf: 'flex-start' },
  messageBubble: { padding: 12, borderRadius: 16 },
  messageText: { fontSize: 15, fontFamily: fonts.body, lineHeight: 20 },
  messageFooter: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  footerSent: { justifyContent: 'flex-end' },
  footerReceived: { justifyContent: 'flex-start' },
  messageTime: { fontSize: 10, fontFamily: fonts.body },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    gap: 8,
  },
  inputWrap: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 22,
    paddingHorizontal: 4,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: fonts.body,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  closedInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    paddingBottom: Platform.OS === 'ios' ? 26 : 14,
    borderTopWidth: 1,
  },
  closedInputText: { fontSize: 13, fontFamily: fonts.body },
  jobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  jobCardImg: { width: 46, height: 46, borderRadius: 10 },
  jobCardImgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  jobCardBody: { flex: 1, gap: 1 },
  jobCardCat: { fontSize: 11, fontFamily: fonts.heading },
  jobCardTitle: { fontSize: 13, fontFamily: fonts.bodySemiBold },
  jobCardMeta: { fontSize: 11, fontFamily: fonts.body },
})
