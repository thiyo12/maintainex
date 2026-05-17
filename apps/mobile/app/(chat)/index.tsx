import { useState, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
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

const initialConversations = [
  { id: '1', name: 'Kamal Perera', role: 'Plumber', lastMsg: 'I\'ll arrive in 15 minutes', unread: 2, online: true, time: '2:30 PM', avatar: 'K' },
  { id: '2', name: 'Saman Fernando', role: 'Electrician', lastMsg: 'Yes, I can do it tomorrow morning', unread: 0, online: false, time: '11:20 AM', avatar: 'S' },
  { id: '3', name: 'Nimal Silva', role: 'Painter', lastMsg: 'Thanks for the job! Here are the photos', unread: 1, online: true, time: 'Yesterday', avatar: 'N' },
  { id: '4', name: 'Support Team', role: 'Maintainex', lastMsg: 'Your dispute has been received', unread: 0, online: true, time: 'Yesterday', avatar: 'M' },
]

export default function ChatListScreen() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [conversations, setConversations] = useState(initialConversations)

  useFocusEffect(
    useCallback(() => {
      const interval = setInterval(() => {
        setConversations(prev => [...prev])
      }, 10000)
      return () => clearInterval(interval)
    }, [])
  )

  const filtered = conversations.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Chats</Text>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations"
          placeholderTextColor={colors.gray}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.conversationCard}
            onPress={() => router.push(`/(chat)/${item.id}`)}
          >
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.avatar}</Text>
              </View>
              {item.online ? <View style={styles.onlineDot} /> : null}
            </View>
            <View style={styles.conversationContent}>
              <View style={styles.conversationTop}>
                <Text style={styles.conversationName}>{item.name}</Text>
                <Text style={styles.conversationTime}>{item.time}</Text>
              </View>
              <View style={styles.conversationBottom}>
                <Text style={[styles.lastMsg, item.unread > 0 && styles.lastMsgUnread]} numberOfLines={1}>
                  {item.lastMsg}
                </Text>
                {item.unread > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unread}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.roleText}>{item.role}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySub}>When you book a service, chat will appear here</Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  topBar: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 24,
    paddingHorizontal: 16,
    borderRadius: 14,
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    marginBottom: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: colors.dark },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 24,
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  avatarWrap: { position: 'relative', marginRight: 14 },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.purple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.white },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: colors.green, borderWidth: 2, borderColor: colors.white,
  },
  conversationContent: { flex: 1 },
  conversationTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  conversationName: { fontSize: 15, fontWeight: '700', color: colors.dark },
  conversationTime: { fontSize: 11, color: colors.gray },
  conversationBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMsg: { fontSize: 13, color: colors.gray, flex: 1, marginRight: 8 },
  lastMsgUnread: { fontWeight: '600', color: colors.dark },
  unreadBadge: {
    backgroundColor: colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { fontSize: 11, fontWeight: '700', color: colors.white },
  roleText: { fontSize: 11, color: colors.gray, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.dark, marginBottom: 6 },
  emptySub: { fontSize: 13, color: colors.gray, textAlign: 'center', paddingHorizontal: 32 },
})
