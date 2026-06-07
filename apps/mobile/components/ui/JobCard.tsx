import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useColors } from '../../lib/ThemeContext'
import { fonts, fontSizes } from '../../lib/fonts'
import { spacing, borderRadius, shadows } from '../../lib/tokens'

interface Props {
  title: string
  category: string
  budget?: number
  location?: string
  distance?: string
  urgency?: string
  status?: string
  onPress: () => void
  onApply?: () => void
}

const statusColors: Record<string, string> = {
  OPEN: '#10B981',
  ASSIGNED: '#2563EB',
  IN_PROGRESS: '#F59E0B',
  COMPLETED: '#94A3B8',
  CANCELLED: '#EF4444',
}

export default function JobCard({ title, category, budget, location, distance, urgency, status, onPress, onApply }: Props) {
  const colors = useColors()
  const statusColor = status ? statusColors[status] || colors.primary : colors.primary

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface }, shadows.md]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.topRow}>
        <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>{title}</Text>
        {status ? (
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{status.replace('_', ' ')}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.tags}>
        <View style={[styles.tag, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.tagText, { color: colors.primary }]}>{category}</Text>
        </View>
        {urgency ? (
          <View style={[styles.tag, { backgroundColor: urgency === 'Today' ? colors.warningLight : colors.infoLight }]}>
            <Text style={[styles.tagText, { color: urgency === 'Today' ? colors.warning : colors.info }]}>{urgency}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.bottomRow}>
        {location ? (
          <Text style={[styles.location, { color: colors.muted }]}>
            {location}{distance ? ` \u2022 ${distance}` : ''}
          </Text>
        ) : <View />}
        {budget ? (
          <Text style={[styles.budget, { color: colors.accent }]}>LKR {budget.toLocaleString()}</Text>
        ) : null}
      </View>

      {onApply ? (
        <TouchableOpacity style={[styles.applyButton, { backgroundColor: colors.primary }]} onPress={onApply}>
          <Text style={styles.applyText}>Apply</Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSizes.body,
    fontFamily: fonts.headingBold,
    flex: 1,
    marginRight: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: fontSizes.captionSmall,
    fontFamily: fonts.label,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.full,
  },
  tagText: {
    fontSize: fontSizes.captionSmall,
    fontFamily: fonts.label,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  location: {
    fontSize: fontSizes.captionSmall,
    fontFamily: fonts.body,
    flex: 1,
  },
  budget: {
    fontSize: fontSizes.bodySmall,
    fontFamily: fonts.headingBold,
  },
  applyButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  applyText: {
    fontSize: fontSizes.button,
    fontFamily: fonts.button,
    color: '#FFFFFF',
  },
})
