import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors } from '../../lib/colors'
import { fonts } from '../../lib/fonts'
import Badge from '../ui/Badge'

type StatusVariant = 'open' | 'pending' | 'inProgress' | 'completed' | 'cancelled'

const statusMap: Record<string, StatusVariant> = {
  OPEN: 'open',
  QUOTE_ACCEPTED: 'pending',
  IN_PROGRESS: 'inProgress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DISPUTED: 'cancelled',
}

interface Props {
  title: string
  description: string
  budget: number
  budgetType?: string
  status: string
  locationName?: string
  createdAt: string
  onPress: () => void
}

export default function JobCard({ title, description, budget, budgetType, status, locationName, createdAt, onPress }: Props) {
  const variant = statusMap[status] || 'muted'

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.topRow}>
        <Badge label={status.replace(/_/g, ' ')} variant={variant} dot />
        <Text style={styles.price}>LKR {budget.toLocaleString()}</Text>
      </View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <Text style={styles.desc} numberOfLines={2}>{description}</Text>
      <View style={styles.footer}>
        <Text style={styles.meta}>{locationName || ''} • {new Date(createdAt).toLocaleDateString()}</Text>
        {budgetType && <Text style={styles.type}>{budgetType}</Text>}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  price: { fontSize: 16, fontFamily: fonts.body, color: colors.primaryDark },
  title: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.ink, marginBottom: 6 },
  desc: { fontSize: 13, fontFamily: fonts.body, color: colors.ink, opacity: 0.6, lineHeight: 20, marginBottom: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontSize: 12, fontFamily: fonts.bodyLight, color: colors.muted },
  type: { fontSize: 11, fontFamily: fonts.bodyMedium, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
})
