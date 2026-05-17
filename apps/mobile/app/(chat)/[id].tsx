import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const colors = {
  primary: '#F59E0B',
  purple: '#7C3AED',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  white: '#FFFFFF',
  green: '#10B981',
}

const initialMessages: { id: string; text: string; sender: 'user' | 'other'; time: string }[] = [
  { id: '1', text: 'Hi, I can take this job today', sender: 'other', time: '2:15 PM' },
  { id: '2', text: 'Great! When can you come?', sender: 'user', time: '2:16 PM' },
  { id: '3', text: 'I can be there in 30 minutes', sender: 'other', time: '2:17 PM' },
  { id: '4', text: 'Perfect, see you soon', sender: 'user', time: '2:18 PM' },
  { id: '5', text: 'I\'ll arrive in 15 minutes', sender: 'other', time: '2:30 PM' },
]

export default function ChatDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const [messages, setMessages] = useState(initialMessages)
  const [inputText, setInputText] = useState('')
  const flatListRef = useRef<FlatList>(null)

  useFocusEffect(
    useCallback(() => {
      const interval = setInterval(() => {
        setMessages(prev => [...prev])
      }, 5000)
      return () => clearInterval(interval)
    }, [])
  )

  const sendMessage = () => {
    if (!inputText.trim()) return
    const newMsg = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user' as const,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages(prev => [...prev, newMsg])
    setInputText('')
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.topInfo}>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarText}>K</Text>
          </View>
          <View>
            <Text style={styles.chatName}>Kamal Perera</Text>
            <Text style={styles.chatStatus}>🟢 Online</Text>
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
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          renderItem={({ item }) => (
            <View style={[styles.messageWrap, item.sender === 'user' ? styles.messageSent : styles.messageReceived]}>
              <View style={[styles.messageBubble, item.sender === 'user' ? styles.bubbleSent : styles.bubbleReceived]}>
                <Text style={[styles.messageText, item.sender === 'user' && styles.messageTextSent]}>
                  {item.text}
                </Text>
              </View>
              <Text style={[styles.messageTime, item.sender === 'user' ? styles.timeSent : styles.timeReceived]}>
                {item.time}
              </Text>
            </View>
          )}
        />

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
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  topInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.purple,
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
    backgroundColor: colors.purple,
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
    backgroundColor: colors.purple,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
})
