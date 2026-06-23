import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { getCategoryI18nKey } from '../../lib/categories'

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
  { id: 'all',        name: 'All',          iconName: 'grid-outline',           colorHex: '#F59E0B' },
  { id: 'cleaning',   name: 'Cleaning',     iconName: 'sparkles-outline',       colorHex: '#0EA5E9' },
  { id: 'electrical', name: 'Electrical',   iconName: 'flash-outline',          colorHex: '#F59E0B' },
  { id: 'plumbing',   name: 'Plumbing',     iconName: 'water-outline',          colorHex: '#3B82F6' },
  { id: 'painting',   name: 'Painting',     iconName: 'color-palette-outline',  colorHex: '#EC4899' },
  { id: 'moving',     name: 'Moving',       iconName: 'cube-outline',           colorHex: '#F97316' },
  { id: 'gardening',  name: 'Gardening',    iconName: 'leaf-outline',           colorHex: '#16A34A' },
  { id: 'repairs',    name: 'Repairs',      iconName: 'hammer-outline',         colorHex: '#78716C' },
  { id: 'assembly',   name: 'Assembly',     iconName: 'settings-outline',       colorHex: '#7C3AED' },
  { id: 'webdesign',  name: 'Web Design',   iconName: 'laptop-outline',         colorHex: '#6366F1' },
  { id: 'graphics',   name: 'Graphics',     iconName: 'brush-outline',          colorHex: '#A78BFA' },
  { id: 'realestate', name: 'Real Estate',  iconName: 'home-outline',           colorHex: '#10B981' },
]

export default function CategoryPills({ items, selected, onSelect, loading }: Props) {
  const { t } = useTranslation()
  const list = items || FALLBACK_CATEGORIES

  if (loading) {
    return <Text style={styles.loadingText}>{t('common.loadingCategories')}</Text>
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
              isSelected && { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' },
            ]}
            onPress={() => onSelect(cat.id)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={cat.iconName as any}
              size={14}
              color={isSelected ? '#D97706' : '#6B7280'}
            />
            <Text style={[styles.pillLabel, { color: isSelected ? '#D97706' : '#111827' }]}>
              {t(getCategoryI18nKey(cat))}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  pillLabel: { fontSize: 12, fontFamily: 'Outfit_700Bold' },
  loadingText: { fontSize: 12, color: '#6B7280', paddingVertical: 8, fontFamily: 'Outfit_500Medium' },
})
