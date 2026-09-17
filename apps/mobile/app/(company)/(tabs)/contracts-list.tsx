import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { company } from '../../../lib/api'

type Tab = 'active' | 'completed' | 'all'

export default function CompanyContracts() {
  const { t } = useTranslation()
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
          <ActivityIndicator size="large" color={'#F5A623'} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>{t('company.contracts')}</Text>
      </View>

      <View style={styles.tabs}>
        {(['active', 'completed', 'all'] as Tab[]).map((tabKey) => (
          <TouchableOpacity
            key={tabKey}
            style={[styles.tab, tab === tabKey && styles.tabActive]}
            onPress={() => setTab(tabKey)}
          >
            <Text style={[styles.tabText, tab === tabKey && styles.tabTextActive]}>
              {tabKey === 'active' ? t('tasker.active') : tabKey === 'completed' ? t('jobs.status.completed') : t('components.viewAll')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <Text style={styles.emptyText}>{t('common.noResults')}</Text>
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
                  <View style={[styles.progressFill, { width: `${c.progress}%`, backgroundColor: c.progress >= 100 ? '#06C167' : '#F5A623' }]} />
                </View>
                <Text style={styles.progressText}>{c.progress}%</Text>
              </View>
              <View style={styles.cardBottom}>
                <View style={[styles.contractStatus, { backgroundColor: c.status === 'Completed' || c.status === 'completed' ? '#D1FAE5' : '#FFF7ED' }]}>
                  <Text style={[styles.contractStatusText, { color: c.status === 'Completed' || c.status === 'completed' ? '#06C167' : '#F5A623' }]}>
                    {c.status}
                  </Text>
                </View>
                <Text style={styles.viewDetails}>{t('company.viewDetails')}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  topBar: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  heading: { fontSize: 28, fontFamily: fonts.heading, color: '#FFFFFF' },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: '#2E2E2E',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 14, fontFamily: fonts.bodySemiBold, color: '#6F6B6B' },
  tabTextActive: { color: '#F5A623', fontFamily: fonts.bodyMedium },
  contractCard: {
    backgroundColor: '#FFFFFF',
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
  contractTitle: { fontSize: 15, fontFamily: fonts.bodyMedium, color: '#FFFFFF', flex: 1, marginRight: 8 },
  contractValue: { fontSize: 15, fontFamily: fonts.bodyMedium, color: '#F5A623' },
  contractClient: { fontSize: 13, color: '#6F6B6B', marginBottom: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#2E2E2E',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: 12, fontFamily: fonts.bodySemiBold, color: '#FFFFFF', width: 36 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contractStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  contractStatusText: { fontSize: 12, fontFamily: fonts.bodySemiBold },
  viewDetails: { fontSize: 13, color: '#F5A623', fontFamily: fonts.bodySemiBold },
  emptyText: { textAlign: 'center', color: '#6F6B6B', marginTop: 40, fontSize: 14 },
})
