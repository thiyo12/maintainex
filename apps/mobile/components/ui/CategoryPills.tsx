import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../lib/ThemeContext'
import { fonts, fontSizes } from '../../lib/fonts'
import { spacing, borderRadius } from '../../lib/tokens'

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
  const colors = useColors()
  const list = items || FALLBACK_CATEGORIES

  if (loading) {
    return <Text style={{ fontSize: fontSizes.caption, color: colors.muted, paddingVertical: spacing.md }}>Loading categories...</Text>
  }

  return (
    <View style={styles.row}>
      {list.map((cat) => {
        const isSelected = selected === cat.id
        return (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.pill,
              {
                backgroundColor: isSelected ? cat.colorHex : colors.surface,
                borderColor: isSelected ? cat.colorHex : colors.border,
              },
            ]}
            onPress={() => onSelect(cat.id)}
            activeOpacity={0.7}
          >
            <Ionicons name={cat.iconName as any} size={16} color={isSelected ? '#FFFFFF' : colors.muted} />
            <Text style={[styles.pillLabel, { color: isSelected ? '#FFFFFF' : colors.ink }]}>
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
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    gap: spacing.xs,
  },
  pillLabel: {
    fontSize: fontSizes.captionSmall,
    fontWeight: '600',
  },
})
