import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../lib/ThemeContext'
import { company } from '../../../lib/api'

export default function CompanyMilestones() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [milestones, setMilestones] = useState<any[]>([])

  const fetchMilestones = useCallback(async () => {
    try {
      const data = await company.milestones.list()
      setMilestones(data)
    } catch {
      setMilestones([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMilestones()
  }, [fetchMilestones])

  const filtered = filter === 'all'
    ? milestones
    : milestones.filter(m => (m.status?.toLowerCase() || '') === filter)

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.amber} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>{t('company.milestones')}</Text>
      </View>

      <View style={styles.tabs}>
        {['all', 'approved', 'pending', 'in review'].map((tabKey) => (
          <TouchableOpacity
            key={tabKey}
            style={[styles.tab, filter === tabKey && styles.tabActive]}
            onPress={() => setFilter(tabKey)}
          >
            <Text style={[styles.tabText, filter === tabKey && styles.tabTextActive]}>
              {tabKey === 'all' ? t('components.viewAll') : tabKey === 'pending' ? t('common.pending') : tabKey === 'in review' ? t('verify.status.pending') : tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <Text style={styles.emptyText}>{t('common.noResults')}</Text>
        ) : (
          filtered.map((m, i) => (
            <View key={m.id || i} style={styles.milestoneCard}>
              <View style={styles.cardLeft}>
                <View style={[styles.statusDot, {
                  backgroundColor: m.status === 'Approved' || m.status === 'approved'
                    ? colors.success
                    : m.status === 'Pending' || m.status === 'pending'
                    ? colors.amber
                    : colors.amber,
                }]} />
                <View style={styles.cardContent}>
                  <Text style={styles.milestoneTitle}>{m.title}</Text>
                  <Text style={styles.milestoneContract}>{m.contract || m.contractName}</Text>
                  <View style={styles.milestoneBottom}>
                    <Text style={styles.milestoneAmount}>LKR {Number(m.amount).toLocaleString()}</Text>
                    <Text style={styles.milestoneDate}>{m.date || (m.dueDate ? new Date(m.dueDate).toLocaleDateString() : '')}</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.statusBadge, {
                backgroundColor: m.status === 'Approved' || m.status === 'approved'
                  ? '#D1FAE5'
                  : m.status === 'Pending' || m.status === 'pending'
                  ? '#FFFBEB'
                  : '#FFF7ED',
              }]}>
                <Text style={[styles.statusText, {
                  color: m.status === 'Approved' || m.status === 'approved'
                    ? colors.success
                    : m.status === 'Pending' || m.status === 'pending'
                    ? colors.amber
                    : colors.amber,
                }]}>
                  {m.status}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  topBar: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  heading: { fontSize: 28, fontWeight: '800', color: colors.ink },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: colors.border,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: colors.white },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: colors.amber, fontWeight: '700' },
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
  milestoneTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 2 },
  milestoneContract: { fontSize: 12, color: colors.muted, marginBottom: 6 },
  milestoneBottom: { flexDirection: 'row', gap: 12 },
  milestoneAmount: { fontSize: 13, fontWeight: '700', color: colors.ink },
  milestoneDate: { fontSize: 12, color: colors.muted },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginLeft: 8 },
  statusText: { fontSize: 11, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: colors.muted, marginTop: 40, fontSize: 14 },
})
