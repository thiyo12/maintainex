import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Animated, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth'
import { categories, taskers } from '../../lib/api'
import { colors } from '../../lib/colors'
import type { Category, TaskerProfile } from '../../lib/types'

const catIcons: Record<string, string> = {
  construction: '🏗️', cleaning: '🧹', electrical: '⚡', plumbing: '🔧',
  painting: '🎨', moving: '📦', gardening: '🌿', handyman: '🔨',
}

export default function CustomerHome() {
  const router = useRouter()
  const { user } = useAuth()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const [catList, setCatList] = useState<Category[]>([])
  const [taskerList, setTaskerList] = useState<TaskerProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start()
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [cats, tks] = await Promise.all([
        categories.list(),
        taskers.list(),
      ])
      setCatList(cats)
      setTaskerList(tks)
    } catch (e) {
      console.error('Home load error:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name || 'User'} 👋</Text>
            <Text style={styles.location}>📍 Sri Lanka</Text>
          </View>
          <TouchableOpacity style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name || 'U')[0]}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a service"
            placeholderTextColor={colors.gray}
          />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesRow}>
              {catList.map((cat) => (
                <TouchableOpacity key={cat.id} style={styles.categoryCard} activeOpacity={0.7}>
                  <View style={styles.catIconWrap}>
                    <Text style={styles.catIcon}>{catIcons[cat.slug] || '📋'}</Text>
                  </View>
                  <Text style={styles.catLabel}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>Nearby Taskers</Text>
            {taskerList.map((t, i) => (
              <TouchableOpacity key={t.id || i} style={styles.taskerCard} activeOpacity={0.8}>
                <View style={styles.taskerLeft}>
                  <View style={styles.taskerAvatar}>
                    <Text style={styles.taskerAvatarText}>{t.user?.name?.[0] || 'T'}</Text>
                    {t.isOnline ? <View style={styles.onlineDot} /> : null}
                  </View>
                  <View style={styles.taskerInfo}>
                    <Text style={styles.taskerName}>{t.user?.name || 'Tasker'}</Text>
                    <Text style={styles.taskerSkill}>{t.skills?.[0] || 'Professional'} • {t.serviceAreas?.[0] || 'Sri Lanka'}</Text>
                    <Text style={styles.taskerRating}>⭐ {t.rating?.toFixed(1) || '5.0'}</Text>
                  </View>
                </View>
                <View style={styles.badges}>
                  {t.isOnline ? <View style={styles.availableBadge}><Text style={styles.availableText}>Available</Text></View> : null}
                  {t.isVerified ? <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓ Verified</Text></View> : null}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(customer)/jobs/new')}
          activeOpacity={0.8}
        >
          <Text style={styles.fabIcon}>+</Text>
          <Text style={styles.fabLabel}>Post a job</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.dark },
  location: { fontSize: 13, color: colors.gray, marginTop: 4 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.purple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.white },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 24,
    paddingHorizontal: 16,
    borderRadius: 14,
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    marginBottom: 20,
  },
  searchIcon: { fontSize: 16, marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: colors.dark },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.dark,
    paddingHorizontal: 24,
    marginBottom: 12,
    marginTop: 8,
  },
  categoriesRow: { paddingLeft: 24, marginBottom: 24 },
  categoryCard: {
    alignItems: 'center',
    marginRight: 16,
    width: 76,
  },
  catIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  catIcon: { fontSize: 26 },
  catLabel: { fontSize: 12, fontWeight: '600', color: colors.dark, textAlign: 'center' },
  taskerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 24,
    marginBottom: 10,
    padding: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  taskerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  taskerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.purple,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  taskerAvatarText: { fontSize: 18, fontWeight: '700', color: colors.white },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: colors.white,
  },
  taskerInfo: { flex: 1 },
  taskerName: { fontSize: 15, fontWeight: '700', color: colors.dark },
  taskerSkill: { fontSize: 13, color: colors.gray, marginTop: 2 },
  taskerRating: { fontSize: 13, color: colors.dark, marginTop: 2 },
  badges: { gap: 4 },
  availableBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  availableText: { fontSize: 11, fontWeight: '600', color: colors.green },
  verifiedBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verifiedText: { fontSize: 11, fontWeight: '600', color: '#2563EB' },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.purple,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: colors.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    gap: 8,
  },
  fabIcon: { fontSize: 22, color: colors.white, fontWeight: '300' },
  fabLabel: { fontSize: 15, fontWeight: '700', color: colors.white },
})
