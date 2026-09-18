import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInUp } from 'react-native-reanimated'
import { Briefcase, Money, ChatCircle, Info, Checks, BellSlash, CaretRight } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import { notifications } from '../../../lib/api'
import { v3 } from '../../../theme/v3/tokens'

import PressableScale from '../../../components/ui/PressableScale'
import EmptyState from '../../../components/ui/EmptyState'

interface AppNotification {
  id: string
  userId: string
  title: string
  body: string
  data?: Record<string, string> | null
  read: boolean
  createdAt: string
}

type NotifType = 'job_update' | 'payment' | 'message' | 'system'

const TYPE_META: Record<NotifType, { icon: any; color: string }> = {
  job_update: { icon: Briefcase, color: '#F5A623' },
  payment: { icon: Money, color: '#06C167' },
  message: { icon: ChatCircle, color: '#276EF1' },
  system: { icon: Info, color: '#6F6B6B' },
}

function detectType(n: AppNotification): NotifType {
  const refType = (n.data?.referenceType || '').toUpperCase()
  const hay = `${n.title} ${n.body}`.toLowerCase()
  if (/message|chat|inbox/i.test(hay) || refType === 'CHAT') return 'message'
  if (/payment|escrow|payout|deposited|released|wallet|refund|funded/i.test(hay) || refType === 'WALLET') return 'payment'
  if (/job|quote|customer|provider|tasker|completed|started|accepted|cancelled|review/i.test(hay) || refType === 'JOB') return 'job_update'
  return 'system'
}

function useRelativeTime(t: (k: string, opts?: any) => string) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])
  return useCallback((iso: string): string => {
    const diff = Math.max(0, now - new Date(iso).getTime())
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return t('notifications.justNow')
    if (mins < 60) return t('notifications.minutesAgo', { n: mins })
    const hours = Math.floor(mins / 60)
    if (hours < 24) return t('notifications.hoursAgo', { n: hours })
    const days = Math.floor(hours / 24)
    if (days < 7) return t('notifications.daysAgo', { n: days })
    return new Date(iso).toLocaleDateString()
  }, [now])
}

export default function NotificationsScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const [list, setList] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const relative = useRelativeTime(t)

  const loadList = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      const res = await notifications.list()
      setList(res)
    } catch {
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadList()
    const timer = setInterval(loadList, 60000)
    return () => clearInterval(timer)
  }, [loadList])

  const openNotification = async (n: AppNotification) => {
    if (!n.read) {
      notifications.markRead(n.id).catch(() => {})
      setList((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)))
    }
    const type = detectType(n)
    if (type === 'message') {
      router.push('/(chat)' as any)
    } else if (n.data?.referenceType === 'JOB' && n.data?.referenceId) {
      router.push(`/(customer)/jobs/v2/${n.data.referenceId}` as any)
    }
  }

  const markAll = async () => {
    await notifications.markAllRead().catch(() => {})
    setList((prev) => prev.map((item) => ({ ...item, read: true })))
  }

  const unreadCount = list.filter((n) => !n.read).length

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>{t('notifications.title')}</Text>
        {unreadCount > 0 ? (
          <PressableScale onPress={markAll} scaleTo={0.95} style={styles.markAllPress}>
            <View style={styles.markAllBtn}>
              <Checks size={16} color={'#F5A623'} weight="bold" />
              <Text style={styles.markAllText}>{t('notifications.markAllRead')}</Text>
            </View>
          </PressableScale>
        ) : null}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadList(true)} tintColor={'#F5A623'} />}
      >
        {!loading && list.length === 0 ? (
          <EmptyState
            title={t('notifications.emptyTitle')}
            subtitle={t('notifications.emptySub')}
            FallbackIcon={BellSlash}
          />
        ) : (
          <View style={styles.list}>
            {list.map((n, i) => {
              const type = detectType(n)
              const meta = TYPE_META[type]
              const Icon = meta.icon
              return (
                <Animated.View key={n.id} entering={FadeInUp.delay(Math.min(i * 50, 400)).springify().damping(20).stiffness(300)}>
                  <PressableScale onPress={() => openNotification(n)} scaleTo={0.98} style={styles.cardPress}>
                    <View style={[styles.card, !n.read && styles.cardUnread]}>
                      {!n.read ? <View style={styles.unreadDot} /> : null}
                      <View style={[styles.iconBox, { backgroundColor: meta.color + '18' }]}>
                        <Icon size={22} color={meta.color} weight={n.read ? 'regular' : 'fill'} />
                      </View>
                      <View style={styles.body}>
                        <Text style={[styles.title, !n.read && styles.titleUnread]} numberOfLines={2}>{n.title}</Text>
                        {n.body ? (
                          <Text style={styles.text} numberOfLines={2}>{n.body}</Text>
                        ) : null}
                        <Text style={styles.time}>{relative(n.createdAt)}</Text>
                      </View>
                      <CaretRight size={14} color={'#6B6B6B'} weight="bold" />
                    </View>
                  </PressableScale>
                </Animated.View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, marginBottom: 16,
  },
  pageTitle: { fontSize: 28, fontFamily: 'Outfit_900Black', color: v3.colors.ink, letterSpacing: -0.5 },
  markAllPress: { borderRadius: 999 },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: v3.colors.amberSoft },
  markAllText: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: v3.colors.amberDark },

  scroll: { paddingBottom: 32, paddingHorizontal: 16 },
  list: { gap: 8 },

  cardPress: { borderRadius: 14 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', padding: 16, borderRadius: 14,
    backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line,
  },
  cardUnread: {
    borderWidth: 1.5, borderColor: v3.colors.amber, backgroundColor: v3.colors.amberSoft,
  },
  unreadDot: { position: 'absolute', top: 14, right: 14, width: 8, height: 8, borderRadius: 4, backgroundColor: v3.colors.amber },
  iconBox: { width: 46, height: 46, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, marginLeft: 16, marginRight: 16 },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: v3.colors.ink },
  titleUnread: { color: v3.colors.ink },
  text: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: v3.colors.textSecondary, marginTop: 2, lineHeight: 18 },
  time: { fontSize: 11, fontFamily: 'Outfit_500Medium', color: v3.colors.textMuted, marginTop: 6 },
})
