import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const colors = {
  coral: '#F97316',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  white: '#FFFFFF',
  green: '#10B981',
}

const teamMembers = [
  { name: 'Saman Kumara', role: 'Plumber', rating: 4.9, jobs: 89, online: true, since: '2023' },
  { name: 'Nuwan Perera', role: 'Electrician', rating: 4.7, jobs: 62, online: true, since: '2023' },
  { name: 'Lahiru Silva', role: 'Painter', rating: 4.8, jobs: 45, online: false, since: '2024' },
  { name: 'Ruwan Jayasuriya', role: 'Handyman', rating: 4.6, jobs: 34, online: true, since: '2024' },
  { name: 'Kasun Fernando', role: 'AC Technician', rating: 4.9, jobs: 27, online: false, since: '2025' },
]

export default function CompanyTeam() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Team</Text>
        <TouchableOpacity style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryValue}>8</Text>
          <Text style={styles.summaryLabel}>Members</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryStat}>
          <Text style={styles.summaryValue}>5</Text>
          <Text style={styles.summaryLabel}>Online</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryStat}>
          <Text style={styles.summaryValue}>4.8</Text>
          <Text style={styles.summaryLabel}>Avg rating</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {teamMembers.map((m, i) => (
          <TouchableOpacity key={i} style={styles.memberCard} activeOpacity={0.8}>
            <View style={styles.memberLeft}>
              <View style={styles.memberAvatar}>
                <Text style={styles.avatarText}>{m.name[0]}</Text>
                {m.online ? <View style={styles.onlineDot} /> : null}
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberRole}>{m.role} • ⭐ {m.rating}</Text>
                <Text style={styles.memberMeta}>{m.jobs} jobs • Since {m.since}</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: m.online ? '#D1FAE5' : '#FEE2E2' }]}>
              <Text style={[styles.statusText, { color: m.online ? colors.green : '#EF4444' }]}>
                {m.online ? 'Online' : 'Offline'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark },
  addBtn: {
    backgroundColor: colors.coral,
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
  summaryValue: { fontSize: 20, fontWeight: '800', color: colors.dark },
  summaryLabel: { fontSize: 11, color: colors.gray, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: colors.lightGray },
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
    backgroundColor: colors.coral,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.white },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.green, borderWidth: 2, borderColor: colors.white,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '700', color: colors.dark },
  memberRole: { fontSize: 13, color: colors.gray, marginTop: 2 },
  memberMeta: { fontSize: 11, color: colors.gray, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '600' },
})
