import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  white: '#FFFFFF',
}

const categories = [
  { key: 'construction', icon: '🏗️', label: 'Construction' },
  { key: 'cleaning', icon: '🧹', label: 'Cleaning' },
  { key: 'electrical', icon: '⚡', label: 'Electrical' },
  { key: 'plumbing', icon: '🔧', label: 'Plumbing' },
  { key: 'painting', icon: '🎨', label: 'Painting' },
  { key: 'moving', icon: '📦', label: 'Moving' },
  { key: 'gardening', icon: '🌿', label: 'Gardening' },
  { key: 'handyman', icon: '🔨', label: 'Handyman' },
]

interface Props {
  selected?: string
  onSelect: (key: string) => void
}

export default function CategoryPills({ selected, onSelect }: Props) {
  return (
    <View style={styles.row}>
      {categories.map((cat) => {
        const isSelected = selected === cat.key
        return (
          <TouchableOpacity
            key={cat.key}
            style={[styles.pill, isSelected && styles.pillActive]}
            onPress={() => onSelect(cat.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.pillIcon}>{cat.icon}</Text>
            <Text style={[styles.pillLabel, isSelected && styles.pillLabelActive]}>
              {cat.label}
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
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    gap: 6,
  },
  pillActive: {
    backgroundColor: '#FFFBEB',
    borderColor: colors.primary,
  },
  pillIcon: { fontSize: 16 },
  pillLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.dark,
  },
  pillLabelActive: {
    color: colors.primary,
  },
})
