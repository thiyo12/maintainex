import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/colors'
import { company } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import PressScale from '../../components/find/PressScale'

export default function CompanyProfile() {
  const { logout } = useAuth()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)

  const fetchProfile = useCallback(async () => {
    try {
      const data = await company.profile.get()
      setProfile(data)
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const name = profile?.companyName || profile?.name || 'Premium Builders (Pvt) Ltd'
  const regNumber = profile?.registrationNumber || profile?.regNumber || 'GST-12345678'
  const initials = (name.split(' ').map((s: string) => s[0]).join('').slice(0, 2) || 'PB').toUpperCase()
  const about = profile?.about || profile?.description || `${name} is a licensed construction and maintenance company specializing in plumbing, electrical, and renovation services for commercial and residential clients in Colombo.`
  const services = profile?.services || ['Plumbing', 'Electrical', 'Painting', 'Renovation', 'AC Installation', 'Construction']
  const serviceAreas = profile?.serviceAreas || profile?.areas || ['Colombo', 'Gampaha', 'Kalutara', 'Negombo']
  const rating = profile?.rating || '4.7'
  const activeContracts = profile?.activeContracts || profile?.activeContractCount || 12
  const teamMembers = profile?.teamMembers || profile?.teamCount || 8
  const projectsDone = profile?.projectsDone || profile?.completedProjects || 47
  const inBusiness = profile?.inBusiness || profile?.yearsInBusiness || '3 yr'

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.companyName}>{name}</Text>
          <Text style={styles.companyReg}>Registered • {regNumber}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.green} />
              <Text style={styles.badgeText}> Verified</Text>
            </View>
            <View style={styles.badge}>
              <Ionicons name="star" size={14} color={colors.green} />
              <Text style={styles.badgeText}> {rating}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activeContracts}</Text>
            <Text style={styles.statLabel}>Active contracts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{teamMembers}</Text>
            <Text style={styles.statLabel}>Team members</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{projectsDone}</Text>
            <Text style={styles.statLabel}>Projects done</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{inBusiness}</Text>
            <Text style={styles.statLabel}>In business</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.aboutText}>{about}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services</Text>
          <View style={styles.tagRow}>
            {services.map((s: string) => (
              <View key={s} style={styles.tag}><Text style={styles.tagText}>{s}</Text></View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service areas</Text>
          <View style={styles.tagRow}>
            {serviceAreas.map((a: string) => (
              <View key={a} style={styles.tag}><Text style={styles.tagText}>{a}</Text></View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <PressScale>
            <View style={styles.menuRow}>
              <Ionicons name="create-outline" size={20} color={colors.dark} style={{ marginRight: 12 }} />
              <Text style={styles.menuLabel}>Edit company profile</Text>
              <Text style={styles.menuArrow}>›</Text>
            </View>
          </PressScale>
          <PressScale>
            <View style={styles.menuRow}>
              <Ionicons name="card-outline" size={20} color={colors.dark} style={{ marginRight: 12 }} />
              <Text style={styles.menuLabel}>Payment & banking</Text>
              <Text style={styles.menuArrow}>›</Text>
            </View>
          </PressScale>
          <PressScale>
            <View style={styles.menuRow}>
              <Ionicons name="notifications-outline" size={20} color={colors.dark} style={{ marginRight: 12 }} />
              <Text style={styles.menuLabel}>Notifications</Text>
              <Text style={styles.menuArrow}>›</Text>
            </View>
          </PressScale>
          <PressScale onPress={logout}>
            <View style={styles.menuRow}>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" style={{ marginRight: 12 }} />
              <Text style={[styles.menuLabel, { color: '#EF4444' }]}>Log out</Text>
              <Text style={[styles.menuArrow, { color: '#EF4444' }]}>›</Text>
            </View>
          </PressScale>
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
    backgroundColor: colors.companyAccent,
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
    flexDirection: 'row',
    alignItems: 'center',
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
