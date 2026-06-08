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
  { id: 'all', name: 'All', iconName: 'grid-outline', colorHex: '#F59E0B' },
  { id: 'cleaning', name: 'Cleaning', iconName: 'sparkles-outline', colorHex: '#0EA5E9' },
  { id: 'electrical', name: 'Electrical', iconName: 'flash-outline', colorHex: '#F59E0B' },
  { id: 'plumbing', name: 'Plumbing', iconName: 'water-outline', colorHex: '#3B82F6' },
  { id: 'gardening', name: 'Garden', iconName: 'leaf-outline', colorHex: '#16A34A' },
  { id: 'repairs', name: 'Repairs', iconName: 'hammer-outline', colorHex: '#78716C' },
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
                backgroundColor: isSelected ? colors.primaryBg : colors.surface,
                borderColor: isSelected ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onSelect(cat.id)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={cat.iconName as any}
              size={14}
              color={isSelected ? colors.primaryDark : colors.muted}
            />
            <Text style={[styles.pillLabel, { color: isSelected ? colors.primaryDark : colors.ink }]}>
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
    paddingHorizontal: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
  },
  pillLabel: {
    fontSize: fontSizes.captionSmall,
    fontFamily: fonts.label,
  },
})
