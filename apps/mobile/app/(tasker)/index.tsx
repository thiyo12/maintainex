import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const colors = {
  teal: '#0D9488',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  white: '#FFFFFF',
  green: '#10B981',
  primary: '#F59E0B',
}

const nearbyJobs = [
  { title: 'Fix leaking pipe', location: 'Colombo 03', distance: '1.2 km', budget: 8500, urgency: 'Today' },
  { title: 'Electrical rewiring', location: 'Colombo 05', distance: '2.5 km', budget: 15000, urgency: 'This week' },
  { title: 'Paint 2-bedroom apt', location: 'Colombo 07', distance: '3.8 km', budget: 25000, urgency: 'Flexible' },
]

export default function TaskerHome() {
  const router = useRouter()
  const [isOnline, setIsOnline] = useState(true)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>Hello, Kamal 👋</Text>
          <Text style={styles.location}>📍 Colombo, Sri Lanka</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>K</Text>
        </View>
      </View>

      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <View style={[styles.statusDot, isOnline && styles.statusDotOnline]} />
          <Text style={styles.statusLabel}>{isOnline ? 'Online' : 'Offline'}</Text>
        </View>
        <Switch
          value={isOnline}
          onValueChange={setIsOnline}
          trackColor={{ false: colors.lightGray, true: colors.teal }}
          thumbColor={colors.white}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>💰</Text>
            <Text style={styles.statValue}>LKR 45,200</Text>
            <Text style={styles.statLabel}>This month</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>✅</Text>
            <Text style={styles.statValue}>47</Text>
            <Text style={styles.statLabel}>Jobs done</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>⭐</Text>
            <Text style={styles.statValue}>4.8</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapEmoji}>🗺️</Text>
          <Text style={styles.mapTitle}>Jobs near you</Text>
          <Text style={styles.mapSub}>12 jobs available within 5 km</Text>
        </View>

        <Text style={styles.sectionTitle}>Nearby jobs</Text>
        {nearbyJobs.map((job, i) => (
          <TouchableOpacity
            key={i}
            style={styles.jobCard}
            onPress={() => router.push('/(tasker)/jobs/' + (i + 1))}
          >
            <View style={styles.jobTop}>
              <Text style={styles.jobTitle}>{job.title}</Text>
              <Text style={styles.jobBudget}>LKR {job.budget.toLocaleString()}</Text>
            </View>
            <View style={styles.jobTags}>
              <View style={styles.jobTag}>
                <Text style={styles.jobTagText}>📍 {job.distance}</Text>
              </View>
              <View style={[styles.jobTag, { backgroundColor: job.urgency === 'Today' ? '#FEF3C7' : '#E0E7FF' }]}>
                <Text style={[styles.jobTagText, { color: job.urgency === 'Today' ? '#D97706' : '#4F46E5' }]}>
                  {job.urgency}
                </Text>
              </View>
            </View>
            <Text style={styles.jobLocation}>{job.location}</Text>
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
    paddingBottom: 12,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.dark },
  location: { fontSize: 13, color: colors.gray, marginTop: 4 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.teal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.white },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 24,
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.gray,
  },
  statusDotOnline: { backgroundColor: colors.green },
  statusLabel: { fontSize: 16, fontWeight: '600', color: colors.dark },
  statsRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statIcon: { fontSize: 24, marginBottom: 6 },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.dark },
  statLabel: { fontSize: 11, color: colors.gray, marginTop: 2 },
  mapPlaceholder: {
    backgroundColor: colors.teal,
    marginHorizontal: 24,
    borderRadius: 20,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  mapEmoji: { fontSize: 40, marginBottom: 8 },
  mapTitle: { fontSize: 18, fontWeight: '700', color: colors.white, marginBottom: 4 },
  mapSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.dark,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  jobCard: {
    backgroundColor: colors.white,
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  jobTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  jobTitle: { fontSize: 15, fontWeight: '700', color: colors.dark, flex: 1 },
  jobBudget: { fontSize: 15, fontWeight: '700', color: colors.teal },
  jobTags: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  jobTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#FFFBEB',
  },
  jobTagText: { fontSize: 12, fontWeight: '600', color: '#D97706' },
  jobLocation: { fontSize: 13, color: colors.gray },
})
