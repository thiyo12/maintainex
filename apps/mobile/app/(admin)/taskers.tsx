import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { taskers as taskersApi } from '../../lib/api'
import { TaskerProfile } from '../../lib/types'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  background: '#F9FAFB',
  white: '#FFFFFF',
  green: '#10B981',
  red: '#EF4444',
}

export default function AdminTaskersScreen() {
  const router = useRouter()
  const [taskers, setTaskers] = useState<TaskerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetch = useCallback(async () => {
    try {
      const data = await taskersApi.list()
      setTaskers(data)
    } catch {
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetch() }, [])

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Taskers</Text>
      </View>

      <FlatList
        data={taskers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetch} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.user?.name?.charAt(0) || '?'}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{item.user?.name}</Text>
                <Text style={styles.cardSkills}>{item.skills?.join(', ')}</Text>
              </View>
              <View style={[styles.statusDot, item.isOnline ? styles.online : styles.offline]} />
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.rating}>⭐ {item.rating || 0}</Text>
              <Text style={styles.jobs}>{item.completedJobs || 0} jobs</Text>
              <Text style={styles.rate}>LKR {item.hourlyRate || 0}/hr</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}><Text style={styles.emptyText}>No taskers registered</Text></View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '800', color: colors.dark },
  list: { padding: 20, paddingTop: 0 },
  card: {
    backgroundColor: colors.white, borderRadius: 16, padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.dark },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.dark },
  cardSkills: { fontSize: 12, color: colors.gray, marginTop: 2 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  online: { backgroundColor: colors.green },
  offline: { backgroundColor: colors.lightGray },
  cardFooter: { flexDirection: 'row', gap: 16 },
  rating: { fontSize: 13, color: colors.dark },
  jobs: { fontSize: 13, color: colors.gray },
  rate: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: colors.gray },
})
