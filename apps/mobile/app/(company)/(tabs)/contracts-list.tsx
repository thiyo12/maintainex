import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useColors } from '../../../lib/ThemeContext'
import { company } from '../../../lib/api'

type Tab = 'active' | 'completed' | 'all'

export default function CompanyContracts() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const [tab, setTab] = useState<Tab>('active')
  const [loading, setLoading] = useState(true)
  const [contracts, setContracts] = useState<any[]>([])

  const fetchContracts = useCallback(async () => {
    try {
      const data = await company.contracts.list()
      setContracts(data)
    } catch {
      setContracts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchContracts()
  }, [fetchContracts])

  const filtered = tab === 'all' ? contracts : contracts.filter(c =>
    tab === 'active'
      ? c.status === 'In progress' || c.status === 'active'
      : c.status === 'Completed' || c.status === 'completed'
  )

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
      <View style={styles.topBar}>
        <Text style={styles.heading}>Contracts</Text>
      </View>

      <View style={styles.tabs}>
        {(['active', 'completed', 'all'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <Text style={styles.emptyText}>No contracts found</Text>
        ) : (
          filtered.map((c) => (
            <TouchableOpacity key={c.id} style={styles.contractCard} activeOpacity={0.8}>
              <View style={styles.cardTop}>
                <Text style={styles.contractTitle} numberOfLines={1}>{c.title}</Text>
                <Text style={styles.contractValue}>LKR {Number(c.value).toLocaleString()}</Text>
              </View>
              <Text style={styles.contractClient}>{c.clientName} • #{c.id}</Text>
              <View style={styles.progressRow}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${c.progress}%`, backgroundColor: c.progress >= 100 ? colors.success : colors.amber }]} />
                </View>
                <Text style={styles.progressText}>{c.progress}%</Text>
              </View>
              <View style={styles.cardBottom}>
                <View style={[styles.contractStatus, { backgroundColor: c.status === 'Completed' || c.status === 'completed' ? '#D1FAE5' : '#FFF7ED' }]}>
                  <Text style={[styles.contractStatusText, { color: c.status === 'Completed' || c.status === 'completed' ? colors.success : colors.amber }]}>
                    {c.status}
                  </Text>
                </View>
                <Text style={styles.viewDetails}>View details ›</Text>
              </View>
            </TouchableOpacity>
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
  tabText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: colors.amber, fontWeight: '700' },
  contractCard: {
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
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  contractTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, flex: 1, marginRight: 8 },
  contractValue: { fontSize: 15, fontWeight: '700', color: colors.amber },
  contractClient: { fontSize: 13, color: colors.muted, marginBottom: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: 12, fontWeight: '600', color: colors.ink, width: 36 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contractStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  contractStatusText: { fontSize: 12, fontWeight: '600' },
  viewDetails: { fontSize: 13, color: colors.amber, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: colors.muted, marginTop: 40, fontSize: 14 },
})
