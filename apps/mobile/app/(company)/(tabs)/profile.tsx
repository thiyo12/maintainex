import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  WarningCircle,
  SquaresFour,
  Briefcase,
  ChatCircleText,
  Star,
  ShieldCheck,
  CaretRight,
  Bell,
  UserCircle,
  Buildings,
  EnvelopeSimple,
  Drop,
  Lightning,
  Snowflake,
  Hammer,
  Wrench,
} from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../lib/ThemeContext'
import { company, conversations, notifications, getAuthToken } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import ProfileHeader from '../../../components/ProfileHeader'
import { fonts } from '../../../lib/fonts'
import OfferProgramSection from '../../../components/offers/OfferProgramSection'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

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

export default function CompanyProfile() {
  const router = useRouter()
  const colors = useColors()
  const styles = makeStyles(colors)
  const { t } = useTranslation()
  const { logout } = useAuth()
  const [loading, setLoading] = useState(true)
  const [identityStatus, setIdentityStatus] = useState('NOT_SUBMITTED')
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
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

  const handleLogout = async () => {
    await logout()
    router.replace('/(auth)/welcome')
  }

  const fetchProfile = useCallback(async () => {
    try {
      const data = await company.profile.get()
      setProfile(data)
    } catch {
      setError(t('errors.generic'))
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
    ;(async () => {
      try {
        const token = await getAuthToken()
        const res = await fetch(`${API_URL}/api/mobile/v2/identity`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setIdentityStatus(data.identityStatus)
        }
      } catch (e) { console.error('Load identity error:', e) }
    })()
  }, [fetchProfile])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    const loadCounts = async () => {
      try {
        const [convos, notifs] = await Promise.all([
          conversations.list(),
          notifications.list(),
        ])
        setUnreadMsgs((convos || []).reduce((n: number, c: any) => n + (c.unreadCount || 0), 0))
        setUnreadNotifs((notifs || []).filter((n: any) => !n.read).length)
      } catch {}
    }
    loadCounts()
    interval = setInterval(loadCounts, 30000)
    return () => { if (interval) clearInterval(interval) }
  }, [])

  if (error && !profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <WarningCircle size={48} color={colors.error} style={{ marginBottom: 16 }} />
          <Text style={{ fontSize: 16, color: colors.muted, textAlign: 'center', marginBottom: 20 }}>{error}</Text>
          <TouchableOpacity style={{ backgroundColor: colors.amber, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }} onPress={() => { setLoading(true); setError(null); fetchProfile() }}>
            <Text style={{ color: colors.ink, fontFamily: fonts.headingBold }}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const name = profile?.companyName || profile?.name || t('profile.company')
  const initials = name ? (name.split(' ').map((s: string) => s[0]).join('').slice(0, 2) || '').toUpperCase() : 'CO'
  const services = profile?.services || []
  const rating = profile?.rating || 0
  const recentContracts = Array.isArray(profile?.recentContracts) ? profile.recentContracts : []
  const activeContracts = recentContracts.filter((contract: any) => !['COMPLETED', 'CANCELLED'].includes(String(contract.status).toUpperCase())).length
  const teamMembers = Array.isArray(profile?.teamMembers) ? profile.teamMembers.length : Number(profile?.teamCount || 0)
  const yearsInBusiness = profile?.createdAt
    ? Math.max(0, Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
    : null
  const inBusiness = profile?.inBusiness || profile?.yearsInBusiness || (yearsInBusiness == null ? '—' : yearsInBusiness < 1 ? '<1yr' : `${yearsInBusiness}yr`)

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.amber} />
        </View>
      </SafeAreaView>
    )
  }

  const activeJobs = recentContracts.slice(0, 3).map((job: any) => ({
    Icon: Briefcase,
    title: job.title || job.name || t('tasker.activeJobs'),
    sub: job.locationName || job.location || job.reference || '',
    status: ['COMPLETED', 'DONE'].includes(String(job.status).toUpperCase())
      ? 'done'
      : ['IN_PROGRESS', 'ASSIGNED', 'ACCEPTED'].includes(String(job.status).toUpperCase())
        ? 'progress'
        : 'open',
  }))

  const statusStyles: Record<string, { bg: string; text: string }> = {
    open: { bg: '#D1FAE5', text: '#059669' },
    progress: { bg: '#DBEAFE', text: '#2563EB' },
    done: { bg: colors.surface, text: colors.muted },
  }

  const statusLabels: Record<string, string> = {
    open: t('jobs.status.open'),
    progress: t('jobs.status.inProgress'),
    done: t('common.done'),
  }

  const reviews = (Array.isArray(profile?.reviews) ? profile.reviews : []).slice(0, 3).map((review: any) => ({
    initials: String(review.reviewerName || review.customerName || 'C').split(' ').map((part: string) => part[0]).join('').slice(0, 2).toUpperCase(),
    name: review.reviewerName || review.customerName || 'Customer',
    stars: Math.max(0, Math.min(5, Number(review.rating || 0))),
    text: review.comment || review.text || '',
  }))

  const verifications = [
    { Icon: Buildings, title: t('company.verificationTitle1'), sub: t('company.verificationSub1'), done: Boolean(profile?.isVerified || profile?.verificationStatus === 'VERIFIED') },
    { Icon: EnvelopeSimple, title: t('company.verificationTitle2'), sub: t('company.verificationSub2'), done: Boolean(profile?.emailVerified) },
  ] as const

  const jobIconComponents: Record<string, any> = {
    [t('categories.plumbing')]: Drop,
    [t('categories.electrical')]: Lightning,
    [t('categories.acRepair')]: Snowflake,
    [t('categories.generalRepairs')]: Hammer,
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ProfileHeader
          initials={initials}
          name={name}
          roleLabel={t('company.roleLabel')}
          variant="company"
          verified={identityStatus === 'APPROVED' || identityStatus === 'VERIFIED'}
          onEdit={() => router.push('/(company)/settings/edit-profile')}
          onSettings={() => router.push('/notifications')}
        />

        <Animated.View style={[styles.card, cardAnim]}>
          <View style={styles.statsRow}>
            {[{ val: activeContracts, lbl: t('profile.jobsPosted') }, { val: rating ? Number(rating).toFixed(1) : 'New', lbl: t('profile.rating') }, { val: teamMembers, lbl: t('company.teamMembers') }, { val: inBusiness, lbl: t('company.inBusiness') }].map((s) => (
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
              <SquaresFour size={14} color={colors.indigo} />
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('tasker.yourSkills')}</Text>
            </View>
            <View style={styles.chipRow}>
              {services.length > 0 ? services.map((s: string) => {
                const IconComp = jobIconComponents[s] || Wrench
                return (
                  <Animated.View key={s} style={[styles.chip, { backgroundColor: colors.amberBg }, popIns[popInIdx++]]}>
                    <IconComp size={12} color={colors.amberDark} />
                    <Text style={[styles.chipText, { color: colors.amberDark }]}>{s}</Text>
                  </Animated.View>
                )
              }) : <Text style={styles.emptyText}>Add the services your company provides so customers can find your team.</Text>}
            </View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.card, sectionAnim3]}>
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Briefcase size={14} color={colors.indigo} />
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('tasker.activeJobs')}</Text>
            </View>
            {activeJobs.map((job: any, i: number) => {
              const st = statusStyles[job.status]
              return (
                <View key={i} style={[styles.jobRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <View style={[styles.jobIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <job.Icon size={15} color={colors.amberDark} />
                  </View>
                  <View style={styles.jobText}>
                    <Text style={[styles.jobTitle, { color: colors.ink }]}>{job.title}</Text>
                    <Text style={[styles.jobSub, { color: colors.muted }]}>{job.sub}</Text>
                  </View>
                  <View style={[styles.jobStatus, { backgroundColor: st.bg }]}>
                    <Text style={[styles.jobStatusText, { color: st.text }]}>{statusLabels[job.status]}</Text>
                  </View>
                </View>
              )
            })}
            {activeJobs.length === 0 ? <Text style={styles.emptyText}>No active company jobs yet.</Text> : null}
          </View>
        </Animated.View>

        <Animated.View style={[styles.card, sectionAnim4]}>
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <ChatCircleText size={14} color={colors.indigo} />
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
              <ShieldCheck size={14} color={colors.indigo} />
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('verify.title')}</Text>
            </View>
            {verifications.map((v, i) => (
              <View key={i} style={[styles.verifRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={[styles.verifIcon, v.done ? { backgroundColor: '#D1FAE5' } : { backgroundColor: colors.amberLight }]}>
                  <v.Icon size={16} color={v.done ? '#059669' : colors.amberDark} />
                </View>
                <View style={styles.verifText}>
                  <Text style={[styles.verifTitle, { color: colors.ink }]}>{v.title}</Text>
                  <Text style={[styles.verifSub, { color: colors.muted }]}>{v.sub}</Text>
                </View>
                <Text style={[styles.verifStatus, { color: v.done ? '#059669' : colors.amberDark }]}>
                  {v.done ? t('common.done') : t('common.pending')}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View style={[styles.card, { marginBottom: 24 }]}>
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={() => router.push('/(chat)' as any)}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#DBEAFE' }]}>
                <ChatCircleText size={16} color="#2563EB" />
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
              <Text style={[styles.menuTitle, { color: colors.ink }]}>{t('profile.myProfile')}</Text>
              <CaretRight size={16} color={colors.muted} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <OfferProgramSection variant="company" companyId={profile?.id} />
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
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
  jobRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  jobIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  jobText: { flex: 1 },
  jobTitle: { fontSize: 12, fontFamily: fonts.headingBold },
  jobSub: { fontSize: 10, fontFamily: fonts.body, marginTop: 1 },
  jobStatus: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 100 },
  jobStatusText: { fontSize: 9, fontFamily: fonts.headingBold, textTransform: 'uppercase', letterSpacing: 0.4 },
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
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  menuIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuTitle: { flex: 1, fontSize: 14, fontFamily: fonts.bodyMedium },
  badge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontFamily: fonts.bodyMedium },
})
