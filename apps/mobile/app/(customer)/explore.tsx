import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const colors = {
  primary: '#F59E0B',
  purple: '#7C3AED',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  white: '#FFFFFF',
  green: '#10B981',
}

const nearbyTaskers = [
  { name: 'Kamal Perera', skill: 'Plumber', distance: '1.2 km', rating: 4.8, price: 'LKR 850/hr', online: true },
  { name: 'Saman Fernando', skill: 'Electrician', distance: '2.5 km', rating: 4.6, price: 'LKR 1,200/hr', online: true },
  { name: 'Nimal Silva', skill: 'Painter', distance: '3.0 km', rating: 4.9, price: 'LKR 700/hr', online: false },
  { name: 'Priya Mendis', skill: 'Cleaner', distance: '1.8 km', rating: 4.7, price: 'LKR 500/hr', online: true },
  { name: 'Ruwan Jayasuriya', skill: 'Handyman', distance: '4.2 km', rating: 4.5, price: 'LKR 600/hr', online: false },
  { name: 'Lahiru Silva', skill: 'Gardener', distance: '3.5 km', rating: 4.8, price: 'LKR 550/hr', online: true },
]

export default function ExploreScreen() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterSkill, setFilterSkill] = useState('')

  const filtered = nearbyTaskers.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) &&
    (!filterSkill || t.skill.toLowerCase().includes(filterSkill.toLowerCase()))
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
        {['All', 'Plumber', 'Electrician', 'Painter', 'Cleaner', 'Handyman', 'Gardener'].map((f) => (
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
        <Text style={styles.mapSub}>📍 Colombo, Sri Lanka</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {filtered.map((t, i) => (
          <TouchableOpacity key={i} style={styles.taskerCard} activeOpacity={0.8}>
            <View style={styles.taskerLeft}>
              <View style={styles.taskerAvatar}>
                <Text style={styles.avatarText}>{t.name[0]}</Text>
                {t.online ? <View style={styles.onlineDot} /> : null}
              </View>
              <View style={styles.taskerInfo}>
                <Text style={styles.taskerName}>{t.name}</Text>
                <Text style={styles.taskerSkill}>{t.skill} • ⭐ {t.rating}</Text>
                <Text style={styles.taskerDistance}>{t.distance} away</Text>
              </View>
            </View>
            <View style={styles.taskerRight}>
              <Text style={styles.taskerPrice}>{t.price}</Text>
              <TouchableOpacity style={styles.hireBtn}>
                <Text style={styles.hireBtnText}>Hire</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
