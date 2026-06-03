import { useEffect, useRef, useState, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Animated, ActivityIndicator, RefreshControl, Dimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../../lib/auth'
import { v2Jobs } from '../../../lib/api-v2'
import { colors } from '../../../lib/colors'
import { fonts } from '../../../lib/fonts'
import Badge from '../../../components/ui/Badge'
import Card from '../../../components/ui/Card'

const { width } = Dimensions.get('window')

const categories = [
  { id: '1', icon: '🔧', name: 'Plumbing' },
  { id: '2', icon: '⚡', name: 'Electric' },
  { id: '3', icon: '🏠', name: 'Cleaning' },
  { id: '4', icon: '🎨', name: 'Painting' },
  { id: '5', icon: '🌿', name: 'Garden' },
  { id: '6', icon: '❄️', name: 'AC' },
  { id: '7', icon: '📦', name: 'Moving' },
]

const statusBadgeVariant = (status: string) => {
  const map: Record<string, 'open' | 'pending' | 'inProgress' | 'completed' | 'cancelled'> = {
    OPEN: 'open',
    QUOTE_ACCEPTED: 'pending',
    IN_PROGRESS: 'inProgress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  }
  return map[status] || 'muted'
}

export default function CustomerHome() {
  const router = useRouter()
  const { user } = useAuth()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const [myJobs, setMyJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start()
    loadJobs()
  }, [])

  const loadJobs = async () => {
    try {
      const res = await v2Jobs.list()
      setMyJobs((res.jobs || []).slice(0, 5))
    } catch (e) {
      console.error('Load jobs error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <View style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadJobs() }} tintColor={colors.amber} />}
        >
          {/* Ink Gradient Header */}
          <View style={styles.header}>
            <SafeAreaView edges={['top']}>
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.greeting}>{getGreeting()} 👋</Text>
                  <Text style={styles.userName}>{user?.name || 'User'}</Text>
                </View>
                <TouchableOpacity style={styles.avatarBtn}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(user?.name || 'U')[0]}</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Post a New Job CTA */}
              <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/(customer)/jobs/v2/create')} activeOpacity={0.8}>
                  <View style={styles.ctaIconBox}>
                    <Ionicons name="add" size={24} color={colors.amber} />
                  </View>
                <Text style={styles.ctaText}>Post a New Job</Text>
              </TouchableOpacity>
            </SafeAreaView>
          </View>

          {/* Categories */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Services</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              {categories.map((cat) => (
                <TouchableOpacity key={cat.id} style={styles.catChip} activeOpacity={0.7}>
                  <Ionicons name="construct-outline" size={24} color={colors.muted} />
                  <Text style={styles.catName}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* My Posted Jobs */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Posted Jobs</Text>
            {loading ? (
              <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 20 }} />
            ) : myJobs.length === 0 ? (
              <Card padded style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyText}>No jobs yet</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(customer)/jobs/v2/create')}>
                  <Text style={styles.emptyBtnText}>Post your first job</Text>
                </TouchableOpacity>
              </Card>
            ) : (
              myJobs.map((job) => (
                <TouchableOpacity
                  key={job.id}
                  style={styles.jobCard}
                  onPress={() => router.push(`/(customer)/jobs/v2/${job.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.jobTop}>
                    <View style={styles.jobIconBox}>
                      <Ionicons name="briefcase-outline" size={20} color={colors.amber} />
                    </View>
                    <View style={styles.jobInfo}>
                      <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                      <Text style={styles.jobMeta}>
                        {job.locationName || 'No location'} • LKR {job.budgetAmount}
                      </Text>
                    </View>
                    <Badge label={job.status.replace(/_/g, ' ')} variant={statusBadgeVariant(job.status)} dot />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Quick Nav */}
          <View style={styles.navSection}>
            <TouchableOpacity style={styles.navCard} onPress={() => router.push('/(customer)/jobs/v2')} activeOpacity={0.7}>
              <View style={[styles.navIcon, { backgroundColor: colors.amberLight }]}>
                <Ionicons name="briefcase-outline" size={22} color={colors.amberDark} />
              </View>
              <View style={styles.navInfo}>
                <Text style={styles.navTitle}>My Marketplace Jobs</Text>
                <Text style={styles.navSub}>Post, track, and manage jobs</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.navCard} onPress={() => router.push('/(customer)/wallet')} activeOpacity={0.7}>
              <View style={[styles.navIcon, { backgroundColor: colors.amberLight }]}>
                <Ionicons name="wallet-outline" size={22} color={colors.amberDark} />
              </View>
              <View style={styles.navInfo}>
                <Text style={styles.navTitle}>Wallet</Text>
                <Text style={styles.navSub}>Manage balance and transactions</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },

  // Header
  header: {
    backgroundColor: colors.ink,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  greeting: { fontSize: 14, fontFamily: fonts.body, color: colors.muted, marginBottom: 2 },
  userName: { fontSize: 22, fontFamily: fonts.headingBold, color: colors.white },
  avatarBtn: {},
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.amber,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontFamily: fonts.bodyMedium, color: colors.ink },

  // CTA
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.amber,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    gap: 12,
  },
  ctaIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.ink, flex: 1 },

  // Sections
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.ink, marginBottom: 14 },

  // Categories
  catScroll: { marginLeft: -20, paddingLeft: 20 },
  catChip: {
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: colors.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    minWidth: 72,
  },
  catName: { fontSize: 11, fontFamily: fonts.bodyMedium, color: colors.ink },

  // Empty
  emptyCard: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.ink, marginBottom: 12 },
  emptyBtn: { backgroundColor: colors.amber, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  emptyBtnText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.ink },

  // Job Card
  jobCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  jobTop: { flexDirection: 'row', alignItems: 'center' },
  jobIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.amberBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  jobInfo: { flex: 1, marginRight: 8 },
  jobTitle: { fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.ink, marginBottom: 2 },
  jobMeta: { fontSize: 12, fontFamily: fonts.body, color: colors.muted },

  // Nav
  navSection: { paddingHorizontal: 20, marginTop: 24, gap: 10, paddingBottom: 100 },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  navIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  navInfo: { flex: 1, marginLeft: 12 },
  navTitle: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.ink },
  navSub: { fontSize: 11, fontFamily: fonts.bodyLight, color: colors.muted, marginTop: 1 },
})
