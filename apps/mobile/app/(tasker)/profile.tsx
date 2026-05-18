import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/colors'
import { taskers } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import type { TaskerProfile } from '../../lib/types'

function PressScale({ onPress, children, style }: any) {
  const scale = useRef(new Animated.Value(1)).current
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={1}
      onPressIn={() => Animated.spring(scale, { toValue: 0.95, friction: 8, tension: 100, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }).start()}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </TouchableOpacity>
  )
}

export default function TaskerProfile() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [loading, setLoading] = useState(true)
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
          <ActivityIndicator size="large" color={colors.primary} />
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
              <Ionicons name="checkmark-circle" size={14} color={colors.green} />
              <Text style={styles.badgeText}> Verified</Text>
            </View>
            <View style={styles.badge}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green, marginRight: 4 }} />
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
          <PressScale>
            <View style={styles.menuRow}>
              <Ionicons name="create-outline" size={20} color={colors.dark} style={{ marginRight: 12 }} />
              <Text style={styles.menuLabel}>Edit profile</Text>
              <Text style={styles.menuArrow}>›</Text>
            </View>
          </PressScale>
          <PressScale>
            <View style={styles.menuRow}>
              <Ionicons name="card-outline" size={20} color={colors.dark} style={{ marginRight: 12 }} />
              <Text style={styles.menuLabel}>Payment details</Text>
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
    flexDirection: 'row',
    alignItems: 'center',
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
