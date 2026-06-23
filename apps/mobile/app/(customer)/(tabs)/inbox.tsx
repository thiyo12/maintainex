import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Animated, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { conversations } from '../../../lib/api'
import { useColors } from '../../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import PressScale from '../../../components/find/PressScale'

export default function CustomerInbox() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [conversationsData, setConversationsData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const data = await conversations.list()
      setConversationsData(data)
    } catch {
      // fail silently
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const CLOSED_STATUSES = ['COMPLETED', 'CANCELLED', 'REJECTED']
  const activeConversations = conversationsData.filter(c => !c.jobStatus || !CLOSED_STATUSES.includes(c.jobStatus))
  const filtered = activeConversations.filter(c =>
    c.otherUser?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const formatTime = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    if (diffDays === 1) return t('common.yesterday')
    return date.toLocaleDateString()
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>{t('customer.messages')}</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.muted} style={{ marginRight: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('customer.searchMessages')}
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.customerAccent} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchData} tintColor={colors.customerAccent} />}
          renderItem={({ item }) => (
            <PressScale onPress={() => router.push(`/(chat)/${item.id}`)}>
              <View style={styles.conversationCard}>
              <View style={styles.avatarWrap}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.otherUser?.name?.[0] || '?'}
                  </Text>
                </View>
              </View>
              <View style={styles.content}>
                <View style={styles.topRow}>
                  <Text style={styles.name}>{item.otherUser?.name || t('customer.unknown')}</Text>
                  <Text style={styles.time}>{formatTime(item.updatedAt)}</Text>
                </View>
                <View style={styles.bottomRow}>
                  <Text style={[styles.lastMsg, item.unreadCount > 0 && styles.lastMsgUnread]} numberOfLines={1}>
                    {item.lastMessage?.text || ''}
                  </Text>
                  {item.unreadCount > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{item.unreadCount}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
            </PressScale>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.lightGray} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>{t('customer.noMessages')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  topBar: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  heading: { fontSize: 28, fontWeight: '800', color: colors.ink },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 24,
    paddingHorizontal: 16,
    borderRadius: 14,
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink },
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
    backgroundColor: colors.customerAccent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.white },
  content: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  time: { fontSize: 11, color: colors.muted },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMsg: { fontSize: 13, color: colors.muted, flex: 1, marginRight: 8 },
  lastMsgUnread: { fontWeight: '600', color: colors.ink },
  unreadBadge: {
    backgroundColor: colors.warning,
    minWidth: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
  },
  unreadText: { fontSize: 11, fontWeight: '700', color: colors.white },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.ink },
})
