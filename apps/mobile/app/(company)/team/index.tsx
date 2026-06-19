import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { v2Team } from '../../../lib/api-v2'

export default function TeamManagement() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const [members, setMembers] = useState<any[]>([])
  const [pendingInvites, setPendingInvites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadTeam = useCallback(async () => {
    try {
      const res = await v2Team.list()
      setMembers(res.members || [])
      setPendingInvites(res.pendingInvites || [])
    } catch {
      Alert.alert('Error', 'Failed to load team data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadTeam() }, [loadTeam])

  const handleRemove = (memberId: string, name: string) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${name} from the team?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await v2Team.remove(memberId)
              setMembers(members.filter(m => m.id !== memberId))
            } catch {
              Alert.alert('Error', 'Failed to remove team member')
            }
          },
        },
      ]
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.amber} />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTeam() }} />}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Team Members</Text>
        <TouchableOpacity style={styles.inviteBtn} onPress={() => router.push('/(company)/team/invite')}>
          <Ionicons name="person-add-outline" size={18} color={colors.white} />
          <Text style={styles.inviteBtnText}>Invite</Text>
        </TouchableOpacity>
      </View>

      {members.length === 0 && pendingInvites.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>No team members yet</Text>
          <Text style={styles.emptyDesc}>Invite your team to get started.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(company)/team/invite')}>
            <Text style={styles.emptyBtnText}>Invite Members</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {members.map((m) => (
            <View key={m.id} style={styles.memberCard}>
              <View style={styles.memberAvatar}>
                <Text style={styles.avatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                {m.isOnline && <View style={styles.onlineDot} />}
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberRole}>{m.role}</Text>
                <View style={styles.memberStats}>
                  <Ionicons name="star" size={12} color={colors.amber} />
                  <Text style={styles.statText}>{m.rating.toFixed(1)}</Text>
                  <Ionicons name="checkmark-circle-outline" size={12} color={colors.muted} />
                  <Text style={styles.statText}>{m.completedJobs} jobs</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => handleRemove(m.id, m.name)} style={styles.removeBtn}>
                <Ionicons name="trash-outline" size={18} color={colors.muted} />
              </TouchableOpacity>
            </View>
          ))}

          {pendingInvites.length > 0 && (
            <View style={styles.invitesSection}>
              <Text style={styles.sectionTitle}>Pending Invites</Text>
              {pendingInvites.map((inv) => (
                <View key={inv.id} style={styles.inviteCard}>
                  <Ionicons name="time-outline" size={20} color={colors.amber} />
                  <View style={styles.inviteInfo}>
                    <Text style={styles.inviteName}>{inv.name}</Text>
                    <Text style={styles.inviteContact}>{inv.email || inv.phone}</Text>
                  </View>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingText}>Pending</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontFamily: fonts.headingBold, color: colors.ink },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.amber, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12,
  },
  inviteBtnText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.white },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 18, fontFamily: fonts.bodyMedium, color: colors.ink, marginTop: 16 },
  emptyDesc: { fontSize: 14, fontFamily: fonts.body, color: colors.muted, marginTop: 8 },
  emptyBtn: { marginTop: 20, backgroundColor: colors.amber, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.white },
  memberCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, backgroundColor: colors.white, borderRadius: 16,
    marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  memberAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.amber,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.ink },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success,
    borderWidth: 2, borderColor: colors.white,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.ink },
  memberRole: { fontSize: 13, fontFamily: fonts.body, color: colors.muted, marginTop: 2 },
  memberStats: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  statText: { fontSize: 12, fontFamily: fonts.body, color: colors.muted },
  removeBtn: { padding: 8 },
  invitesSection: { marginTop: 24 },
  sectionTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.ink, marginBottom: 12 },
  inviteCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, backgroundColor: colors.white, borderRadius: 12,
    marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  inviteInfo: { flex: 1 },
  inviteName: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.ink },
  inviteContact: { fontSize: 12, fontFamily: fonts.body, color: colors.muted },
  pendingBadge: {
    backgroundColor: colors.amberBg, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8,
  },
  pendingText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.amberDark },
})
