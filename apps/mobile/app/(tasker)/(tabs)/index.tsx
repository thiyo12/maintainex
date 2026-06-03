import { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Dimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../lib/colors'
import { v2Jobs, v2JobActions } from '../../../lib/api-v2'
import { useAuth } from '../../../lib/auth'

const { width } = Dimensions.get('window')

const services = [
  { id: '1', icon: '🔧', name: 'Plumbing', color: '#DBEAFE' },
  { id: '2', icon: '⚡', name: 'Electrical', color: '#FEF3C7' },
  { id: '3', icon: '🏠', name: 'Cleaning', color: '#D1FAE5' },
  { id: '4', icon: '🎨', name: 'Painting', color: '#EDE9FE' },
  { id: '5', icon: '🔩', name: 'Carpentry', color: '#FEE2E2' },
]

export default function TaskerDashboard() {
  const router = useRouter()
  const { user } = useAuth()
  const [activeJobs, setActiveJobs] = useState<any[]>([])
  const [profile, setProfile] = useState({ rating: 4.0, completedJobs: 12, activeCount: 1 })
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const res = await v2Jobs.list('myQuotes=true')
      const all = res.jobs || []
      const active = all.filter((j: any) => j.status === 'IN_PROGRESS' || j.status === 'QUOTE_ACCEPTED')
      setActiveJobs(active.slice(0, 3))
      setProfile({ rating: 4.0, completedJobs: 12, activeCount: active.length })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const getHours = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const activeJob = activeJobs[0]

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getHours()} 👋</Text>
            <Text style={styles.name}>{user?.name || 'Tasker'}</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={22} color={colors.ink} />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search-outline" size={18} color={colors.muted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search services…"
              placeholderTextColor={colors.muted}
            />
          </View>
          <TouchableOpacity style={styles.filterBtn}>
            <Ionicons name="options-outline" size={18} color={colors.ink} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile.rating.toFixed(1)}★</Text>
            <Text style={styles.statLabel}>Your rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile.completedJobs}</Text>
            <Text style={styles.statLabel}>Jobs done</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile.activeCount}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>

        {/* My Services */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Services</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.servicesScroll} contentContainerStyle={styles.servicesContent}>
          {services.map((s) => (
            <TouchableOpacity key={s.id} style={styles.serviceCard}>
              <View style={[styles.serviceIconWrap, { backgroundColor: s.color }]}>
                <Text style={styles.serviceIcon}>{s.icon}</Text>
              </View>
              <Text style={styles.serviceName}>{s.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Active Job */}
        {activeJob ? (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Job</Text>
            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeBadgeText}>In Progress</Text>
            </View>
          </View>
        ) : (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Job</Text>
          </View>
        )}

        {activeJob ? (
          <View style={styles.activeJobCard}>
            <View style={styles.activeJobTop}>
              <View style={styles.activeJobInfo}>
                <Text style={styles.activeJobTitle}>{activeJob.title}</Text>
                <Text style={styles.activeJobEst}>Est. completion: 2:30 PM</Text>
              </View>
            </View>
            <View style={styles.activeJobCustomer}>
              <View style={styles.customerAvatar}>
                <Text style={styles.customerAvatarText}>R</Text>
              </View>
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>Ranil S.</Text>
                <Text style={styles.customerLabel}>Customer</Text>
              </View>
              <TouchableOpacity
                style={styles.trackBtn}
                onPress={() => router.push(`/(tasker)/jobs/v2/manage/${activeJob.id}`)}
              >
                <Text style={styles.trackBtnText}>Track →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.noActiveCard}>
            <Text style={styles.noActiveIcon}>📭</Text>
            <Text style={styles.noActiveText}>No active jobs</Text>
            <Text style={styles.noActiveSub}>Browse marketplace to find new work</Text>
          </View>
        )}

        {/* Quick Nav */}
        <View style={styles.navSection}>
          <TouchableOpacity
            style={styles.navCard}
            onPress={() => router.push('/(tasker)/jobs/v2/browse')}
            activeOpacity={0.7}
          >
            <View style={[styles.navIconWrap, { backgroundColor: colors.amberLight }]}>
              <Ionicons name="storefront-outline" size={24} color={colors.amberDark} />
            </View>
            <View style={styles.navInfo}>
              <Text style={styles.navTitle}>Marketplace Jobs</Text>
              <Text style={styles.navSub}>Browse and quote on open jobs</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navCard}
            onPress={() => router.push('/(tasker)/tabs/my-jobs')}
            activeOpacity={0.7}
          >
            <View style={[styles.navIconWrap, { backgroundColor: colors.amberLight }]}>
              <Ionicons name="briefcase-outline" size={24} color={colors.amberDark} />
            </View>
            <View style={styles.navInfo}>
              <Text style={styles.navTitle}>My Marketplace Jobs</Text>
              <Text style={styles.navSub}>Track your quotes and active jobs</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  scrollContent: { paddingBottom: 24 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  headerLeft: {},
  greeting: { fontSize: 15, fontWeight: '600', color: colors.muted, marginBottom: 2 },
  name: { fontSize: 22, fontWeight: '800', color: colors.ink },
  notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  notifDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error },

  searchRow: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 16, marginBottom: 20, gap: 10 },
  searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 14, height: 46, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink },
  filterBtn: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.amber, justifyContent: 'center', alignItems: 'center', shadowColor: colors.amber, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },

  statsRow: { flexDirection: 'row', backgroundColor: colors.white, marginHorizontal: 20, borderRadius: 16, padding: 6, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 2, fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 12 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 24, marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  seeAll: { fontSize: 13, color: colors.amber, fontWeight: '600' },

  servicesScroll: { marginLeft: 20, marginBottom: 4 },
  servicesContent: { paddingRight: 20, gap: 12 },
  serviceCard: { alignItems: 'center', marginRight: 14, width: 72 },
  serviceIconWrap: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 6, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  serviceIcon: { fontSize: 24 },
  serviceName: { fontSize: 11, fontWeight: '600', color: colors.ink, textAlign: 'center' },

  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.amberBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber },
  activeBadgeText: { fontSize: 12, fontWeight: '600', color: colors.amberDark },

  activeJobCard: { backgroundColor: colors.white, marginHorizontal: 20, borderRadius: 18, padding: 18, shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  activeJobTop: { marginBottom: 16 },
  activeJobInfo: {},
  activeJobTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  activeJobEst: { fontSize: 13, color: colors.muted },
  activeJobCustomer: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 },
  customerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.amberLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  customerAvatarText: { fontSize: 16, fontWeight: '700', color: colors.amberDark },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  customerLabel: { fontSize: 11, color: colors.muted, marginTop: 1 },
  trackBtn: { backgroundColor: colors.amber, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  trackBtnText: { fontSize: 13, fontWeight: '700', color: colors.ink },

  noActiveCard: { backgroundColor: colors.white, marginHorizontal: 20, borderRadius: 18, padding: 24, alignItems: 'center', shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  noActiveIcon: { fontSize: 36, marginBottom: 8 },
  noActiveText: { fontSize: 16, fontWeight: '600', color: colors.ink, marginBottom: 4 },
  noActiveSub: { fontSize: 13, color: colors.muted },

  navSection: { paddingHorizontal: 20, marginTop: 24, gap: 10 },
  navCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 14, padding: 14, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  navIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  navInfo: { flex: 1, marginLeft: 12 },
  navTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  navSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
})
