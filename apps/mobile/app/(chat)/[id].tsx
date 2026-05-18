import { useState, useRef, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { conversations, auth } from '../../lib/api'
import { colors } from '../../lib/colors'

export default function ChatDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const [messages, setMessages] = useState<any[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [otherUserName, setOtherUserName] = useState('')
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
      if (data.participants?.length > 0 && !otherUserName) {
        const other = data.participants.find((p: any) => p.id !== userId)
        if (other) setOtherUserName(other.name || '')
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false)
    }
  }, [id, userId, otherUserName])

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
    if (!inputText.trim()) return
    const text = inputText.trim()
    const optimisticMsg = {
      id: Date.now().toString(),
      text,
      senderId: userId,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimisticMsg])
    setInputText('')
    try {
      await conversations.sendMessage(id as string, text)
    } catch {
      // fail silently
    }
  }

  const formatTime = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.topInfo}>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarText}>{otherUserName?.[0] || '?'}</Text>
          </View>
          <View>
            <Text style={styles.chatName}>{otherUserName || 'Chat'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green, marginRight: 4 }} />
              <Text style={styles.chatStatus}>Online</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity>
          <Text style={styles.moreIcon}>⋯</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.customerAccent} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id || Math.random().toString()}
            contentContainerStyle={styles.messagesContainer}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            renderItem={({ item }) => {
              const isUser = userId ? item.senderId === userId : false
              return (
                <View style={[styles.messageWrap, isUser ? styles.messageSent : styles.messageReceived]}>
                  <View style={[styles.messageBubble, isUser ? styles.bubbleSent : styles.bubbleReceived]}>
                    <Text style={[styles.messageText, isUser && styles.messageTextSent]}>
                      {item.text}
                    </Text>
                  </View>
                  <Text style={[styles.messageTime, isUser ? styles.timeSent : styles.timeReceived]}>
                    {formatTime(item.createdAt || item.updatedAt)}
                  </Text>
                </View>
              )
            }}
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={colors.gray}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
            <Text style={styles.sendBtnText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    backgroundColor: colors.white,
  },
  backBtn: { marginRight: 12 },
  backText: { fontSize: 16, color: colors.warning, fontWeight: '600' },
  topInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.customerAccent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: colors.white },
  chatName: { fontSize: 15, fontWeight: '700', color: colors.dark },
  chatStatus: { fontSize: 11, color: colors.green },
  moreIcon: { fontSize: 22, color: colors.gray },
  messagesContainer: { padding: 16, paddingBottom: 8 },
  messageWrap: { marginBottom: 16, maxWidth: '80%' },
  messageSent: { alignSelf: 'flex-end' },
  messageReceived: { alignSelf: 'flex-start' },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  bubbleSent: {
    backgroundColor: colors.customerAccent,
    borderBottomRightRadius: 4,
  },
  bubbleReceived: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  messageText: { fontSize: 15, color: colors.dark, lineHeight: 20 },
  messageTextSent: { color: colors.white },
  messageTime: { fontSize: 11, color: colors.gray, marginTop: 4 },
  timeSent: { textAlign: 'right' },
  timeReceived: { textAlign: 'left' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    backgroundColor: colors.white,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.dark,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: colors.customerAccent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
})
