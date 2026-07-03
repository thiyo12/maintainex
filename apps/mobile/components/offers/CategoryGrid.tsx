import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../lib/ThemeContext'
import { useCountry } from '../../lib/country'
import { CATEGORY_GROUPS } from '../../lib/categoryData'
import { serviceCategories } from '../../lib/api'
import { fonts } from '../../lib/fonts'
import { useEffect } from 'react'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

interface CategoryJob {
  id: string
  name: string
}

interface CategoryWithJobs {
  id: string
  name: string
  jobs: CategoryJob[]
}

interface Props {
  onCategoryPress?: (categoryId: string, categoryName: string) => void
  onServicePress?: (jobId: string, jobName: string) => void
}

export default function CategoryGrid({ onCategoryPress, onServicePress }: Props) {
  const colors = useColors()
  const { t } = useTranslation()
  const { selectedCountry } = useCountry()
  const styles = makeStyles(colors)
  const [categories, setCategories] = useState<CategoryWithJobs[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const countryCode = selectedCountry?.code || 'LK'

  useEffect(() => {
    serviceCategories.list(countryCode).then(setCategories).catch(() => {})
  }, [countryCode])

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpandedId(prev => prev === id ? null : id)
  }

  const getGroup = (id: string) => CATEGORY_GROUPS.find(g => g.id === id)

  if (categories.length === 0) return null

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.ink }]}>{t('home.browseServices')}</Text>
      <View style={styles.grid}>
        {categories.map((cat) => {
          const group = getGroup(cat.id)
          const isExpanded = expandedId === cat.id
          return (
            <View key={cat.id} style={styles.itemWrap}>
              <TouchableOpacity
                style={[
                  styles.item,
                  { backgroundColor: group?.bgColor || colors.white, borderColor: colors.border },
                ]}
                onPress={() => {
                  if (cat.jobs.length > 0) {
                    toggleExpand(cat.id)
                  }
                  onCategoryPress?.(cat.id, cat.name)
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.iconWrap, { backgroundColor: (group?.bgColor || colors.amberBg) }]}>
                  <Text style={styles.icon}>{getIcon(group?.id)}</Text>
                </View>
                <Text style={[styles.label, { color: colors.ink }]} numberOfLines={1}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
              {isExpanded && cat.jobs.length > 0 && (
                <View style={[styles.subList, { backgroundColor: colors.white, borderColor: colors.border }]}>
                  {cat.jobs.slice(0, 6).map((job) => (
                    <TouchableOpacity
                      key={job.id}
                      style={styles.subItem}
                      onPress={() => onServicePress?.(job.id, job.name)}
                    >
                      <Text style={[styles.subItemText, { color: colors.ink }]}>{job.name}</Text>
                    </TouchableOpacity>
                  ))}
                  {cat.jobs.length > 6 && (
                    <Text style={[styles.moreText, { color: colors.muted }]}>
                      +{cat.jobs.length - 6} more
                    </Text>
                  )}
                </View>
              )}
            </View>
          )
        })}
      </View>
    </View>
  )
}

function getIcon(id?: string): string {
  const map: Record<string, string> = {
    'home-repairs': '🔧',
    'cleaning': '🧹',
    'hvac': '🌡️',
    'gardening': '🌿',
    'moving-delivery': '🚚',
    'security': '🛡️',
    'automotive': '🚗',
    'it-services': '💻',
  }
  return id ? (map[id] || '📦') : '📦'
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: fonts?.heading || 'Inter_600SemiBold',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  itemWrap: {
    width: '23%',
    minWidth: 72,
  },
  item: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
  },
  label: {
    fontSize: 11,
    fontFamily: fonts?.bodyMedium || 'Inter_500Medium',
    textAlign: 'center',
  },
  subList: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    padding: 6,
    gap: 2,
  },
  subItem: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  subItemText: {
    fontSize: 12,
    fontFamily: fonts?.body || 'Inter_400Regular',
  },
  moreText: {
    fontSize: 11,
    fontFamily: fonts?.body || 'Inter_400Regular',
    textAlign: 'center',
    paddingVertical: 4,
  },
})
