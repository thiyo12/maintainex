import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const colors = {
  coral: '#F97316',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  white: '#FFFFFF',
  green: '#10B981',
  primary: '#F59E0B',
}

const milestones = [
  { contract: 'City Hotel - Plumbing', title: 'Site inspection complete', amount: 85000, status: 'Approved', date: 'May 14' },
  { contract: 'City Hotel - Plumbing', title: 'Materials delivered', amount: 170000, status: 'Pending', date: 'May 20' },
  { contract: 'City Hotel - Plumbing', title: 'Phase 1 installation', amount: 255000, status: 'In review', date: 'Jun 01' },
  { contract: 'Sunil Perera - Rewiring', title: 'Initial assessment', amount: 25000, status: 'Approved', date: 'May 12' },
  { contract: 'Sunil Perera - Rewiring', title: 'Wiring complete', amount: 50000, status: 'Pending', date: 'May 25' },
]

export default function CompanyMilestones() {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? milestones : milestones.filter(m => m.status.toLowerCase() === filter)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Milestones</Text>
      </View>

      <View style={styles.tabs}>
        {['all', 'approved', 'pending', 'in review'].map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, filter === t && styles.tabActive]}
            onPress={() => setFilter(t)}
          >
            <Text style={[styles.tabText, filter === t && styles.tabTextActive]}>
              {t === 'in review' ? 'Review' : t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {filtered.map((m, i) => (
          <View key={i} style={styles.milestoneCard}>
            <View style={styles.cardLeft}>
              <View style={[styles.statusDot, {
                backgroundColor: m.status === 'Approved' ? colors.green : m.status === 'Pending' ? colors.primary : colors.coral,
              }]} />
              <View style={styles.cardContent}>
                <Text style={styles.milestoneTitle}>{m.title}</Text>
                <Text style={styles.milestoneContract}>{m.contract}</Text>
                <View style={styles.milestoneBottom}>
                  <Text style={styles.milestoneAmount}>LKR {m.amount.toLocaleString()}</Text>
                  <Text style={styles.milestoneDate}>{m.date}</Text>
                </View>
              </View>
            </View>
            <View style={[styles.statusBadge, {
              backgroundColor: m.status === 'Approved' ? '#D1FAE5' : m.status === 'Pending' ? '#FFFBEB' : '#FFF7ED',
            }]}>
              <Text style={[styles.statusText, {
                color: m.status === 'Approved' ? colors.green : m.status === 'Pending' ? colors.primary : colors.coral,
              }]}>
                {m.status}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  topBar: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: colors.lightGray,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: colors.white },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.gray },
  tabTextActive: { color: colors.coral, fontWeight: '700' },
  milestoneCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  cardLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  cardContent: { flex: 1 },
  milestoneTitle: { fontSize: 14, fontWeight: '700', color: colors.dark, marginBottom: 2 },
  milestoneContract: { fontSize: 12, color: colors.gray, marginBottom: 6 },
  milestoneBottom: { flexDirection: 'row', gap: 12 },
  milestoneAmount: { fontSize: 13, fontWeight: '700', color: colors.dark },
  milestoneDate: { fontSize: 12, color: colors.gray },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginLeft: 8 },
  statusText: { fontSize: 11, fontWeight: '600' },
})
