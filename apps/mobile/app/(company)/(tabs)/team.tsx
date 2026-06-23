import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../lib/ThemeContext'
import { company } from '../../../lib/api'

export default function CompanyTeam() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<any[]>([])

  const fetchTeam = useCallback(async () => {
    try {
      const data = await company.team.list()
      setMembers(Array.isArray(data) ? data : [])
    } catch {
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

  const totalMembers = members.length
  const onlineCount = members.filter((m: any) => m.online).length
  const avgRating =
    members.length > 0
      ? (members.reduce((sum: number, m: any) => sum + (m.rating || 0), 0) / members.length).toFixed(1)
      : '0.0'

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.amber} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>{t('company.team')}</Text>
        <TouchableOpacity style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ {t('common.add')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryValue}>{totalMembers}</Text>
          <Text style={styles.summaryLabel}>{t('company.teamMembers')}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryStat}>
          <Text style={styles.summaryValue}>{onlineCount}</Text>
          <Text style={styles.summaryLabel}>{t('common.online')}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryStat}>
          <Text style={styles.summaryValue}>{avgRating}</Text>
          <Text style={styles.summaryLabel}>{t('tasker.rating')}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {members.length === 0 ? (
          <Text style={styles.emptyText}>{t('company.teamMembers')}</Text>
        ) : (
          members.map((m, i) => (
            <TouchableOpacity key={m.id || i} style={styles.memberCard} activeOpacity={0.8}>
              <View style={styles.memberLeft}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.avatarText}>{m.name?.[0] || '?'}</Text>
                  {m.online ? <View style={styles.onlineDot} /> : null}
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{m.name}</Text>
                  <Text style={styles.memberRole}>{m.role}</Text>
                  {m.rating ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                      <Ionicons name="star" size={13} color="#F59E0B" />
                      <Text style={[styles.memberRole, { marginTop: 0 }]}> {m.rating}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.memberMeta}>{m.email || ''}</Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: m.online ? '#D1FAE5' : '#FEE2E2' }]}>
                <Text style={[styles.statusText, { color: m.online ? colors.success : '#EF4444' }]}>
                  {m.online ? t('common.online') : t('common.offline')}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  heading: { fontSize: 28, fontWeight: '800', color: colors.ink },
  addBtn: {
    backgroundColor: colors.amber,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryStat: { alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '800', color: colors.ink },
  summaryLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: colors.border },
  memberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 24,
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  memberLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.amber,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.white },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.success, borderWidth: 2, borderColor: colors.white,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  memberRole: { fontSize: 13, color: colors.muted, marginTop: 2 },
  memberMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: colors.muted, marginTop: 40, fontSize: 14 },
})
