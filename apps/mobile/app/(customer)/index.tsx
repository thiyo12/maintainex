import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { categories as categoriesApi } from '../../lib/api'
import { Category } from '../../lib/types'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  background: '#F9FAFB',
  white: '#FFFFFF',
}

const QUICK_ACTIONS = [
  { title: 'Book a Service', icon: '🔧', route: '/booking/new' },
  { title: 'Post a Job', icon: '📋', route: '/jobs/new' },
  { title: 'Find Taskers', icon: '👷', route: '/(customer)/browse' as any },
]

export default function CustomerHome() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [cats, setCats] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchCategories = useCallback(async () => {
    try {
      const data = await categoriesApi.list()
      setCats(data)
    } catch {
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchCategories() }, [])

  const onRefresh = () => {
    setRefreshing(true)
    fetchCategories()
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'there'}</Text>
              <Text style={styles.subtitle}>What do you need today?</Text>
            </View>
            <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.quickActions}>
            {QUICK_ACTIONS.map((action, i) => (
              <TouchableOpacity
                key={i}
                style={styles.quickAction}
                onPress={() => router.push(action.route as any)}
              >
                <Text style={styles.quickIcon}>{action.icon}</Text>
                <Text style={styles.quickTitle}>{action.title}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Services</Text>
        </>
      }
      data={cats}
      numColumns={2}
      keyExtractor={(item) => item.id}
      columnWrapperStyle={styles.row}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.categoryCard}
          onPress={() => router.push(`/booking/new?category=${item.slug}`)}
        >
          <View style={styles.categoryIcon}>
            <Text style={styles.categoryEmoji}>🔧</Text>
          </View>
          <Text style={styles.categoryName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.categoryCount}>{item.services?.length || 0} services</Text>
        </TouchableOpacity>
      )}
    />
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingTop: 60 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 28,
  },
  greeting: { fontSize: 28, fontWeight: '800', color: colors.dark },
  subtitle: { fontSize: 15, color: colors.gray, marginTop: 4 },
  logoutBtn: { padding: 8 },
  logoutText: { color: colors.gray, fontSize: 14, fontWeight: '500' },
  quickActions: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  quickAction: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickIcon: { fontSize: 28, marginBottom: 8 },
  quickTitle: { fontSize: 12, fontWeight: '600', color: colors.dark, textAlign: 'center' },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.dark, marginBottom: 16 },
  row: { gap: 12 },
  categoryCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryIcon: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#FFFBEB',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  categoryEmoji: { fontSize: 24 },
  categoryName: { fontSize: 14, fontWeight: '700', color: colors.dark, marginBottom: 4 },
  categoryCount: { fontSize: 12, color: colors.gray },
})
