import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../lib/ThemeContext'

interface Props {
  title: string
  category: string
  budget?: number
  location?: string
  distance?: string
  urgency?: string
  status?: string
  isRemote?: boolean
  onPress: () => void
  onApply?: () => void
}

const STATUS_COLORS: Record<string, string> = {
  OPEN:        '#10B981',
  ASSIGNED:    '#F59E0B',
  IN_PROGRESS: '#3B82F6',
  COMPLETED:   '#6B7280',
  CANCELLED:   '#EF4444',
}

export default function JobCard({ title, category, budget, location, distance, urgency, status, isRemote, onPress, onApply }: Props) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const accentColor = status ? STATUS_COLORS[status] || colors.amber : colors.amber

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.white }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.accent, { backgroundColor: accentColor }]} />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>{title}</Text>
          {budget ? (
            <Text style={[styles.budget, { color: colors.amberDark }]}>
              LKR {budget.toLocaleString()}
            </Text>
          ) : null}
        </View>

        <View style={styles.tags}>
          <View style={[styles.tag, { backgroundColor: colors.amberBg }]}>
            <Text style={[styles.tagText, { color: colors.amberDark }]}>{category}</Text>
          </View>
          {urgency ? (
            <View style={[styles.tag, {
              backgroundColor: urgency === 'Today' ? colors.amberLight : colors.indigoBg,
            }]}>
              <Text style={[styles.tagText, {
                color: urgency === 'Today' ? colors.amberDark : colors.indigo,
              }]}>{urgency}</Text>
            </View>
          ) : null}
          {status ? (
            <View style={[styles.tag, { backgroundColor: (STATUS_COLORS[status] || colors.amber) + '20' }]}>
              <Text style={[styles.tagText, { color: STATUS_COLORS[status] || colors.amber }]}>
                {status.replace('_', ' ')}
              </Text>
            </View>
          ) : null}
          {isRemote ? (
            <View style={[styles.tag, { backgroundColor: colors.purpleBg }]}>
              <Text style={[styles.tagText, { color: colors.purple }]}>{t('jobs.remote')}</Text>
            </View>
          ) : null}
        </View>

        {location ? (
          <View style={styles.locRow}>
            <Ionicons
              name={isRemote ? 'globe-outline' : 'location-outline'}
              size={12}
              color={colors.muted}
            />
            <Text style={[styles.location, { color: colors.muted }]}>
              {location}{distance && !isRemote ? ` · ${distance}` : ''}
            </Text>
          </View>
        ) : null}

        {onApply ? (
          <TouchableOpacity
            style={[styles.applyBtn, {
              backgroundColor: colors.amber,
              shadowColor: '#F59E0B',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
              elevation: 4,
            }]}
            onPress={onApply}
            activeOpacity={0.8}
          >
            <Ionicons name="paper-plane-outline" size={12} color="#111827" />
            <Text style={styles.applyText}>{t('jobs.applyNow')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
    overflow: 'hidden',
  },
  accent:  { width: 4, flexShrink: 0 },
  body:    { flex: 1, padding: 14 },
  topRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  title:   { fontSize: 15, fontFamily: 'Outfit_800ExtraBold', flex: 1, marginRight: 8, letterSpacing: -0.2 },
  budget:  { fontSize: 15, fontFamily: 'Outfit_900Black', letterSpacing: -0.3 },
  tags:    { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  tag:     { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100 },
  tagText: { fontSize: 10, fontFamily: 'Outfit_700Bold' },
  locRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  location:{ fontSize: 12, fontFamily: 'Outfit_500Medium' },
  applyBtn:{
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 11,
  },
  applyText: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: '#111827' },
})
