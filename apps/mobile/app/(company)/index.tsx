import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const colors = {
  coral: '#F97316',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  white: '#FFFFFF',
  green: '#10B981',
  primary: '#F59E0B',
}

const stats = [
  { icon: '📄', label: 'Active contracts', value: '12' },
  { icon: '💰', label: 'Revenue (month)', value: 'LKR 1.2M' },
  { icon: '👥', label: 'Team members', value: '8' },
  { icon: '⭐', label: 'Avg. rating', value: '4.7' },
]

const recentActivity = [
  { text: 'Contract #1024 completed - Colombo office renovation', time: '2 hours ago' },
  { text: 'New milestone approved - Phase 2 of City Hotel project', time: '5 hours ago' },
  { text: 'Team member Saman joined the plumbing crew', time: '1 day ago' },
  { text: 'Payment of LKR 250,000 received for Contract #1019', time: '2 days ago' },
]

export default function CompanyDashboard() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>Hello, Nimal 👋</Text>
          <Text style={styles.companyName}>Premium Builders (Pvt) Ltd</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>PB</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.statsGrid}>
          {stats.map((s, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statIcon}>{s.icon}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.chartPlaceholder}>
          <Text style={styles.chartEmoji}>📈</Text>
          <Text style={styles.chartTitle}>Revenue overview</Text>
          <Text style={styles.chartSub}>LKR 1,245,000 this month</Text>
          <View style={styles.chartBars}>
            {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
              <View key={i} style={styles.chartBarWrap}>
                <View style={[styles.chartBar, { height: h }]} />
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recent activity</Text>
        {recentActivity.map((a, i) => (
          <View key={i} style={styles.activityCard}>
            <View style={styles.activityDot} />
            <View style={styles.activityContent}>
              <Text style={styles.activityText}>{a.text}</Text>
              <Text style={styles.activityTime}>{a.time}</Text>
            </View>
          </View>
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
    paddingBottom: 16,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.dark },
  companyName: { fontSize: 13, color: colors.gray, marginTop: 4 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.coral,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: colors.white },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: '47%',
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statIcon: { fontSize: 28, marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.dark },
  statLabel: { fontSize: 12, color: colors.gray, marginTop: 4 },
  chartPlaceholder: {
    backgroundColor: colors.white,
    marginHorizontal: 24,
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  chartEmoji: { fontSize: 32, marginBottom: 8 },
  chartTitle: { fontSize: 16, fontWeight: '700', color: colors.dark },
  chartSub: { fontSize: 13, color: colors.gray, marginBottom: 16 },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 100,
  },
  chartBarWrap: { flex: 1, alignItems: 'center', height: 100, justifyContent: 'flex-end' },
  chartBar: {
    width: '100%',
    backgroundColor: colors.coral,
    borderRadius: 6,
    opacity: 0.7,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  activityCard: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 10,
    gap: 12,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.coral,
    marginTop: 5,
  },
  activityContent: { flex: 1 },
  activityText: { fontSize: 13, color: colors.dark, lineHeight: 18 },
  activityTime: { fontSize: 11, color: colors.gray, marginTop: 4 },
})
