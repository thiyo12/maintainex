import { useState, useEffect, useCallback } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CaretRight } from 'phosphor-react-native'
import { taskers, earnings } from '../../../lib/api'
import { v2Identity } from '../../../lib/api-v2'
import { useAuth } from '../../../lib/auth'
import { fonts } from '../../../lib/fonts'
import { v3 } from '../../../theme/v3/tokens'

type ProfileData = any

type ProfileRowProps = {
  title: string
  subtitle: string
  onPress?: () => void
}

function ProfileRow({ title, subtitle, onPress }: ProfileRowProps) {
  const body = (
    <>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <CaretRight size={16} color={v3.colors.textSecondary} weight="bold" />
    </>
  )

  if (!onPress) return <View style={styles.row}>{body}</View>

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
      {body}
    </TouchableOpacity>
  )
}

export default function TaskerProfile() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [identityStatus, setIdentityStatus] = useState('NOT_SUBMITTED')
  const [balance, setBalance] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [profileRes, identityRes, earningsRes] = await Promise.allSettled([
        taskers.getMyProfile(),
        v2Identity.getStatus(),
        earnings.get(),
      ])

      if (profileRes.status === 'fulfilled') setProfile(profileRes.value)
      if (identityRes.status === 'fulfilled') setIdentityStatus((identityRes.value as any)?.identityStatus || 'NOT_SUBMITTED')
      if (earningsRes.status === 'fulfilled') {
        const value: any = earningsRes.value
        setBalance(Number(value?.balance ?? value?.availableBalance ?? 0))
      }
    } catch (error) {
      console.error('Load tasker profile error:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleLogout = () => {
    Alert.alert('Log out', 'Do you want to log out of MaintainEX?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await logout()
          router.replace('/(auth)/welcome')
        },
      },
    ])
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={v3.colors.ink} />
        </View>
      </SafeAreaView>
    )
  }

  const p = profile?.taskerProfile || profile || {}
  const name = p?.user?.name || profile?.user?.name || user?.name || 'Tasker'
  const initials = String(name).split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'T'
  const skills: string[] = Array.isArray(p?.skills) ? p.skills : []
  const serviceAreas: string[] = Array.isArray(p?.serviceAreas) ? p.serviceAreas : []
  const reviews: any[] = Array.isArray(p?.reviews) ? p.reviews : []
  const portfolio: any[] = Array.isArray(p?.portfolio)
    ? p.portfolio
    : Array.isArray(p?.workPhotos)
      ? p.workPhotos
      : []

  const rating = Number(p?.rating || 0)
  const completedJobs = Number(p?.completedJobs || 0)
  const onTimeRate = p?.onTimeRate == null ? null : Number(p.onTimeRate)
  const cancellationRate = p?.cancellationRate == null ? null : Number(p.cancellationRate)
  const isVerified = ['APPROVED', 'VERIFIED'].includes(identityStatus)
  const isTopTasker = Boolean(
    p?.isTopTasker ||
    (Array.isArray(p?.badges) && p.badges.some((badge: any) => String(badge?.label || badge?.name || badge).toLowerCase().includes('top tasker')))
  )

  const serviceSummary = skills.length
    ? skills.slice(0, 3).join(' · ')
    : 'Add your services'
  const areaSummary = serviceAreas.length
    ? serviceAreas.slice(0, 2).join(', ')
    : p?.area?.name || 'Set your service area'

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Tasker profile</Text>

        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <Text style={styles.profession} numberOfLines={1}>{serviceSummary}</Text>
          </View>
          <View style={styles.badges}>
            {isTopTasker ? (
              <View style={[styles.badge, styles.topBadge]}>
                <Text style={[styles.badgeText, styles.topBadgeText]}>TOP TASKER</Text>
              </View>
            ) : null}
            {isVerified ? (
              <View style={[styles.badge, styles.verifiedBadge]}>
                <Text style={[styles.badgeText, styles.verifiedBadgeText]}>VERIFIED</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.metricsCard}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{rating > 0 ? rating.toFixed(1) + ' ★' : 'New'}</Text>
            <Text style={styles.metricLabel}>{completedJobs} completed</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{onTimeRate == null ? '—' : Math.round(onTimeRate) + '%'}</Text>
            <Text style={styles.metricLabel}>on-time</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{cancellationRate == null ? '—' : cancellationRate.toFixed(1) + '%'}</Text>
            <Text style={styles.metricLabel}>cancellation</Text>
          </View>
          {Array.isArray(p?.badges) && p.badges.length > 0 ? (
            <TouchableOpacity style={styles.badgesLink} activeOpacity={0.72}>
              <Text style={styles.badgesLinkText}>View badges ›</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.rowList}>
          <ProfileRow
            title="Your services"
            subtitle={skills.length ? skills.length + ' active categories' : 'No active services yet'}
            onPress={() => router.push('/(tasker)/settings/job-selection' as any)}
          />
          <ProfileRow
            title="Service area"
            subtitle={areaSummary}
            onPress={() => router.push('/(tasker)/settings/service-area' as any)}
          />
          <ProfileRow
            title="Availability"
            subtitle={p?.isOnline ? 'Online now' : 'Manage your working hours'}
            onPress={() => router.push('/(tasker)/settings/availability' as any)}
          />
          <ProfileRow
            title="Identity & readiness"
            subtitle={isVerified ? 'Verified' : 'Setup requires attention'}
            onPress={() => router.push('/(tasker)/readiness' as any)}
          />
          <ProfileRow
            title="Portfolio"
            subtitle={portfolio.length ? portfolio.length + ' work photos' : 'Add work photos'}
            onPress={() => router.push('/(tasker)/settings/edit-profile' as any)}
          />
          <ProfileRow
            title="Reviews"
            subtitle={(rating > 0 ? rating.toFixed(1) + ' average' : 'No rating yet') + ' · ' + reviews.length + ' written'}
          />
          <ProfileRow
            title="Wallet & payouts"
            subtitle={'Available LKR ' + balance.toLocaleString()}
            onPress={() => router.push('/(tasker)/(tabs)/earnings' as any)}
          />
        </View>

        <View style={styles.accountSection}>
          <Text style={styles.accountLabel}>Account</Text>
          <ProfileRow title="Edit tasker profile" subtitle="Personal details, bio and profile media" onPress={() => router.push('/(tasker)/settings/edit-profile' as any)} />
          <ProfileRow title="Messages" subtitle="Customer and job conversations" onPress={() => router.push('/(chat)' as any)} />
          <ProfileRow title="Notifications" subtitle="Job alerts and account updates" onPress={() => router.push('/notifications' as any)} />
          <TouchableOpacity style={styles.logoutRow} activeOpacity={0.72} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 34,
  },
  pageTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: fonts.heading,
    color: v3.colors.ink,
  },
  identityRow: {
    marginTop: 20,
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#D9D9D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  identityCopy: {
    flex: 1,
    marginLeft: 12,
    paddingRight: 8,
  },
  name: {
    fontSize: 15,
    fontFamily: fonts.heading,
    color: v3.colors.ink,
  },
  profession: {
    marginTop: 4,
    fontSize: 9.5,
    fontFamily: fonts.bodySemiBold,
    color: v3.colors.textSecondary,
  },
  badges: {
    alignItems: 'flex-end',
    gap: 5,
  },
  badge: {
    minHeight: 23,
    borderRadius: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 8.8,
    fontFamily: fonts.headingBold,
  },
  topBadge: { backgroundColor: v3.colors.amberSoft },
  topBadgeText: { color: v3.colors.amberDark },
  verifiedBadge: { backgroundColor: v3.colors.infoSoft },
  verifiedBadgeText: { color: v3.colors.info },
  metricsCard: {
    position: 'relative',
    marginTop: 16,
    minHeight: 104,
    borderRadius: 18,
    backgroundColor: v3.colors.ink,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 22,
    flexDirection: 'row',
  },
  metric: { flex: 1 },
  metricValue: {
    fontSize: 19,
    fontFamily: fonts.heading,
    color: v3.colors.paper,
  },
  metricLabel: {
    marginTop: 4,
    fontSize: 8.8,
    fontFamily: fonts.bodySemiBold,
    color: '#CFCFCF',
  },
  badgesLink: {
    position: 'absolute',
    right: 14,
    bottom: 9,
  },
  badgesLinkText: {
    fontSize: 8.8,
    fontFamily: fonts.headingBold,
    color: v3.colors.amber,
  },
  rowList: {
    marginTop: 22,
  },
  row: {
    minHeight: 62,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: v3.colors.line,
  },
  rowCopy: { flex: 1, paddingRight: 10 },
  rowTitle: {
    fontSize: 10.7,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  rowSubtitle: {
    marginTop: 4,
    fontSize: 8.7,
    fontFamily: fonts.bodySemiBold,
    color: v3.colors.textSecondary,
  },
  accountSection: {
    marginTop: 25,
    paddingTop: 5,
  },
  accountLabel: {
    paddingHorizontal: 14,
    marginBottom: 4,
    fontSize: 10,
    fontFamily: fonts.headingBold,
    color: v3.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logoutRow: {
    minHeight: 54,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 11,
    fontFamily: fonts.headingBold,
    color: v3.colors.error,
  },
})
