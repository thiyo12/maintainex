import { useState, useRef, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image } from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { conversations, auth, resolveImageUri } from '../../lib/api'
import { useTheme } from '../../lib/ThemeContext'
import { fonts } from '../../lib/fonts'

const CLOSED_STATUSES = ['COMPLETED', 'CANCELLED', 'REJECTED']
const CLIENT_CONTACT = /\+?\d[\d\s\-.]{6,}\d|[\w.+-]+@[\w-]+\.[\w.-]{2,}/g
const CLIENT_PAYMENT = /\b(paypal|bank\s*transfer|bank\s*deposit|wire\s*transfer|cash\s*app|cashapp|pay\s*me\s*directly|outside\s*(the\s*)?app|venmo|payoneer|zelle|upi|gcash|paytm)\b/gi
const CONTACT_PLACEHOLDER = '[Contact details removed]'

function detectWarnings(text: string): string[] {
  const warnings: string[] = []
  CLIENT_CONTACT.lastIndex = 0
  CLIENT_PAYMENT.lastIndex = 0
  if (CLIENT_CONTACT.test(text)) warnings.push('Please keep all communications on Maintainex.')
  if (CLIENT_PAYMENT.test(text)) warnings.push('Reminder: all payments must go through Maintainex')
  return warnings
}

export default function ChatDetailScreen() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = makeStyles(colors)
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
      if (data.job) setJob(data.job)
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

  const otherName = otherUser?.name || t('home.chat')
  const otherAvatar = resolveImageUri(otherUser?.profileImage || otherUser?.avatar)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.topBar, { borderBottomColor: colors.border, backgroundColor: colors.white }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.topInfo}>
          {otherAvatar ? (
            <Image source={{ uri: otherAvatar }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarSmall, { backgroundColor: colors.amber }]}>
              <Text style={[styles.avatarText, { color: '#111827' }]}>{otherName[0]?.toUpperCase() || '?'}</Text>
            </View>
          )}
          <View>
            <Text style={[styles.chatName, { color: colors.ink }]}>{otherName}</Text>
            {job ? (
              <Text style={[styles.chatJobSub, { color: colors.muted }]} numberOfLines={1}>
                {job.title} • {job.ref}
              </Text>
            ) : null}
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push(`/(customer)/find/tasker-profile/${otherUser?.id || ''}`)}>
          <Ionicons name="person-circle-outline" size={24} color={colors.muted} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.amber} />
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
                    <Ionicons name="lock-closed" size={16} color="#DC2626" />
                    <Text style={[styles.safetyText, { color: '#991B1B' }]}>{t('chat.conversationClosed')}</Text>
                  </View>
                ) : null}
                <View style={[styles.safetyBanner, { backgroundColor: colors.amber + '15', borderColor: colors.amber + '30' }]}>
                  <Ionicons name="shield-checkmark" size={16} color={colors.amber} />
                  <Text style={[styles.safetyText, { color: colors.ink }]}>{t('chat.safetyMessage')}</Text>
                </View>
                {job?.categoryName || job?.photos?.length ? (
                  <TouchableOpacity
                    style={[styles.jobCard, { backgroundColor: colors.white, borderColor: colors.border }]}
                    onPress={() => router.push(`/(customer)/jobs/v2/${job.id}`)}
                  >
                    {job.photos?.length ? (
                      <Image source={{ uri: resolveImageUri(job.photos[0]) }} style={styles.jobCardImg} />
                    ) : (
                      <View style={[styles.jobCardImg, styles.jobCardImgPlaceholder, { backgroundColor: colors.amberBg }]}>
                        <Ionicons name="build-outline" size={20} color={colors.amber} />
                      </View>
                    )}
                    <View style={styles.jobCardBody}>
                      <Text style={[styles.jobCardCat, { color: colors.amberDark }]} numberOfLines={1}>
                        {job.categoryName || 'Maintenance job'}
                      </Text>
                      <Text style={[styles.jobCardTitle, { color: colors.ink }]} numberOfLines={2}>{job.title}</Text>
                      <Text style={[styles.jobCardMeta, { color: colors.muted }]}>
                        {job.ref}
                        {job.aiEstimate?.priceRange ? ` • Estimate Rs ${job.aiEstimate.priceRange.min?.toLocaleString?.()} – ${job.aiEstimate.priceRange.max?.toLocaleString?.()}` : (job.budgetAmount ? ` • Budget Rs ${Number(job.budgetAmount).toLocaleString()}` : '')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
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
                      <Text style={[styles.dateSepText, { color: colors.muted }]}>{formatDate(item.createdAt || item.updatedAt)}</Text>
                    </View>
                  )}
                  {flagged && !isUser && (
                    <View style={[styles.flagBanner, { backgroundColor: colors.amber + '15', borderColor: colors.amber + '30' }]}>
                      <Ionicons name="shield-checkmark" size={12} color={colors.amber} />
                      <Text style={[styles.flagBannerText, { color: colors.ink }]}>Reminder: all payments must go through Maintainex</Text>
                    </View>
                  )}
                  <View style={[styles.messageWrap, { maxWidth: '78%' }, isUser ? styles.messageSent : styles.messageReceived]}>
                    <View style={[styles.messageBubble, isUser ? { backgroundColor: colors.amber, borderBottomRightRadius: 4 } : { backgroundColor: colors.white, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border }]}>
                      <Text style={[styles.messageText, { color: isUser ? '#111827' : colors.ink }]}>{item.text}</Text>
                    </View>
                    <View style={[styles.messageFooter, isUser ? styles.footerSent : styles.footerReceived]}>
                      <Text style={[styles.messageTime, { color: colors.muted }]}>{formatTime(item.createdAt || item.updatedAt)}</Text>
                      {isUser && (
                        item.status === 'sending' ? (
                          <Ionicons name="time-outline" size={11} color={colors.muted} />
                        ) : item.status === 'failed' ? (
                          <TouchableOpacity onPress={() => retrySend(item)}>
                            <Ionicons name="alert-circle" size={11} color="#EF4444" />
                          </TouchableOpacity>
                        ) : (
                          <Ionicons name="checkmark" size={11} color={colors.muted} />
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
          <View style={[styles.closedInputBar, { borderTopColor: colors.border, backgroundColor: '#FEF2F2' }]}>
            <Ionicons name="lock-closed" size={14} color="#DC2626" />
            <Text style={[styles.closedInputText, { color: '#991B1B' }]}>{t('chat.conversationClosed')}</Text>
          </View>
        ) : (
          <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.white }]}>
            {preWarn.length > 0 && (
              <View style={[styles.flagBanner, { backgroundColor: colors.amber + '15', borderColor: colors.amber + '30' }]}>
                <Ionicons name="shield-checkmark" size={12} color={colors.amber} />
                <Text style={[styles.flagBannerText, { color: colors.ink }]}>{preWarn.join(' · ')}</Text>
              </View>
            )}
            <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.ink }]}
                value={inputText}
                onChangeText={(t) => { setInputText(t); setPreWarn(detectWarnings(t)) }}
                placeholder={t('chat.inputPlaceholder')}
                placeholderTextColor={colors.muted}
                multiline
              />
            </View>
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: inputText.trim() ? colors.amber : colors.border }]}
              onPress={sendMessage}
              disabled={!inputText.trim() || sending}
              activeOpacity={0.7}
            >
              <Ionicons name="send" size={16} color={inputText.trim() ? '#111827' : colors.muted} />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
