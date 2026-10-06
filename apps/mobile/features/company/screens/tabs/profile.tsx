import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  Bell,
  Briefcase,
  CaretRight,
  Check,
  CreditCard,
  IdentificationCard,
  MapPin,
  ShieldCheck,
  Storefront,
  UsersThree,
  Wrench,
} from 'phosphor-react-native'
import { company } from '@/api/companies'
import { notifications } from '@/api/notifications'
import { v2Identity } from '@/api/v2-identity'
import { v3 } from '@/theme/v3/tokens'

export default function CompanyProfile() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [identityStatus, setIdentityStatus] = useState('NOT_SUBMITTED')
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const [profileRes, identityRes, unreadRes] = await Promise.allSettled([
      company.profile.get(),
      v2Identity.getStatus(),
      notifications.unreadCount(),
    ])
    if (profileRes.status === 'fulfilled') setProfile(profileRes.value)
    if (identityRes.status === 'fulfilled') setIdentityStatus((identityRes.value as any)?.identityStatus || 'NOT_SUBMITTED')
    if (unreadRes.status === 'fulfilled') setUnread(Number((unreadRes.value as any)?.count || 0))
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  const checklist = useMemo(() => [
    { label: 'Business details', done: Boolean(profile?.companyName && profile?.description) },
    { label: 'Services', done: Array.isArray(profile?.services) && profile.services.length > 0 },
    { label: 'Service areas', done: Array.isArray(profile?.serviceAreas) && profile.serviceAreas.length > 0 },
    { label: 'Team', done: Array.isArray(profile?.teamMembers) && profile.teamMembers.length > 0 },
    { label: 'Identity', done: identityStatus === 'VERIFIED' || Boolean(profile?.isVerified) },
  ], [profile, identityStatus])

  const completion = Math.round((checklist.filter((item) => item.done).length / checklist.length) * 100)

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color={v3.colors.ink} /></View></SafeAreaView>
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
      >
        <View style={styles.topBar}>
          <View><Text style={styles.eyebrow}>BUSINESS PROFILE</Text><Text style={styles.title}>Company</Text></View>
          <TouchableOpacity style={styles.notificationButton} onPress={() => router.push('/notifications' as any)}>
            <Bell size={18} color={v3.colors.ink} weight="bold" />
            {unread > 0 ? <View style={styles.dot} /> : null}
          </TouchableOpacity>
        </View>

        <View style={styles.identityCard}>
          <View style={styles.logo}><Text style={styles.logoText}>{(profile?.companyName || 'C')[0]}</Text></View>
          <View style={styles.identityCopy}>
            <View style={styles.nameRow}>
              <Text style={styles.companyName} numberOfLines={1}>{profile?.companyName || 'Complete your company profile'}</Text>
              {profile?.isVerified ? <ShieldCheck size={17} color={v3.colors.success} weight="fill" /> : null}
            </View>
            <Text style={styles.companyMeta}>{profile?.registrationNo || 'Registration number not added'}</Text>
            <View style={styles.areaLine}><MapPin size={13} color={v3.colors.textMuted} /><Text style={styles.areaText}>{profile?.serviceAreas?.slice(0, 2).join(' · ') || 'Add service areas'}</Text></View>
          </View>
        </View>

        <TouchableOpacity style={styles.editButton} onPress={() => router.push('/(company)/settings/edit-profile' as any)}>
          <Text style={styles.editButtonText}>Edit company profile</Text><CaretRight size={17} color={v3.colors.paper} weight="bold" />
        </TouchableOpacity>

        <View style={styles.readinessCard}>
          <View style={styles.readinessHeader}>
            <View><Text style={styles.readinessLabel}>LAUNCH CHECKLIST</Text><Text style={styles.readinessTitle}>{completion}% ready</Text></View>
            <Text style={styles.readinessCount}>{checklist.filter((item) => item.done).length}/{checklist.length}</Text>
          </View>
          <View style={styles.progress}><View style={[styles.progressFill, { width: `${completion}%` }]} /></View>
          <View style={styles.checks}>
            {checklist.map((item) => (
              <View key={item.label} style={styles.checkRow}>
                <View style={[styles.checkCircle, item.done && styles.checkCircleDone]}>{item.done ? <Check size={11} color={v3.colors.paper} weight="bold" /> : null}</View>
                <Text style={[styles.checkText, item.done && styles.checkTextDone]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Business</Text>
        <Section>
          <Row icon={<Storefront size={18} color={v3.colors.ink} />} title="Company details" subtitle="Name, registration, description & logo" onPress={() => router.push('/(company)/settings/edit-profile' as any)} />
          <Row icon={<Wrench size={18} color={v3.colors.ink} />} title="Services" subtitle={profile?.services?.length ? `${profile.services.length} service capabilities` : 'Choose the work your company provides'} onPress={() => router.push('/(company)/settings/edit-profile' as any)} />
          <Row icon={<MapPin size={18} color={v3.colors.ink} />} title="Service areas" subtitle={profile?.serviceAreas?.length ? profile.serviceAreas.join(', ') : 'Where your team can work'} onPress={() => router.push('/(company)/settings/edit-profile' as any)} last />
        </Section>

        <Text style={styles.sectionTitle}>Operations</Text>
        <Section>
          <Row icon={<Briefcase size={18} color={v3.colors.ink} />} title="Jobs & quotes" subtitle="Browse requests, quotes and accepted work" onPress={() => router.push('/(company)/jobs/v2/browse' as any)} />
          <Row icon={<UsersThree size={18} color={v3.colors.ink} />} title="Team" subtitle={`${profile?.teamMembers?.length || 0} team members`} onPress={() => router.push('/(company)/(tabs)/team' as any)} />
          <Row icon={<IdentificationCard size={18} color={v3.colors.ink} />} title="Verification" subtitle={identityStatus === 'VERIFIED' || profile?.isVerified ? 'Verified' : 'Complete identity & business checks'} onPress={() => router.push('/(company)/identity' as any)} last />
        </Section>

        <Text style={styles.sectionTitle}>Finance & plan</Text>
        <Section>
          <Row icon={<CreditCard size={18} color={v3.colors.ink} />} title="Subscription" subtitle="Plan, billing and business features" onPress={() => router.push('/(company)/settings/subscription' as any)} last />
        </Section>

        <View style={{ height: 22 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return <View style={styles.section}>{children}</View>
}
function Row({ icon, title, subtitle, onPress, last = false }: { icon: React.ReactNode; title: string; subtitle: string; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity style={[styles.row, !last && styles.rowBorder]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowSubtitle} numberOfLines={1}>{subtitle}</Text></View>
      <CaretRight size={16} color={v3.colors.textMuted} weight="bold" />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 18, paddingBottom: 20 },
  topBar: { paddingTop: 8, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { ...v3.typography.label, color: v3.colors.amberDark, letterSpacing: 1 },
  title: { ...v3.typography.h4, color: v3.colors.ink, marginTop: 2 },
  notificationButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: v3.colors.error, right: 8, top: 8, borderWidth: 1.5, borderColor: v3.colors.paper },
  identityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: v3.colors.paper, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: v3.colors.line },
  logo: { width: 56, height: 56, borderRadius: 18, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  logoText: { ...v3.typography.h5, color: v3.colors.amber },
  identityCopy: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  companyName: { ...v3.typography.title, color: v3.colors.ink, flexShrink: 1 },
  companyMeta: { ...v3.typography.caption, color: v3.colors.textMuted, marginTop: 2 },
  areaLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  areaText: { ...v3.typography.small, color: v3.colors.textMuted, flex: 1 },
  editButton: { backgroundColor: v3.colors.ink, borderRadius: 16, paddingHorizontal: 16, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  editButtonText: { ...v3.typography.bodyBold, color: v3.colors.paper },
  readinessCard: { backgroundColor: v3.colors.amberSoft, borderRadius: 20, padding: 16, marginTop: 12 },
  readinessHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  readinessLabel: { ...v3.typography.smallBold, color: v3.colors.amberDark, letterSpacing: 0.8 },
  readinessTitle: { ...v3.typography.title, color: v3.colors.ink, marginTop: 2 },
  readinessCount: { ...v3.typography.bodyBold, color: v3.colors.amberDark },
  progress: { height: 5, borderRadius: 999, backgroundColor: '#F0D69D', marginTop: 12, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 999, backgroundColor: v3.colors.ink },
  checks: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 5, width: '47%' },
  checkCircle: { width: 17, height: 17, borderRadius: 9, borderWidth: 1, borderColor: '#C7A75B', alignItems: 'center', justifyContent: 'center' },
  checkCircleDone: { backgroundColor: v3.colors.ink, borderColor: v3.colors.ink },
  checkText: { ...v3.typography.small, color: v3.colors.amberDark },
  checkTextDone: { color: v3.colors.ink },
  sectionTitle: { ...v3.typography.bodyLarge, color: v3.colors.ink, marginTop: 20, marginBottom: 8 },
  section: { backgroundColor: v3.colors.paper, borderRadius: 18, borderWidth: 1, borderColor: v3.colors.line, overflow: 'hidden' },
  row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: v3.colors.line },
  rowIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, marginLeft: 11 },
  rowTitle: { ...v3.typography.bodyBold, color: v3.colors.ink },
  rowSubtitle: { ...v3.typography.caption, color: v3.colors.textMuted, marginTop: 2 },
})
