import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth'

const colors = {
  coral: '#F97316',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  white: '#FFFFFF',
  green: '#10B981',
}

export default function CompanyProfile() {
  const { logout } = useAuth()

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>PB</Text>
          </View>
          <Text style={styles.companyName}>Premium Builders (Pvt) Ltd</Text>
          <Text style={styles.companyReg}>Registered • GST-12345678</Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}><Text style={styles.badgeText}>✓ Verified</Text></View>
            <View style={styles.badge}><Text style={styles.badgeText}>⭐ 4.7</Text></View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Active contracts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>8</Text>
            <Text style={styles.statLabel}>Team members</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>47</Text>
            <Text style={styles.statLabel}>Projects done</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>3 yr</Text>
            <Text style={styles.statLabel}>In business</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.aboutText}>
            Premium Builders is a licensed construction and maintenance company specializing in plumbing, electrical, and renovation services for commercial and residential clients in Colombo.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services</Text>
          <View style={styles.tagRow}>
            {['Plumbing', 'Electrical', 'Painting', 'Renovation', 'AC Installation', 'Construction'].map((s) => (
              <View key={s} style={styles.tag}><Text style={styles.tagText}>{s}</Text></View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service areas</Text>
          <View style={styles.tagRow}>
            {['Colombo', 'Gampaha', 'Kalutara', 'Negombo'].map((a) => (
              <View key={a} style={styles.tag}><Text style={styles.tagText}>{a}</Text></View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.menuRow}>
            <Text style={styles.menuLabel}>📋 Edit company profile</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow}>
            <Text style={styles.menuLabel}>💳 Payment & banking</Text>
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
    backgroundColor: colors.coral,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: colors.white },
  companyName: { fontSize: 20, fontWeight: '800', color: colors.dark, textAlign: 'center', marginBottom: 4 },
  companyReg: { fontSize: 13, color: colors.gray, marginBottom: 10 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#D1FAE5',
  },
  badgeText: { fontSize: 13, fontWeight: '600', color: colors.green },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    width: '47%',
    backgroundColor: colors.white,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.dark },
  statLabel: { fontSize: 11, color: colors.gray, marginTop: 4 },
  section: { paddingHorizontal: 24, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.dark, marginBottom: 10 },
  aboutText: { fontSize: 14, color: colors.gray, lineHeight: 22 },
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
