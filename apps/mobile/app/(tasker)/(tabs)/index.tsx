import { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Switch } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../lib/colors'
import { fonts } from '../../../lib/fonts'
import { v2Jobs } from '../../../lib/api-v2'
import { useAuth } from '../../../lib/auth'
import Badge from '../../../components/ui/Badge'

const services = [
  { id: '1', icon: 'water-outline', name: 'Plumbing', color: '#DBEAFE' },
  { id: '2', icon: 'flash-outline', name: 'Electrical', color: '#FEF3C7' },
  { id: '3', icon: 'sparkles-outline', name: 'Cleaning', color: '#D1FAE5' },
  { id: '4', icon: 'color-palette-outline', name: 'Painting', color: '#EDE9FE' },
  { id: '5', icon: 'hammer-outline', name: 'Carpentry', color: '#FEE2E2' },
]

export default function TaskerDashboard() {
  const router = useRouter()
  const { user } = useAuth()
  const [isOnline, setIsOnline] = useState(true)
  const [openJobs, setOpenJobs] = useState<any[]>([])
  const [myJobs, setMyJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [openRes, myRes] = await Promise.all([
        v2Jobs.list('role=provider'),
        v2Jobs.list('myQuotes=true'),
      ])
      setOpenJobs((openRes.jobs || []).slice(0, 3))
      setMyJobs(myRes.jobs || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const profile = { rating: 4.0, completedJobs: 12, activeCount: myJobs.filter((j: any) => j.status === 'IN_PROGRESS').length }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Ink Dark Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(user?.name || 'T')[0]}</Text>
              </View>
              <View>
                <Text style={styles.greeting}>{getGreeting()}</Text>
                <Text style={styles.userName}>{user?.name || 'Tasker'}</Text>
                <Text style={styles.role}>Service Provider</Text>
              </View>
            </View>
            <View style={styles.onlineToggle}>
              <Text style={styles.onlineLabel}>{isOnline ? 'Online' : 'Offline'}</Text>
              <Switch
                value={isOnline}
                onValueChange={setIsOnline}
                trackColor={{ false: colors.muted, true: colors.amber }}
                thumbColor={isOnline ? colors.white : colors.muted}
              />
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.rating.toFixed(1)}★</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.completedJobs}</Text>
              <Text style={styles.statLabel}>Jobs Done</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.activeCount}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <Ionicons name="search-outline" size={18} color={colors.muted} style={{ marginRight: 8 }} />
              <TextInput style={styles.searchInput} placeholder="Search services…" placeholderTextColor={colors.muted} />
            </View>
            <TouchableOpacity style={styles.filterBtn}>
              <Ionicons name="options-outline" size={18} color={colors.ink} />
            </TouchableOpacity>
          </View>
        </View>

        {/* My Services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Services</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.servicesContent}>
            {services.map((s) => (
              <TouchableOpacity key={s.id} style={styles.serviceCard}>
                <View style={[styles.serviceIconWrap, { backgroundColor: s.color }]}>
                  <Ionicons name={s.icon as any} size={24} color={colors.ink} />
                </View>
                <Text style={styles.serviceName}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Active Job */}
        {myJobs.filter((j: any) => j.status === 'IN_PROGRESS').length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Active Job</Text>
              <Badge label="In Progress" variant="inProgress" dot />
            </View>
            {myJobs.filter((j: any) => j.status === 'IN_PROGRESS').slice(0, 1).map((job: any) => (
              <TouchableOpacity
                key={job.id}
                style={styles.activeJobCard}
                onPress={() => router.push(`/(tasker)/jobs/v2/manage/${job.id}`)}
                activeOpacity={0.7}
              >
                <Text style={styles.activeJobTitle}>{job.title}</Text>
                <Text style={styles.activeJobPrice}>LKR {job.budgetAmount}</Text>
                <View style={styles.activeJobCustomer}>
                  <View style={styles.customerAvatarSmall}>
                    <Text style={styles.customerAvatarSmallText}>C</Text>
                  </View>
                  <Text style={styles.customerNameText}>Customer</Text>
                  <TouchableOpacity style={styles.trackBtn}>
                    <Text style={styles.trackBtnText}>Track →</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* New Job Alerts */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>New Job Alerts</Text>
            <TouchableOpacity onPress={() => router.push('/(tasker)/jobs/v2/browse')}>
              <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 20 }} />
          ) : openJobs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="search-outline" size={36} color={colors.muted} />
              <Text style={styles.emptyText}>No open jobs right now</Text>
            </View>
          ) : (
            openJobs.map((job) => (
              <TouchableOpacity
                key={job.id}
                style={styles.alertCard}
                onPress={() => router.push(`/(tasker)/jobs/v2/quote/${job.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.alertTop}>
                  <Badge label={`LKR ${job.budgetAmount}`} variant="amber" />
                  <Text style={styles.alertType}>{job.budgetType}</Text>
                </View>
                <Text style={styles.alertTitle} numberOfLines={1}>{job.title}</Text>
                <Text style={styles.alertDesc} numberOfLines={2}>{job.description}</Text>
                <View style={styles.alertFooter}>
                  <Text style={styles.alertDate}>{new Date(job.createdAt).toLocaleDateString()}</Text>
                  <TouchableOpacity style={styles.alertQuoteBtn}>
                    <Text style={styles.alertQuoteBtnText}>Send Quote →</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Quick Nav */}
        <View style={styles.navSection}>
          <TouchableOpacity style={styles.navCard} onPress={() => router.push('/(tasker)/jobs/v2/browse')} activeOpacity={0.7}>
            <View style={[styles.navIcon, { backgroundColor: colors.amberLight }]}>
              <Ionicons name="storefront-outline" size={22} color={colors.amberDark} />
            </View>
            <View style={styles.navInfo}>
              <Text style={styles.navTitle}>Marketplace Jobs</Text>
              <Text style={styles.navSub}>Browse and quote on open jobs</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.navCard} onPress={() => router.push('/(tasker)/jobs/v2/my-jobs')} activeOpacity={0.7}>
            <View style={[styles.navIcon, { backgroundColor: colors.amberLight }]}>
              <Ionicons name="briefcase-outline" size={22} color={colors.amberDark} />
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

  header: { backgroundColor: colors.ink, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.amber, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.ink },
  greeting: { fontSize: 12, fontFamily: fonts.body, color: colors.muted },
  userName: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.white },
  role: { fontSize: 11, fontFamily: fonts.body, color: colors.muted, marginTop: 1 },
  onlineToggle: { alignItems: 'flex-end' },
  onlineLabel: { fontSize: 11, fontFamily: fonts.bodyMedium, color: colors.amber, marginBottom: 4 },

  statsRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, gap: 8 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 18, fontFamily: fonts.heading, color: colors.amber },
  statLabel: { fontSize: 10, fontFamily: fonts.body, color: colors.muted, marginTop: 2 },

  searchRow: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 16, gap: 10 },
  searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 14, height: 44, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: fonts.body, color: colors.ink },
  filterBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.amber, justifyContent: 'center', alignItems: 'center' },

  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.ink },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  seeAll: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.amber },

  servicesContent: { gap: 12, paddingRight: 20 },
  serviceCard: { alignItems: 'center', marginRight: 14, width: 72 },
  serviceIconWrap: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 6, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  serviceName: { fontSize: 11, fontFamily: fonts.bodyMedium, color: colors.ink, textAlign: 'center' },

  activeJobCard: { backgroundColor: colors.white, borderRadius: 18, padding: 18, shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  activeJobTitle: { fontSize: 17, fontFamily: fonts.bodyMedium, color: colors.ink, marginBottom: 4 },
  activeJobPrice: { fontSize: 14, fontFamily: fonts.body, color: colors.primaryDark, marginBottom: 14 },
  activeJobCustomer: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 },
  customerAvatarSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.amberLight, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  customerAvatarSmallText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.amberDark },
  customerNameText: { flex: 1, fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink },
  trackBtn: { backgroundColor: colors.amber, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  trackBtnText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink },

  alertCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 10, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  alertTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  alertType: { fontSize: 11, fontFamily: fonts.bodyMedium, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  alertTitle: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.ink, marginBottom: 6 },
  alertDesc: { fontSize: 13, fontFamily: fonts.body, color: colors.ink, opacity: 0.6, lineHeight: 20, marginBottom: 12 },
  alertFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertDate: { fontSize: 12, fontFamily: fonts.bodyLight, color: colors.muted },
  alertQuoteBtn: { backgroundColor: colors.amber, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  alertQuoteBtnText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink },

  emptyCard: { backgroundColor: colors.white, borderRadius: 16, padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.muted },

  navSection: { paddingHorizontal: 20, marginTop: 24, gap: 10, paddingBottom: 100 },
  navCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 14, padding: 14, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  navIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  navInfo: { flex: 1, marginLeft: 12 },
  navTitle: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.ink },
  navSub: { fontSize: 11, fontFamily: fonts.bodyLight, color: colors.muted, marginTop: 1 },
})
