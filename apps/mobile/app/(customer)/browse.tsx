import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput,
} from 'react-native'
import { useRouter } from 'expo-router'
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

export default function BrowseScreen() {
  const router = useRouter()
  const [cats, setCats] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchCategories = useCallback(async () => {
    try {
      const data = await categoriesApi.list()
      setCats(data)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCategories() }, [])

  const filtered = cats.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.services?.some((s: any) => s.name?.toLowerCase().includes(search.toLowerCase()))
  )

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
        <Text style={styles.title}>Services</Text>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search services..."
          placeholderTextColor={colors.gray}
        />
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/booking/new?category=${item.slug}`)}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Text style={{ fontSize: 24 }}>🔧</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardCount}>{item.services?.length || 0} services</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </View>
            <View style={styles.serviceChips}>
              {item.services?.slice(0, 4).map((svc: any) => (
                <View key={svc.id} style={styles.chip}>
                  <Text style={styles.chipText}>{svc.name}</Text>
                </View>
              ))}
              {(item.services?.length || 0) > 4 && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>+{item.services.length - 4} more</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, paddingTop: 60, paddingBottom: 0 },
  title: { fontSize: 28, fontWeight: '800', color: colors.dark, marginBottom: 16 },
  search: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.dark,
    marginBottom: 16,
  },
  list: { padding: 20, paddingTop: 0 },
  card: {
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
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardIcon: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#FFFBEB',
    alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.dark },
  cardCount: { fontSize: 13, color: colors.gray, marginTop: 2 },
  arrow: { fontSize: 24, color: colors.gray },
  serviceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chipText: { fontSize: 12, color: colors.dark, fontWeight: '500' },
})
