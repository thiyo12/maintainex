import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, ActivityIndicator, Animated, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/colors'
import { jobs, taskers } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import type { JobPosting } from '../../lib/types'
import PressScale from '../../components/find/PressScale'

export default function TaskerHome() {
  const router = useRouter()
  const { user } = useAuth()
  const [isOnline, setIsOnline] = useState(true)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [nearbyJobs, setNearbyJobs] = useState<JobPosting[]>([])
  const [profile, setProfile] = useState({ rating: 0, completedJobs: 0 })

  const loadData = useCallback(async () => {
    try {
      const [jobsData, taskerData] = await Promise.all([
        jobs.list('status=OPEN'),
        user?.id ? taskers.get(user.id) : Promise.resolve(null),
      ])
      setNearbyJobs(jobsData)
      if (taskerData) {
        setProfile({ rating: taskerData.rating, completedJobs: taskerData.completedJobs })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'Tasker'}</Text>
            <Ionicons name="hand-left-outline" size={22} color={colors.primary} style={{ marginLeft: 6 }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons name="location-outline" size={14} color={colors.gray} />
            <Text style={styles.location}> Colombo, Sri Lanka</Text>
          </View>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.name || 'T')[0]}</Text>
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
          trackColor={{ false: colors.lightGray, true: colors.primary }}
          thumbColor={colors.white}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}
        >
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="cash-outline" size={24} color={colors.teal} style={{ marginBottom: 6 }} />
              <Text style={styles.statValue}>LKR 45,200</Text>
              <Text style={styles.statLabel}>This month</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-done-outline" size={24} color={colors.teal} style={{ marginBottom: 6 }} />
              <Text style={styles.statValue}>{profile.completedJobs}</Text>
              <Text style={styles.statLabel}>Jobs done</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="star" size={24} color="#F59E0B" style={{ marginBottom: 6 }} />
              <Text style={styles.statValue}>{profile.rating.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>

          <View style={styles.mapPlaceholder}>
            <Ionicons name="map" size={40} color="rgba(255,255,255,0.9)" style={{ marginBottom: 8 }} />
            <Text style={styles.mapTitle}>Jobs near you</Text>
            <Text style={styles.mapSub}>{nearbyJobs.length} jobs available within 5 km</Text>
          </View>

          <Text style={styles.sectionTitle}>Nearby jobs</Text>
          {nearbyJobs.map((job, i) => (
            <TouchableOpacity
              key={job.id}
              style={styles.jobCard}
              onPress={() => router.push('/(tasker)/jobs/' + job.id as any)}
            >
              <View style={styles.jobTop}>
                <Text style={styles.jobTitle}>{job.title}</Text>
                <Text style={styles.jobBudget}>LKR {job.budget.toLocaleString()}</Text>
              </View>
              <View style={styles.jobTags}>
                <View style={styles.jobTag}>
                  <Ionicons name="location-outline" size={12} color="#D97706" />
                  <Text style={styles.jobTagText}> {job.location}</Text>
                </View>
                <View style={[styles.jobTag, { backgroundColor: '#E0E7FF' }]}>
                  <Text style={[styles.jobTagText, { color: '#4F46E5' }]}>
                    {job.category}
                  </Text>
                </View>
              </View>
              <Text style={styles.jobLocation}>{job.customer?.name} • {new Date(job.createdAt).toLocaleDateString()}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
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
    backgroundColor: colors.primaryDark,
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
  statValue: { fontSize: 16, fontWeight: '800', color: colors.dark },
  statLabel: { fontSize: 11, color: colors.gray, marginTop: 2 },
  mapPlaceholder: {
    backgroundColor: colors.primary,
    marginHorizontal: 24,
    borderRadius: 20,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  jobTagText: { fontSize: 12, fontWeight: '600', color: '#D97706' },
  jobLocation: { fontSize: 13, color: colors.gray },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
})
