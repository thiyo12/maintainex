import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { taskers } from '../../lib/api'
import { colors } from '../../lib/colors'
import type { TaskerProfile } from '../../lib/types'

export default function ExploreScreen() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterSkill, setFilterSkill] = useState('')
  const [taskerList, setTaskerList] = useState<TaskerProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    taskers.list()
      .then(setTaskerList)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const skills = [...new Set(taskerList.flatMap(t => t.skills || []))]

  const filtered = taskerList.filter(t =>
    t.user?.name?.toLowerCase().includes(search.toLowerCase()) &&
    (!filterSkill || (t.skills || []).some(s => s.toLowerCase().includes(filterSkill.toLowerCase())))
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Explore</Text>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search taskers or companies"
          placeholderTextColor={colors.gray}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {['All', ...skills].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterPill, filterSkill === f && styles.filterPillActive]}
            onPress={() => setFilterSkill(f === 'All' ? '' : f)}
          >
            <Text style={[styles.filterPillText, filterSkill === f && styles.filterPillTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapEmoji}>🗺️</Text>
        <Text style={styles.mapTitle}>{filtered.length} taskers nearby</Text>
        <Text style={styles.mapSub}>📍 Sri Lanka</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {filtered.map((t, i) => (
            <TouchableOpacity key={t.id || i} style={styles.taskerCard} activeOpacity={0.8}>
              <View style={styles.taskerLeft}>
                <View style={styles.taskerAvatar}>
                  <Text style={styles.avatarText}>{t.user?.name?.[0] || 'T'}</Text>
                  {t.isOnline ? <View style={styles.onlineDot} /> : null}
                </View>
                <View style={styles.taskerInfo}>
                  <Text style={styles.taskerName}>{t.user?.name || 'Tasker'}</Text>
                  <Text style={styles.taskerSkill}>{t.skills?.[0] || 'Professional'} • ⭐ {t.rating?.toFixed(1) || '5.0'}</Text>
                  <Text style={styles.taskerDistance}>{t.serviceAreas?.[0] || 'Sri Lanka'}</Text>
                </View>
              </View>
              <View style={styles.taskerRight}>
                <Text style={styles.taskerPrice}>LKR {t.hourlyRate?.toLocaleString() || '—'}/hr</Text>
                <TouchableOpacity style={styles.hireBtn}>
                  <Text style={styles.hireBtnText}>Hire</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  topBar: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark },
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
    marginBottom: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: colors.dark },
  filterRow: { paddingLeft: 24, marginBottom: 14, maxHeight: 40 },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    marginRight: 8,
  },
  filterPillActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  filterPillText: { fontSize: 13, fontWeight: '600', color: colors.dark },
  filterPillTextActive: { color: colors.white },
  mapPlaceholder: {
    backgroundColor: colors.purple,
    marginHorizontal: 24,
    borderRadius: 20,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  mapEmoji: { fontSize: 36, marginBottom: 6 },
  mapTitle: { fontSize: 16, fontWeight: '700', color: colors.white, marginBottom: 2 },
  mapSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  taskerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 24,
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  taskerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  taskerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.purple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.white },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.green, borderWidth: 2, borderColor: colors.white,
  },
  taskerInfo: { flex: 1 },
  taskerName: { fontSize: 15, fontWeight: '700', color: colors.dark },
  taskerSkill: { fontSize: 13, color: colors.gray, marginTop: 2 },
  taskerDistance: { fontSize: 12, color: colors.gray, marginTop: 2 },
  taskerRight: { alignItems: 'flex-end', gap: 8 },
  taskerPrice: { fontSize: 14, fontWeight: '800', color: colors.primary },
  hireBtn: {
    backgroundColor: colors.purple,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  hireBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
})
