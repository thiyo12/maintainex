import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/colors'

interface CategoryItem {
  id: string
  name: string
  iconName: string
  colorHex: string
}

interface Props {
  items?: CategoryItem[]
  selected?: string
  onSelect: (id: string) => void
  loading?: boolean
}

const FALLBACK_CATEGORIES: CategoryItem[] = [
  { id: 'cleaning', name: 'Cleaning', iconName: 'sparkles-outline', colorHex: '#0EA5E9' },
  { id: 'electrical', name: 'Electrical', iconName: 'flash-outline', colorHex: '#F59E0B' },
  { id: 'plumbing', name: 'Plumbing', iconName: 'water-outline', colorHex: '#3B82F6' },
  { id: 'painting', name: 'Painting', iconName: 'color-palette-outline', colorHex: '#EC4899' },
  { id: 'moving', name: 'Moving', iconName: 'cube-outline', colorHex: '#F97316' },
  { id: 'gardening', name: 'Gardening', iconName: 'leaf-outline', colorHex: '#16A34A' },
  { id: 'repairs', name: 'Repairs', iconName: 'hammer-outline', colorHex: '#78716C' },
  { id: 'assembly', name: 'Assembly', iconName: 'settings-outline', colorHex: '#7C3AED' },
]

export default function CategoryPills({ items, selected, onSelect, loading }: Props) {
  const list = items || FALLBACK_CATEGORIES

  if (loading) {
    return <Text style={{ fontSize: 13, color: '#9CA3AF', paddingVertical: 12 }}>Loading categories...</Text>
  }

  return (
    <View style={styles.row}>
      {list.map((cat) => {
        const isSelected = selected === cat.id
        return (
          <TouchableOpacity
            key={cat.id}
            style={[styles.pill, isSelected && { borderColor: cat.colorHex, backgroundColor: cat.colorHex + '15' }]}
            onPress={() => onSelect(cat.id)}
            activeOpacity={0.7}
          >
            <Ionicons name={cat.iconName as any} size={16} color={isSelected ? cat.colorHex : '#6B7280'} />
            <Text style={[styles.pillLabel, isSelected && { color: cat.colorHex, fontWeight: '700' }]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
})
