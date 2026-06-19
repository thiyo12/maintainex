import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Animated, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { taskers } from '../../../lib/api'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import type { TaskerProfile } from '../../../lib/types'
import PressScale from '../../../components/find/PressScale'

export default function ExploreScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterSkill, setFilterSkill] = useState('')
  const [taskerList, setTaskerList] = useState<TaskerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchTaskers = useCallback(async () => {
    try {
      const data = await taskers.list()
      setTaskerList(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchTaskers()
  }, [fetchTaskers])

  const skills = [...new Set(taskerList.flatMap(t => t.skills || []))]

  const filtered = taskerList.filter(t =>
    (!search || t.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      (t.skills || []).some(s => s.toLowerCase().includes(search.toLowerCase()))) &&
    (!filterSkill || (t.skills || []).some(s => s.toLowerCase().includes(filterSkill.toLowerCase())))
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Explore</Text>
        <Text style={styles.count}>{filtered.length} taskers</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.muted} style={{ marginRight: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search taskers or skills..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {skills.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <PressScale onPress={() => setFilterSkill('')}>
            <View style={[styles.filterPill, !filterSkill && styles.filterPillActive]}>
              <Text style={[styles.filterPillText, !filterSkill && styles.filterPillTextActive]}>All</Text>
            </View>
          </PressScale>
          {skills.map((f) => (
            <PressScale key={f} onPress={() => setFilterSkill(filterSkill === f ? '' : f)}>
              <View style={[styles.filterPill, filterSkill === f && styles.filterPillActive]}>
                <Text style={[styles.filterPillText, filterSkill === f && styles.filterPillTextActive]}>{f}</Text>
              </View>
            </PressScale>
          ))}
        </ScrollView>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color={colors.amber} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchTaskers} tintColor={colors.amber} />}
        >
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map" size={36} color="rgba(255,255,255,0.9)" />
            <Text style={styles.mapTitle}>{filtered.length} taskers nearby</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.mapSub}> Sri Lanka</Text>
            </View>
          </View>

          {filtered.map((t, i) => (
            <PressScale key={t.id || i} onPress={() => router.push(`/(customer)/find/tasker-profile/${t.id}`)}>
              <View style={styles.taskerCard}>
                <View style={styles.taskerLeft}>
                  <View style={styles.taskerAvatar}>
                    <Text style={styles.avatarText}>{t.user?.name?.[0] || 'T'}</Text>
                    {t.isOnline ? <View style={styles.onlineDot} /> : null}
                  </View>
                  <View style={styles.taskerInfo}>
                    <Text style={styles.taskerName}>{t.user?.name || 'Tasker'}</Text>
                    <Text style={styles.taskerSkill}>
                      {t.skills?.slice(0, 2).join(', ') || 'Professional'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                      <Ionicons name="star" size={13} color="#F59E0B" />
                      <Text style={styles.taskerRating}> {t.rating?.toFixed(1) || '5.0'} • {t.completedJobs || 0} jobs</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.taskerRight}>
                  <Text style={styles.taskerPrice}>
                    {t.hourlyRate ? `LKR ${t.hourlyRate}/hr` : '—'}
                  </Text>
                  <TouchableOpacity style={styles.hireBtn}
                    onPress={() => router.push(`/(customer)/find/tasker-profile/${t.id}`)}>
                    <Ionicons name="hand-left-outline" size={14} color={colors.white} />
                    <Text style={styles.hireBtnText}> Hire</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </PressScale>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  heading: { fontSize: 28, fontWeight: '800', color: colors.ink },
  count: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
    marginHorizontal: 24, paddingHorizontal: 16, borderRadius: 14,
    height: 48, borderWidth: 1.5, borderColor: colors.border, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink },
  filterRow: { paddingLeft: 24, marginBottom: 14, maxHeight: 40 },
  filterPill: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border, marginRight: 8,
  },
  filterPillActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  filterPillText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink },
  filterPillTextActive: { color: colors.white },
  mapPlaceholder: {
    backgroundColor: colors.amber, marginHorizontal: 24, borderRadius: 20,
    height: 140, justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  mapTitle: { fontSize: 16, fontWeight: '700', color: colors.white, marginTop: 6, marginBottom: 2 },
  mapSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  taskerCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.white, marginHorizontal: 24, padding: 14,
    borderRadius: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  taskerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  taskerAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.amber,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.ink },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.success, borderWidth: 2, borderColor: colors.white,
  },
  taskerInfo: { flex: 1 },
  taskerName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  taskerSkill: { fontSize: 13, color: colors.muted, marginTop: 2 },
  taskerRating: { fontSize: 13, color: colors.ink },
  taskerRight: { alignItems: 'flex-end', gap: 8 },
  taskerPrice: { fontSize: 14, fontWeight: '800', color: colors.primaryDark },
  hireBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.amber,
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8,
  },
  hireBtnText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink },
})
