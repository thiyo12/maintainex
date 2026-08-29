import { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../lib/ThemeContext'
import { notifications } from '../../lib/api'
import { useTranslation } from 'react-i18next'
import { fonts } from '../../lib/fonts'

export default function NotificationsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const colors = useColors()
  const styles = makeStyles(colors)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await notifications.list()
      setItems(data)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const markAll = async () => {
    await notifications.markAllRead()
    load()
  }

  const openItem = async (item: any) => {
    if (!item.read) {
      setItems(prev => prev.map(n => (n.id === item.id ? { ...n, read: true } : n)))
      notifications.markRead(item.id).catch(() => {})
    }
    const d = item.data
    if (d?.jobId) router.push(`/(tasker)/jobs/v2/manage/${d.jobId}` as any)
  }

  const unread = items.filter(i => !i.read).length

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.ink }]}>{t('profile.notifications')}</Text>
        {unread > 0 ? (
          <TouchableOpacity onPress={markAll} style={styles.markAll}>
            <Text style={styles.markAllText}>{t('components.markAllRead')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 64 }} />
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 12 }}>
          <Ionicons name="notifications-off-outline" size={48} color={colors.muted} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>{t('common.noResults')}</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.primary} />
          }
        >
          <View style={styles.list}>
            {items.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, !item.read && { backgroundColor: colors.amberLight }]}
                activeOpacity={0.8}
                onPress={() => openItem(item)}
              >
                <View style={styles.cardTop}>
                  <Text style={[styles.cardTitle, { color: colors.ink }, !item.read && styles.cardTitleUnread]}>
                    {item.title}
                  </Text>
                  {!item.read && <View style={styles.dot} />}
                </View>
                {item.body ? <Text style={[styles.cardBody, { color: colors.muted }]}>{item.body}</Text> : null}
                <Text style={[styles.time, { color: colors.muted }]}>
                  {new Date(item.createdAt).toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 17, fontFamily: fonts.headingBold },
  markAll: { paddingVertical: 6, paddingHorizontal: 10 },
  markAllText: { fontSize: 13, fontFamily: fonts.headingBold, color: colors.amberDark },
  emptyText: { fontSize: 15, fontFamily: fonts.bodyMedium, textAlign: 'center' },
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 14, padding: 16, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: fonts.headingBold },
  cardTitleUnread: { color: colors.ink },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amberDark },
  cardBody: { fontSize: 13, fontFamily: fonts.bodyLight, lineHeight: 19, opacity: 0.9 },
  time: { fontSize: 11, fontFamily: fonts.bodyLight, opacity: 0.6, marginTop: 4 },
})