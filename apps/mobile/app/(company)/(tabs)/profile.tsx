import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Bell, CaretDown, CaretRight, MapPin, WarningCircle } from 'phosphor-react-native'
import { company, notifications } from '../../../lib/api'
import { v2Identity } from '../../../lib/api-v2'
import { fonts } from '../../../lib/fonts'
import { v3 } from '../../../theme/v3/tokens'

type WorkspaceRowProps = {
  title: string
  subtitle: string
  onPress: () => void
}

function WorkspaceRow({ title, subtitle, onPress }: WorkspaceRowProps) {
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.72} onPress={onPress}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <CaretRight size={17} color={v3.colors.textMuted} weight="bold" />
    </TouchableOpacity>
  )
}

export default function CompanyProfile() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [identityStatus, setIdentityStatus] = useState('NOT_SUBMITTED')
  const [unreadNotifs, setUnreadNotifs] = useState(0)

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [profileRes, identityRes, unreadRes] = await Promise.allSettled([
        company.profile.get(),
        v2Identity.getStatus(),
        notifications.unreadCount(),
      ])

      if (profileRes.status === 'fulfilled') setProfile(profileRes.value)
      else setError('Unable to load the company profile.')

      if (identityRes.status === 'fulfilled') {
        setIdentityStatus((identityRes.value as any)?.identityStatus || 'NOT_SUBMITTED')
      }

      if (unreadRes.status === 'fulfilled') setUnreadNotifs(Number((unreadRes.value as any)?.count || 0))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={v3.colors.ink} />
        </View>
      </SafeAreaView>
    )
  }

  if (error && !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorWrap}>
          <WarningCircle size={38} color={v3.colors.error} weight="regular" />
          <Text style={styles.errorTitle}>Company profile unavailable</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} activeOpacity={0.78} onPress={fetchProfile}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const name = profile?.companyName || profile?.name || 'Company'
  const initials = String(name).split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'CO'
  const services = Array.isArray(profile?.services) ? profile.services : []
  const serviceAreas = Array.isArray(profile?.serviceAreas)
    ? profile.serviceAreas
    : Array.isArray(profile?.areas)
      ? profile.areas.map((area: any) => area?.name || area).filter(Boolean)
      : []

  const location = serviceAreas[0] || profile?.district || profile?.city || profile?.address?.district || 'Service area'
  const isVerified = Boolean(
    profile?.isVerified ||
    profile?.verificationStatus === 'VERIFIED' ||
    ['APPROVED', 'VERIFIED'].includes(identityStatus)
  )

  const subscriptionName =
    profile?.subscription?.planName ||
    profile?.subscription?.plan ||
    profile?.subscriptionPlan ||
    profile?.planName ||
    'Manage plan'

  const payoutLabel =
    profile?.payoutAccount?.bankName ||
    profile?.bankName ||
    profile?.payoutBank ||
    'Manage payout details'

  const serviceAreaLabel = serviceAreas.length
    ? serviceAreas.slice(0, 3).join(', ')
    : profile?.district || 'Add service areas'

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.appBar}>
          <View>
            <Text style={styles.brand}>MΛINTΛINEX</Text>
            <TouchableOpacity style={styles.locationRow} activeOpacity={0.72} onPress={() => router.push('/(company)/settings/edit-profile' as any)}>
              <MapPin size={12} color="#5B5B5B" weight="regular" />
              <Text style={styles.locationText} numberOfLines={1}>{String(location)}</Text>
              <CaretDown size={11} color="#5B5B5B" weight="bold" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.bellButton} activeOpacity={0.72} onPress={() => router.push('/notifications' as any)}>
            <Bell size={18} color={v3.colors.ink} weight="regular" />
            {unreadNotifs > 0 ? <View style={styles.bellDot} /> : null}
          </TouchableOpacity>
        </View>

        <Text style={styles.pageTitle}>Company profile</Text>

        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.companyName} numberOfLines={1}>{name}</Text>
            <Text style={[styles.companyStatus, isVerified ? styles.verifiedText : styles.pendingText]}>
              {isVerified ? 'Verified company' : 'Verification pending'}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Workspace</Text>

        <View style={styles.rows}>
          <WorkspaceRow
            title="Company details"
            subtitle="Registration, documents"
            onPress={() => router.push('/(company)/settings/edit-profile' as any)}
          />
          <WorkspaceRow
            title="Subscription"
            subtitle={String(subscriptionName)}
            onPress={() => router.push('/(company)/settings/subscription' as any)}
          />
          <WorkspaceRow
            title="Service catalogue"
            subtitle={services.length ? services.length + ' services' : 'Add company services'}
            onPress={() => router.push('/(company)/settings/edit-profile' as any)}
          />
          <WorkspaceRow
            title="Service areas"
            subtitle={serviceAreaLabel}
            onPress={() => router.push('/(company)/settings/edit-profile' as any)}
          />
          <WorkspaceRow
            title="Team permissions"
            subtitle="Roles & access"
            onPress={() => router.push('/(company)/(tabs)/team' as any)}
          />
          <WorkspaceRow
            title="Payout account"
            subtitle={String(payoutLabel)}
            onPress={() => router.push('/(company)/(tabs)/earnings-list' as any)}
          />
          <WorkspaceRow
            title="Support"
            subtitle="Help & contracts"
            onPress={() => router.push('/settings/help' as any)}
          />
        </View>

        <View style={styles.moreSection}>
          <Text style={styles.moreLabel}>Operations</Text>
          <WorkspaceRow
            title="Contracts"
            subtitle="Open and completed company contracts"
            onPress={() => router.push('/(company)/(tabs)/contracts-list' as any)}
          />
          <WorkspaceRow
            title="Milestones"
            subtitle="Track project milestones"
            onPress={() => router.push('/(company)/(tabs)/milestones-list' as any)}
          />
          <WorkspaceRow
            title="Company inbox"
            subtitle="Customer and workforce conversations"
            onPress={() => router.push('/(company)/(tabs)/inbox' as any)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingBottom: 34,
  },
  appBar: {
    minHeight: 78,
    paddingHorizontal: 18,
    paddingTop: 7,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    fontSize: 13,
    letterSpacing: 0.6,
    fontFamily: fonts.heading,
    color: v3.colors.ink,
  },
  locationRow: {
    marginTop: 8,
    maxWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    maxWidth: 160,
    fontSize: 11.5,
    fontFamily: fonts.bodyMedium,
    color: '#5B5B5B',
  },
  bellButton: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: v3.colors.amber,
    borderWidth: 2,
    borderColor: v3.colors.paper,
  },
  pageTitle: {
    marginHorizontal: 18,
    marginTop: 12,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: fonts.heading,
    color: v3.colors.ink,
    letterSpacing: -0.4,
  },
  identityRow: {
    marginHorizontal: 18,
    marginTop: 20,
    minHeight: 64,
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
  },
  companyName: {
    fontSize: 17,
    fontFamily: fonts.heading,
    color: v3.colors.ink,
  },
  companyStatus: {
    marginTop: 4,
    fontSize: 10.5,
    fontFamily: fonts.bodySemiBold,
  },
  verifiedText: { color: v3.colors.success },
  pendingText: { color: v3.colors.amberDark },
  sectionLabel: {
    marginHorizontal: 18,
    marginTop: 32,
    marginBottom: 7,
    fontSize: 12,
    fontFamily: fonts.headingBold,
    color: v3.colors.textMuted,
  },
  rows: {
    paddingHorizontal: 28,
  },
  row: {
    minHeight: 61,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: v3.colors.line,
  },
  rowCopy: {
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    fontSize: 12.5,
    lineHeight: 16,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  rowSubtitle: {
    marginTop: 3,
    fontSize: 9.5,
    lineHeight: 13,
    fontFamily: fonts.bodySemiBold,
    color: v3.colors.textMuted,
  },
  moreSection: {
    marginTop: 28,
    paddingHorizontal: 28,
  },
  moreLabel: {
    marginBottom: 7,
    fontSize: 10,
    fontFamily: fonts.headingBold,
    color: v3.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  errorWrap: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    marginTop: 14,
    fontSize: 17,
    fontFamily: fonts.headingBold,
    color: v3.colors.ink,
  },
  errorText: {
    marginTop: 5,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 17,
    fontFamily: fonts.body,
    color: v3.colors.textMuted,
  },
  retryButton: {
    marginTop: 18,
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 13,
    backgroundColor: v3.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    fontSize: 11,
    fontFamily: fonts.headingBold,
    color: v3.colors.paper,
  },
})
