import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Plus, Star, UsersThree } from 'phosphor-react-native'
import { company } from '../../../lib/api'
import { v3 } from '../../../theme/v3/tokens'

export default function CompanyTeam() {
  const router = useRouter()
  const [members, setMembers] = useState<any[]>([])
  const [pending, setPending] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const data: any = await company.team.list()
      setMembers(Array.isArray(data) ? data : data?.members || [])
      setPending(Array.isArray(data) ? [] : data?.pendingInvites || [])
    } catch {
      setMembers([])
      setPending([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const online = members.filter((member) => member.isOnline).length
  const avgRating = useMemo(() => {
    const values = members.map((member) => Number(member.rating || 0)).filter((value) => value > 0)
    return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : '—'
  }, [members])

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color={v3.colors.ink} /></View></SafeAreaView>

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
      >
        <View style={styles.header}>
          <View><Text style={styles.eyebrow}>WORKFORCE</Text><Text style={styles.title}>Team</Text></View>
          <TouchableOpacity style={styles.add} onPress={() => router.push('/(company)/team/invite' as any)}><Plus size={17} color={v3.colors.paper} weight="bold" /><Text style={styles.addText}>Invite</Text></TouchableOpacity>
        </View>

        <View style={styles.summary}>
          <Summary value={String(members.length)} label="MEMBERS" />
          <View style={styles.divider} />
          <Summary value={String(online)} label="ONLINE" />
          <View style={styles.divider} />
          <Summary value={avgRating} label="RATING" />
        </View>

        {pending.length > 0 ? (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingTitle}>{pending.length} pending invitation{pending.length === 1 ? '' : 's'}</Text>
            <Text style={styles.pendingText}>They will appear in your workforce after accepting the invite.</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>People</Text>
        {members.length ? members.map((member) => (
          <TouchableOpacity key={member.id} style={styles.member} activeOpacity={0.72}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{(member.name || '?')[0]}</Text>{member.isOnline ? <View style={styles.onlineDot} /> : null}</View>
            <View style={styles.memberCopy}>
              <Text style={styles.memberName}>{member.name || 'Team member'}</Text>
              <Text style={styles.memberRole}>{String(member.role || 'WORKER').replaceAll('_', ' ')}</Text>
              <View style={styles.metaRow}>
                {Number(member.rating || 0) > 0 ? <><Star size={12} color={v3.colors.amber} weight="fill" /><Text style={styles.metaText}>{Number(member.rating).toFixed(1)}</Text></> : null}
                <Text style={styles.metaText}>{member.completedJobs || 0} jobs</Text>
              </View>
            </View>
            <View style={[styles.status, member.isOnline ? styles.statusOnline : styles.statusOffline]}><Text style={[styles.statusText, member.isOnline ? styles.statusTextOnline : styles.statusTextOffline]}>{member.isOnline ? 'ONLINE' : 'OFFLINE'}</Text></View>
          </TouchableOpacity>
        )) : (
          <View style={styles.empty}><UsersThree size={30} color={v3.colors.textMuted} /><Text style={styles.emptyTitle}>Build your workforce</Text><Text style={styles.emptyText}>Invite workers so accepted company jobs can be dispatched to the right person.</Text><TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/(company)/team/invite' as any)}><Text style={styles.emptyButtonText}>Invite first worker</Text></TouchableOpacity></View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Summary({ value, label }: { value: string; label: string }) {
  return <View style={styles.summaryItem}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingBottom: 34 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 14 },
  eyebrow: { ...v3.typography.label, color: v3.colors.amberDark, letterSpacing: 1 },
  title: { ...v3.typography.h4, color: v3.colors.ink, marginTop: 2 },
  add: { height: 40, borderRadius: 14, backgroundColor: v3.colors.ink, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 5 },
  addText: { ...v3.typography.captionBold, color: v3.colors.paper },
  summary: { height: 83, backgroundColor: v3.colors.paper, borderRadius: 19, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { ...v3.typography.title, color: v3.colors.ink },
  summaryLabel: { ...v3.typography.smallBold, color: v3.colors.textMuted, marginTop: 3 },
  divider: { width: 1, height: 34, backgroundColor: v3.colors.line },
  pendingCard: { backgroundColor: v3.colors.amberSoft, borderRadius: 16, padding: 13, marginTop: 10 },
  pendingTitle: { ...v3.typography.bodyBold, color: v3.colors.ink },
  pendingText: { ...v3.typography.caption, color: v3.colors.amberDark, marginTop: 2 },
  sectionTitle: { ...v3.typography.title, color: v3.colors.ink, marginTop: 20, marginBottom: 9 },
  member: { minHeight: 76, backgroundColor: v3.colors.paper, borderRadius: 18, borderWidth: 1, borderColor: v3.colors.line, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...v3.typography.title, color: v3.colors.amber },
  onlineDot: { position: 'absolute', right: -2, bottom: -2, width: 13, height: 13, borderRadius: 7, backgroundColor: v3.colors.success, borderWidth: 2, borderColor: v3.colors.paper },
  memberCopy: { flex: 1, marginLeft: 11 },
  memberName: { ...v3.typography.bodyLarge, color: v3.colors.ink },
  memberRole: { ...v3.typography.small, color: v3.colors.textMuted, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaText: { ...v3.typography.small, color: v3.colors.textMuted, marginRight: 5 },
  status: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusOnline: { backgroundColor: v3.colors.successSoft },
  statusOffline: { backgroundColor: v3.colors.surfaceGray },
  statusText: { ...v3.typography.smallBold },
  statusTextOnline: { color: v3.colors.success },
  statusTextOffline: { color: v3.colors.textMuted },
  empty: { alignItems: 'center', paddingHorizontal: 36, paddingTop: 64 },
  emptyTitle: { ...v3.typography.title, color: v3.colors.ink, marginTop: 12 },
  emptyText: { ...v3.typography.caption, color: v3.colors.textMuted, textAlign: 'center', lineHeight: 17, marginTop: 5 },
  emptyButton: { height: 46, borderRadius: 14, backgroundColor: v3.colors.ink, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  emptyButtonText: { ...v3.typography.bodyBold, color: v3.colors.paper },
})
