import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Animated, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Wrench,
  Lightning,
  Images,
  ChatCircleDots,
  Star,
  ShieldCheck,
  CheckCircle,
  CaretRight,
  Wallet,
  Bell,
  UserCircle,
  SignOut,
  CreditCard,
  Medal,
  Shield,
} from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../lib/ThemeContext'
import { taskers, getAuthToken, conversations, notifications } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import type { TaskerProfile } from '../../../lib/types'
import ProfileHeader from '../../../components/ProfileHeader'
import { fonts } from '../../../lib/fonts'
import OfferProgramSection from '../../../components/offers/OfferProgramSection'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

type TaskerProfileView = TaskerProfile & {
  completionRate?: number
  experienceYears?: number
  reviews?: Array<{ reviewerName?: string; rating?: number; comment?: string }>
}

function useSlideUp(delay = 0) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 450, delay, useNativeDriver: true }).start()
  }, [])
  return {
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  }
}

function usePopIn(delay = 0) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay, useNativeDriver: true, friction: 7, tension: 60 }).start()
  }, [])
  return {
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
  }
}

export default function TaskerProfile() {
  const { t } = useTranslation()
  const router = useRouter()
  const colors = useColors()
  const styles = makeStyles(colors)
  const { user, logout } = useAuth()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<TaskerProfileView | null>(null)
  const [identityStatus, setIdentityStatus] = useState<string>('NOT_SUBMITTED')
  const [unreadMsgs, setUnreadMsgs] = useState(0)
  const [unreadNotifs, setUnreadNotifs] = useState(0)

  const cardAnim = useSlideUp(0)
  const sectionAnim2 = useSlideUp(80)
  const sectionAnim3 = useSlideUp(130)
  const sectionAnim4 = useSlideUp(180)
  const sectionAnim5 = useSlideUp(230)
  const popIn0 = usePopIn(80)
  const popIn1 = usePopIn(120)
  const popIn2 = usePopIn(160)
  const popIn3 = usePopIn(200)
  const popIn4 = usePopIn(240)
  const popIn5 = usePopIn(280)
  const popIn6 = usePopIn(320)
  const popIn7 = usePopIn(360)
  const popIn8 = usePopIn(400)
  const popIn9 = usePopIn(440)
  const popIn10 = usePopIn(480)
  const popIn11 = usePopIn(520)
  const popIns = [popIn0, popIn1, popIn2, popIn3, popIn4, popIn5, popIn6, popIn7, popIn8, popIn9, popIn10, popIn11]
  let popInIdx = 0

  useEffect(() => {
    loadProfile()
    loadIdentity()
  }, [])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    const loadCounts = async () => {
      try {
        const [convos, notifs] = await Promise.all([
          conversations.list(),
          notifications.list(),
        ])
        const msgs = (convos || []).reduce((n: number, c: any) => n + (c.unreadCount || 0), 0)
        setUnreadMsgs(msgs)
        setUnreadNotifs((notifs || []).filter((n: any) => !n.read).length)
      } catch {}
    }
    loadCounts()
    interval = setInterval(loadCounts, 30000)
    return () => { if (interval) clearInterval(interval) }
  }, [])

  const handleLogout = () => {
    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: async () => {
        await logout()
        router.replace('/(auth)/welcome')
      } },
    ])
  }

  async function loadProfile() {
    if (!user?.id) return
    try {
      const data = await taskers.get(user.id)
      setProfile(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function loadIdentity() {
    try {
      const token = await getAuthToken()
      const res = await fetch(`${API_URL}/api/mobile/v2/identity`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setIdentityStatus(data.identityStatus)
      }
    } catch (e) {
      console.error('Load identity error:', e)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.amber} />
        </View>
      </SafeAreaView>
    )
  }

  const name = profile?.user?.name || user?.name || t('customer.tasker')
  const nickname = profile?.user?.nickname || user?.nickname || ''
  const initials = name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase() || 'T'
  const skills = profile?.skills || []
  const rating = profile?.rating || 0
  const completedJobs = profile?.completedJobs || 0
  const serviceAreas = Array.isArray(profile?.serviceAreas) ? profile.serviceAreas : []
  const reviews = (Array.isArray(profile?.reviews) ? profile.reviews : []).map((review: any) => ({
    initials: String(review.reviewerName || 'C').split(' ').map((part: string) => part[0]).join('').slice(0, 2).toUpperCase(),
    name: review.reviewerName || 'Customer',
    stars: Math.max(0, Math.min(5, Number(review.rating || 0))),
    text: review.comment || '',
  }))

  const verifications = [
    { icon: 'card', title: 'Identity verification', sub: 'Government ID review', done: identityStatus === 'APPROVED' || identityStatus === 'VERIFIED' },
    { icon: 'ribbon', title: 'Service skills', sub: skills.length > 0 ? `${skills.length} selected` : 'Add your services', done: skills.length > 0 },
    { icon: 'shield', title: 'Service area', sub: serviceAreas.length > 0 ? serviceAreas.join(', ') : 'Add where you work', done: serviceAreas.length > 0 },
  ] as const

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ProfileHeader
          initials={initials}
          name={name}
          nickname={nickname}
          roleLabel={`${skills[0] || 'Independent tasker'}${serviceAreas[0] ? ` · ${serviceAreas[0]}` : ''}`}
          variant="tasker"
          verified={identityStatus === 'APPROVED' || identityStatus === 'VERIFIED'}
          onEdit={() => router.push('/(tasker)/settings/edit-profile')}
          onSettings={() => router.push('/notifications')}
        />

        <Animated.View style={[styles.card, cardAnim]}>
          <View style={styles.statsRow}>
            {[{ val: completedJobs, lbl: t('tasker.jobsDone') }, { val: rating ? rating.toFixed(1) : 'New', lbl: t('tasker.rating') }, { val: `${Number(profile?.completionRate || 0)}%`, lbl: t('tasker.active') }, { val: profile?.experienceYears ? `${profile.experienceYears}yr` : '—', lbl: t('profile.experience') }].map((s) => (
              <Animated.View key={s.lbl} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }, popIns[popInIdx++]]}>
                <Text style={[styles.statValue, { color: colors.ink }]}>{s.val}</Text>
                <Text style={[styles.statLabel, { color: colors.muted }]}>{s.lbl}</Text>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        <Animated.View style={[styles.card, sectionAnim2]}>
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Wrench size={14} color={colors.amberDark} />
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('tasker.yourSkills')}</Text>
            </View>
            <View style={styles.chipRow}>
              {skills.length > 0 ? skills.map((s: string) => (
                <Animated.View key={s} style={[styles.chip, { backgroundColor: colors.amberBg }, popIns[popInIdx++]]}>
                  <Lightning size={12} color={colors.amberDark} />
                  <Text style={[styles.chipText, { color: colors.amberDark }]}>{s}</Text>
                </Animated.View>
              )) : <Text style={styles.emptyText}>Add services to receive matching jobs.</Text>}
            </View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.card, sectionAnim3]}>
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Images size={14} color={colors.amberDark} />
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('tasker.yourSkills')}</Text>
            </View>
            <Text style={styles.emptyText}>Completed-work photos will appear here when you add job evidence.</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.card, sectionAnim4]}>
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <ChatCircleDots size={14} color={colors.amberDark} />
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('tasker.reviews')}</Text>
            </View>
            {reviews.map((rev: any, i: number) => (
              <View key={i} style={[styles.revItem, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={[styles.revAvt, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.revAvtText, { color: colors.ink }]}>{rev.initials}</Text>
                </View>
                <View style={styles.revBody}>
                  <View style={styles.revTop}>
                    <Text style={[styles.revName, { color: colors.ink }]}>{rev.name}</Text>
                    <View style={styles.revStars}>
                      {Array.from({ length: 5 }).map((_, si) => (
                        <Star key={si} size={11} color={colors.amber} weight={si < rev.stars ? 'fill' : 'regular'} />
                      ))}
                    </View>
                  </View>
                  <Text style={[styles.revText, { color: colors.muted }]}>"{rev.text}"</Text>
                </View>
              </View>
            ))}
            {reviews.length === 0 ? <Text style={styles.emptyText}>Customer reviews will appear here after completed work.</Text> : null}
          </View>
        </Animated.View>

        <Animated.View style={[styles.card, sectionAnim5, { marginBottom: 24 }]}>
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <ShieldCheck size={14} color={colors.amberDark} />
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('tasker.identityVerification')}</Text>
            </View>
            {verifications.map((v, i) => (
              <View key={i} style={[styles.verifRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={[styles.verifIcon, v.done ? { backgroundColor: '#D1FAE5' } : { backgroundColor: colors.amberLight }]}>
                  {v.icon === 'card' && <CreditCard size={16} color={v.done ? '#059669' : colors.amberDark} />}
                  {v.icon === 'ribbon' && <Medal size={16} color={v.done ? '#059669' : colors.amberDark} />}
                  {v.icon === 'shield' && <Shield size={16} color={v.done ? '#059669' : colors.amberDark} />}
                </View>
                <View style={styles.verifText}>
                  <Text style={[styles.verifTitle, { color: colors.ink }]}>{v.title}</Text>
                  <Text style={[styles.verifSub, { color: colors.muted }]}>{v.sub}</Text>
                </View>
                <Text style={[styles.verifStatus, { color: v.done ? '#059669' : colors.amberDark }]}>
                  {v.done ? t('common.done') : t('tasker.pending')}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <OfferProgramSection variant="tasker" taskerId={user?.id} />

        <Animated.View style={[styles.card, { marginBottom: 24 }]}>
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={() => router.push('/(tasker)/readiness' as any)}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#FEF3C7' }]}>
                <CheckCircle size={16} color="#D97706" />
              </View>
              <Text style={[styles.menuTitle, { color: colors.ink }]}>{t('readiness.title')}</Text>
              <CaretRight size={16} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={() => router.push('/(tasker)/(tabs)/earnings')}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#D1FAE5' }]}>
                <Wallet size={16} color="#059669" />
              </View>
              <Text style={[styles.menuTitle, { color: colors.ink }]}>Earnings</Text>
              <CaretRight size={16} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={() => router.push('/(tasker)/settings/job-selection')}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.amberLight }]}>
                <Wrench size={16} color={colors.amberDark} />
              </View>
              <Text style={[styles.menuTitle, { color: colors.ink }]}>Your Services</Text>
              <CaretRight size={16} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={() => router.push('/(chat)' as any)}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#DBEAFE' }]}>
                <ChatCircleDots size={16} color="#2563EB" />
              </View>
              <Text style={[styles.menuTitle, { color: colors.ink }]}>{t('profile.messages')}</Text>
              {unreadMsgs > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.amberDark }]}>
                  <Text style={styles.badgeText}>{unreadMsgs > 99 ? '99+' : unreadMsgs}</Text>
                </View>
              )}
              <CaretRight size={16} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={() => router.push('/notifications' as any)}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#FEF3C7' }]}>
                <Bell size={16} color="#D48900" />
              </View>
              <Text style={[styles.menuTitle, { color: colors.ink }]}>{t('profile.notifications')}</Text>
              {unreadNotifs > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.amberDark }]}>
                  <Text style={styles.badgeText}>{unreadNotifs > 99 ? '99+' : unreadNotifs}</Text>
                </View>
              )}
              <CaretRight size={16} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuRow} onPress={() => router.push('/settings/my-profile')}>
              <View style={[styles.menuIcon, { backgroundColor: '#EDE9FE' }]}>
                <UserCircle size={16} color="#7C3AED" />
              </View>
              <Text style={[styles.menuTitle, { color: colors.ink }]}>{t('tasker.myProfile')}</Text>
              <CaretRight size={16} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuRow} onPress={handleLogout}>
              <View style={[styles.menuIcon, { backgroundColor: '#FEE2E2' }]}>
                <SignOut size={16} color="#DC2626" />
              </View>
              <Text style={[styles.menuTitle, { color: '#DC2626' }]}>{t('profile.logout')}</Text>
              <CaretRight size={16} color={colors.muted} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 22,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 4,
    overflow: 'hidden',
  },
  statsRow: { flexDirection: 'row', padding: 16, gap: 10 },
  statCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  statValue: { fontSize: 17, fontFamily: fonts.headingBold, letterSpacing: -0.3 },
  statLabel: { fontSize: 9, fontFamily: fonts.bodyMedium, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },
  section: { padding: 16 },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  menuIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuTitle: { flex: 1, fontSize: 14, fontFamily: fonts.bodyMedium },
  badge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontFamily: fonts.bodyMedium },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 12, fontFamily: fonts.headingBold },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 100,
  },
  chipText: { fontSize: 11, fontFamily: fonts.bodyMedium },
  emptyText: { fontSize: 11, lineHeight: 17, fontFamily: fonts.body, color: colors.muted, paddingVertical: 6 },
  portGrid: { flexDirection: 'row', gap: 8 },
  portItem: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  revItem: { flexDirection: 'row', gap: 10, paddingVertical: 12 },
  revAvt: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  revAvtText: { fontSize: 12, fontFamily: fonts.headingBold },
  revBody: { flex: 1 },
  revTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  revName: { fontSize: 12, fontFamily: fonts.headingBold },
  revStars: { flexDirection: 'row', gap: 1 },
  revText: { fontSize: 11, fontFamily: fonts.body, lineHeight: 16, marginTop: 3 },
  verifRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  verifIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  verifText: { flex: 1 },
  verifTitle: { fontSize: 12, fontFamily: fonts.headingBold },
  verifSub: { fontSize: 10, fontFamily: fonts.body, marginTop: 1 },
  verifStatus: { fontSize: 10, fontFamily: fonts.headingBold, textTransform: 'uppercase', letterSpacing: 0.4 },
})
