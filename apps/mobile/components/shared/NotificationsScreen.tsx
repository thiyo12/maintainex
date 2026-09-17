import { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { CaretLeft, BellSlash, Wrench, Wallet, ChatCircleDots, Bell } from 'phosphor-react-native'
import { useColors } from '../../lib/ThemeContext'
import { notifications } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useTranslation } from 'react-i18next'
import { fonts } from '../../lib/fonts'

export default function NotificationsScreen({ showBack = true, titleKey = 'profile.notifications' }: { showBack?: boolean; titleKey?: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const colors = useColors()
  const styles = makeStyles(colors)
  const { user } = useAuth()
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

  const typeMeta = (refType?: string | null): { icon: any; tint: string; bg: string } => {
    switch (refType) {
      case 'JOB':
      case 'QUOTE':
        return { icon: Wrench, tint: colors.blue, bg: colors.blueBg }
      case 'WALLET':
        return { icon: Wallet, tint: colors.success, bg: colors.successBg }
      case 'CHAT':
        return { icon: ChatCircleDots, tint: colors.purple, bg: colors.purpleBg }
      default:
        return { icon: Bell, tint: colors.amber, bg: colors.amberBg }
    }
  }

  const routeFor = (refType?: string | null, refId?: string | null): any => {
    const role = user?.role
    switch (refType) {
      case 'JOB':
      case 'QUOTE':
        if (role === 'TASKER') return `/(tasker)/jobs/v2/manage/${refId}`
        if (role === 'COMPANY') return `/(company)/jobs/v2/manage/${refId}`
        return `/(customer)/jobs/v2/${refId}`
      case 'WALLET':
        if (role === 'TASKER') return '/(tasker)/wallet/withdraw'
        if (role === 'COMPANY') return '/(company)/(tabs)/earnings-list'
        return '/(customer)/wallet'
      case 'CHAT':
        return refId ? `/(chat)/${refId}` : '/(chat)'
      default:
        return null
    }
  }

  const openItem = (item: any) => {
    if (!item.read) {
      setItems(prev => prev.map(n => (n.id === item.id ? { ...n, read: true } : n)))
      notifications.markRead(item.id).catch(() => {})
    }
    const route = routeFor(item.data?.referenceType, item.data?.referenceId)
    if (route) router.push(route)
  }

  const unread = items.filter(i => !i.read).length

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        {showBack ? (
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <CaretLeft size={22} color={colors.ink} weight="bold" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 32 }} />
        )}
        <Text style={[styles.title, { color: colors.ink }]}>{t(titleKey)}</Text>
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
          <BellSlash size={48} color={colors.muted} />
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
            {items.map(item => {
              const refType = item.data?.referenceType
              const meta = typeMeta(refType)
              const IconComponent = meta.icon
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.card, !item.read && { backgroundColor: colors.amberLight }]}
                  activeOpacity={0.8}
                  onPress={() => openItem(item)}
                >
                  <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
                    <IconComponent size={18} color={meta.tint} />
                  </View>
                  <View style={{ flex: 1 }}>
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
                  </View>
                </TouchableOpacity>
              )
            })}
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
  card: { flexDirection: 'row', borderRadius: 14, padding: 16, gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: fonts.headingBold },
  cardTitleUnread: { color: colors.ink },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amberDark },
  cardBody: { fontSize: 13, fontFamily: fonts.bodyLight, lineHeight: 19, opacity: 0.9, marginTop: 2 },
  time: { fontSize: 11, fontFamily: fonts.bodyLight, opacity: 0.6, marginTop: 4 },
})
