import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Animated, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { taskers } from '../../../lib/api'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import type { TaskerProfile } from '../../../lib/types'
import { useTranslation } from 'react-i18next'
import PressScale from '../../../components/find/PressScale'

type SortKey = 'rating' | 'price' | 'experience' | 'jobs'

export default function ExploreScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [filterSkill, setFilterSkill] = useState('')
  const [filterEntity, setFilterEntity] = useState<'ALL' | 'INDIVIDUAL' | 'COMPANY'>('ALL')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>('rating')
  const [taskerList, setTaskerList] = useState<TaskerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

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

  const skills = useMemo(() => [...new Set(taskerList.flatMap(t => t.skills || []))], [taskerList])

  const filtered = useMemo(() => {
    let result = taskerList.filter(t =>
      (!search || t.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
        (t.skills || []).some(s => s.toLowerCase().includes(search.toLowerCase()))) &&
      (!filterSkill || (t.skills || []).some(s => s.toLowerCase() === filterSkill.toLowerCase())) &&
      (filterEntity === 'ALL' || t.entityType === filterEntity) &&
      (!verifiedOnly || t.isVerified)
    )
    result.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0)
        case 'price': return (a.hourlyRate || 999999) - (b.hourlyRate || 999999)
        case 'experience': return (b.experienceYears || 0) - (a.experienceYears || 0)
        case 'jobs': return (b.completedJobs || 0) - (a.completedJobs || 0)
        default: return 0
      }
    })
    return result
  }, [taskerList, search, filterSkill, filterEntity, verifiedOnly, sortBy])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>{t('customer.explore')}</Text>
        <Text style={styles.count}>{filtered.length} taskers</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.muted} style={{ marginRight: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('customer.searchTaskers')}
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.filterBtn, showFilters && { backgroundColor: colors.amber }]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="options" size={16} color={showFilters ? '#fff' : colors.muted} />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersPanel}>
          <Text style={styles.filterSectionLabel}>{t('common.sortBy') || 'Sort by'}</Text>
          <View style={styles.filterChipsRow}>
            {([['rating', 'Top Rated'], ['price', 'Lowest Price'], ['experience', 'Experienced'], ['jobs', 'Most Jobs']] as [SortKey, string][]).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.filterChip, sortBy === key && styles.filterChipActive]}
                onPress={() => setSortBy(key)}
              >
                <Text style={[styles.filterChipText, sortBy === key && styles.filterChipTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filterSectionLabel}>{t('customer.type') || 'Type'}</Text>
          <View style={styles.filterChipsRow}>
            {([['ALL', t('common.all')], ['INDIVIDUAL', 'Individual'], ['COMPANY', 'Company']] as const).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.filterChip, filterEntity === key && styles.filterChipActive]}
                onPress={() => setFilterEntity(key)}
              >
                <Text style={[styles.filterChipText, filterEntity === key && styles.filterChipTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.filterChip, verifiedOnly && styles.filterChipActive]}
            onPress={() => setVerifiedOnly(!verifiedOnly)}
          >
            <Ionicons name="shield-checkmark" size={12} color={verifiedOnly ? '#fff' : colors.muted} />
            <Text style={[styles.filterChipText, verifiedOnly && styles.filterChipTextActive]}> {t('customer.verified') || 'Verified'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {skills.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <PressScale onPress={() => setFilterSkill('')}>
            <View style={[styles.filterPill, !filterSkill && styles.filterPillActive]}>
              <Text style={[styles.filterPillText, !filterSkill && styles.filterPillTextActive]}>{t('common.all')}</Text>
            </View>
          </PressScale>
          {skills.slice(0, 15).map((f) => (
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
            <Text style={styles.mapTitle}>{t('customer.taskersNearby', { n: filtered.length })}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.mapSub}>{t('customer.sriLanka')}</Text>
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.taskerName}>{t.user?.name || t('customer.tasker')}</Text>
                      {t.isVerified && <Ionicons name="shield-checkmark" size={14} color={colors.primary} />}
                    </View>
                    {t.skills && t.skills.length > 0 && (
                      <View style={styles.skillsRow}>
                        {t.skills.slice(0, 3).map((s, j) => (
                          <View key={j} style={[styles.skillChip, { backgroundColor: colors.border }]}>
                            <Text style={[styles.skillText, { color: colors.muted }]} numberOfLines={1}>{s}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="star" size={13} color="#F59E0B" />
                        <Text style={styles.taskerRating}> {t.rating?.toFixed(1) || '5.0'}</Text>
                      </View>
                      <Text style={styles.taskerMeta}>• {t.completedJobs || 0} jobs</Text>
                      {t.experienceYears ? <Text style={styles.taskerMeta}>• {t.experienceYears}yr exp</Text> : null}
                    </View>
                  </View>
                </View>
                <View style={styles.taskerRight}>
                  <Text style={styles.taskerPrice}>
                    {t.hourlyRate ? `LKR ${t.hourlyRate}` : '—'}
                  </Text>
                  <Text style={styles.taskerPriceLabel}>per hour</Text>
                  <TouchableOpacity style={styles.hireBtn}
                    onPress={() => router.push(`/(customer)/find/tasker-profile/${t.id}`)}>
                    <Ionicons name="hand-left-outline" size={14} color={colors.white} />
                    <Text style={styles.hireBtnText}>{t('customer.hire')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </PressScale>
          ))}

          {filtered.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={40} color={colors.muted} />
              <Text style={styles.emptyTitle}>{t('customer.noTaskersFound') || 'No taskers found'}</Text>
              <Text style={styles.emptySub}>Try adjusting your filters</Text>
            </View>
          )}
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
  filterBtn: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  filtersPanel: {
    backgroundColor: colors.white, marginHorizontal: 24, borderRadius: 14,
    padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border,
  },
  filterSectionLabel: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.muted, marginBottom: 8, marginTop: 4 },
  filterChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  filterChipText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.ink },
  filterChipTextActive: { color: '#fff' },
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
  taskerRating: { fontSize: 13, color: colors.ink },
  taskerMeta: { fontSize: 12, color: colors.muted },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  skillChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  skillText: { fontSize: 10, fontFamily: fonts.bodyMedium },
  taskerRight: { alignItems: 'flex-end', gap: 2 },
  taskerPrice: { fontSize: 14, fontWeight: '800', color: colors.primaryDark },
  taskerPriceLabel: { fontSize: 10, color: colors.muted, marginBottom: 4 },
  hireBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.amber,
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8,
  },
  hireBtnText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: fonts.heading, color: colors.ink },
  emptySub: { fontSize: 13, color: colors.muted },
})
