import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth'

const colors = {
  teal: '#0D9488',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  white: '#FFFFFF',
  green: '#10B981',
  primary: '#F59E0B',
}

const skills = ['Plumbing', 'Pipe Fitting', 'Water Heater Repair', 'Drain Cleaning']
const serviceAreas = ['Colombo 01', 'Colombo 02', 'Colombo 03', 'Colombo 04', 'Colombo 05']

export default function TaskerProfile() {
  const router = useRouter()
  const { user, logout } = useAuth()

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>K</Text>
          </View>
          <Text style={styles.name}>Kamal Perera</Text>
          <Text style={styles.role}>Plumber • ⭐ 4.8</Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}><Text style={styles.badgeText}>✓ Verified</Text></View>
            <View style={styles.badge}><Text style={styles.badgeText}>🟢 Online</Text></View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>47</Text>
            <Text style={styles.statLabel}>Jobs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>4.8</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>99%</Text>
            <Text style={styles.statLabel}>Completion</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>3 yr</Text>
            <Text style={styles.statLabel}>Exp.</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills</Text>
          <View style={styles.tagRow}>
            {skills.map((s) => (
              <View key={s} style={styles.tag}><Text style={styles.tagText}>{s}</Text></View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service areas</Text>
          <View style={styles.tagRow}>
            {serviceAreas.map((a) => (
              <View key={a} style={styles.tag}><Text style={styles.tagText}>{a}</Text></View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.menuRow}>
            <Text style={styles.menuLabel}>📋 Edit profile</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow}>
            <Text style={styles.menuLabel}>💳 Payment details</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow}>
            <Text style={styles.menuLabel}>🔔 Notifications</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow} onPress={logout}>
            <Text style={[styles.menuLabel, { color: '#EF4444' }]}>🚪 Log out</Text>
            <Text style={[styles.menuArrow, { color: '#EF4444' }]}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  profileHeader: { alignItems: 'center', paddingTop: 24, paddingBottom: 20 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.teal,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: colors.white },
  name: { fontSize: 22, fontWeight: '800', color: colors.dark, marginBottom: 4 },
  role: { fontSize: 15, color: colors.gray, marginBottom: 10 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#D1FAE5',
  },
  badgeText: { fontSize: 13, fontWeight: '600', color: colors.green },
  statsRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 8, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.dark },
  statLabel: { fontSize: 11, color: colors.gray, marginTop: 2 },
  section: { paddingHorizontal: 24, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.dark, marginBottom: 10 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
  },
  tagText: { fontSize: 13, fontWeight: '600', color: colors.dark },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  menuLabel: { fontSize: 15, fontWeight: '600', color: colors.dark },
  menuArrow: { fontSize: 22, color: colors.gray, fontWeight: '300' },
})
