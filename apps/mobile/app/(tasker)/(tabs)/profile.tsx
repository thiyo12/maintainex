import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../lib/colors'
import { taskers } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import type { TaskerProfile } from '../../../lib/types'
import PressScale from '../../../components/find/PressScale'

export default function TaskerProfile() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [loading, setLoading] = useState(true)

  const handleLogout = async () => {
    await logout()
    router.replace('/')
  }
  const [profile, setProfile] = useState<TaskerProfile | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    if (!user?.id) return
    try {
      const data = await taskers.get(user.id)
      setProfile(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.amber} />
        </View>
      </SafeAreaView>
    )
  }

  const name = profile?.user?.name || user?.name || 'Tasker'
  const initial = name[0]
  const skills = profile?.skills || []
  const serviceAreas = profile?.serviceAreas || []
  const rating = profile?.rating || 0
  const completedJobs = profile?.completedJobs || 0

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            <Text style={[styles.role, { marginBottom: 0 }]}>Plumber • </Text>
            <Ionicons name="star" size={15} color="#F59E0B" />
            <Text style={[styles.role, { marginBottom: 0 }]}> {rating.toFixed(1)}</Text>
          </View>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.badgeText}> Verified</Text>
            </View>
            <View style={styles.badge}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginRight: 4 }} />
              <Text style={styles.badgeText}>Online</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{completedJobs}</Text>
            <Text style={styles.statLabel}>Jobs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{rating.toFixed(1)}</Text>
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
          <PressScale onPress={() => router.push('/settings/edit-profile')}>
            <View style={styles.menuRow}>
              <Ionicons name="create-outline" size={20} color={colors.ink} style={{ marginRight: 12 }} />
              <Text style={styles.menuLabel}>Edit profile</Text>
              <Text style={styles.menuArrow}>›</Text>
            </View>
          </PressScale>
          <PressScale onPress={() => Alert.alert('Coming soon', 'Payment features will be available in a future update.')}>
            <View style={styles.menuRow}>
              <Ionicons name="card-outline" size={20} color={colors.ink} style={{ marginRight: 12 }} />
              <Text style={styles.menuLabel}>Payment details</Text>
              <Text style={styles.menuArrow}>›</Text>
            </View>
          </PressScale>
          <PressScale onPress={() => Alert.alert('Coming soon', 'Notification settings will be available in a future update.')}>
            <View style={styles.menuRow}>
              <Ionicons name="notifications-outline" size={20} color={colors.ink} style={{ marginRight: 12 }} />
              <Text style={styles.menuLabel}>Notifications</Text>
              <Text style={styles.menuArrow}>›</Text>
            </View>
          </PressScale>
          <PressScale onPress={handleLogout}>
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
  container: { flex: 1, backgroundColor: colors.cream },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  profileHeader: { alignItems: 'center', paddingTop: 24, paddingBottom: 20 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.amber,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: colors.white },
  name: { fontSize: 22, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  role: { fontSize: 15, color: colors.muted, marginBottom: 10 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#D1FAE5',
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeText: { fontSize: 13, fontWeight: '600', color: colors.success },
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
  statValue: { fontSize: 18, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  section: { paddingHorizontal: 24, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 10 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  tagText: { fontSize: 13, fontWeight: '600', color: colors.ink },
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
  menuLabel: { fontSize: 15, fontWeight: '600', color: colors.ink },
  menuArrow: { fontSize: 22, color: colors.muted, fontWeight: '300' },
})
