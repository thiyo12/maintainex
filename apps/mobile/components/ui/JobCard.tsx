import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
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
  accentColor?: string
  onPress: () => void
  onApply?: () => void
  onSave?: () => void
}

const statusColors: Record<string, { bg: string; color: string; icon: string }> = {
  OPEN: { bg: '#D1FAE5', color: '#065F46', icon: 'checkmark-circle' },
  PENDING: { bg: '#FEF3C7', color: '#D97706', icon: 'time' },
  IN_PROGRESS: { bg: '#DBEAFE', color: '#1D4ED8', icon: 'sync' },
  ASSIGNED: { bg: '#DBEAFE', color: '#1D4ED8', icon: 'person' },
  COMPLETED: { bg: '#D1FAE5', color: '#065F46', icon: 'checkmark-done' },
  CANCELLED: { bg: '#FEE2E2', color: '#DC2626', icon: 'close' },
}

const urgencyColors: Record<string, { bg: string; color: string }> = {
  Today: { bg: '#DBEAFE', color: '#1D4ED8' },
  Weekend: { bg: '#EDE9FE', color: '#5B21B6' },
  ThisWeek: { bg: '#EDE9FE', color: '#5B21B6' },
}

export default function JobCard({ title, category, budget, location, distance, urgency, status, accentColor, onPress, onApply, onSave }: Props) {
  const colors = useColors()
  const accent = accentColor || colors.success
  const sc = status ? statusColors[status] : null
  const uc = urgency ? urgencyColors[urgency] : null

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface }, shadows.lg]} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>{title}</Text>
          {budget ? <Text style={[styles.budget, { color: colors.primaryDark }]}>LKR {budget.toLocaleString()}</Text> : null}
        </View>
        <View style={styles.tags}>
          <View style={[styles.tag, { backgroundColor: colors.primaryBg }]}>
            <Ionicons name="sparkles" size={10} color={colors.primaryDark} />
            <Text style={[styles.tagText, { color: colors.primaryDark }]}>{category}</Text>
          </View>
          {uc ? (
            <View style={[styles.tag, { backgroundColor: uc.bg }]}>
              <Text style={[styles.tagText, { color: uc.color }]}>{urgency}</Text>
            </View>
          ) : null}
          {sc ? (
            <View style={[styles.badge, { backgroundColor: sc.bg }]}>
              <Ionicons name={sc.icon as any} size={9} color={sc.color} />
              <Text style={[styles.badgeText, { color: sc.color }]}>{status?.replace('_', ' ')}</Text>
            </View>
          ) : null}
        </View>
        {location ? (
          <View style={styles.locRow}>
            <Ionicons name="location-outline" size={13} color={colors.muted} />
            <Text style={[styles.locText, { color: colors.inkLight }]}>
              {location}{distance ? ` · ${distance}` : ''}
            </Text>
          </View>
        ) : null}
        {(onApply || onSave) ? (
          <View style={styles.actions}>
            {onApply ? (
              <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.primary }]} onPress={onApply}>
                <Ionicons name="paper-plane" size={13} color="#111" />
                <Text style={styles.applyText}>Apply Now</Text>
              </TouchableOpacity>
            ) : null}
            {onSave ? (
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={onSave}>
                <Ionicons name="bookmark-outline" size={14} color={colors.inkLight} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  accent: {
    width: 4,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    padding: spacing.md,
    paddingLeft: spacing.md - 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 15,
    fontFamily: fonts.headingBold,
    flex: 1,
    marginRight: spacing.sm,
    letterSpacing: -0.2,
  },
  budget: {
    fontSize: 15,
    fontFamily: fonts.headingBold,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  tagText: {
    fontSize: 10,
    fontFamily: fonts.label,
    letterSpacing: 0.2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: fonts.label,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: spacing.md,
  },
  locText: {
    fontSize: fontSizes.captionSmall,
    fontFamily: fonts.bodyMedium,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  applyText: {
    fontSize: 13,
    fontFamily: fonts.headingBold,
    color: '#111',
  },
  saveBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
