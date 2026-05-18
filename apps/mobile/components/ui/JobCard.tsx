import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  white: '#FFFFFF',
  green: '#10B981',
  red: '#EF4444',
  purple: '#7C3AED',
}

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
  OPEN: colors.green,
  ASSIGNED: colors.primary,
  IN_PROGRESS: colors.customerAccent,
  COMPLETED: colors.gray,
  CANCELLED: colors.red,
}

export default function JobCard({ title, category, budget, location, distance, urgency, status, onPress, onApply }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.border, { backgroundColor: status ? statusColors[status] || colors.primary : colors.primary }]} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {budget ? <Text style={styles.budget}>LKR {budget.toLocaleString()}</Text> : null}
        </View>
        <View style={styles.tags}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{category}</Text>
          </View>
          {urgency ? (
            <View style={[styles.tag, { backgroundColor: urgency === 'Today' ? '#FEF3C7' : '#E0E7FF' }]}>
              <Text style={[styles.tagText, { color: urgency === 'Today' ? '#D97706' : '#4F46E5' }]}>{urgency}</Text>
            </View>
          ) : null}
          {status ? (
            <View style={[styles.tag, { backgroundColor: statusColors[status] + '20' || '#FFFBEB' }]}>
              <Text style={[styles.tagText, { color: statusColors[status] || colors.primary }]}>{status.replace('_', ' ')}</Text>
            </View>
          ) : null}
        </View>
        {location ? (
          <Text style={styles.location}>📍 {location}{distance ? ` • ${distance}` : ''}</Text>
        ) : null}
        {onApply ? (
          <TouchableOpacity style={styles.applyButton} onPress={onApply}>
            <Text style={styles.applyText}>Apply</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  border: {
    width: 4,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
    flex: 1,
    marginRight: 8,
  },
  budget: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#FFFBEB',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  location: {
    fontSize: 13,
    color: colors.gray,
    marginBottom: 8,
  },
  applyButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  applyText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
})
