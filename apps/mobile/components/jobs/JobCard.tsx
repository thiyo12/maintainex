import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useColors } from '../../lib/ThemeContext'
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
  const colors = useColors()
    const styles = makeStyles(colors)
  const variant = statusMap[status] || 'muted'

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.white, shadowColor: colors.ink }]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.topRow}>
        <Badge label={status.replace(/_/g, ' ')} variant={variant} dot />
        <Text style={[styles.price, { color: colors.amberDark }]}>LKR {budget.toLocaleString()}</Text>
      </View>
      <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>{title}</Text>
      <Text style={[styles.desc, { color: colors.ink }]} numberOfLines={2}>{description}</Text>
      <View style={styles.footer}>
        <Text style={[styles.meta, { color: colors.muted }]}>{locationName || ''} • {new Date(createdAt).toLocaleDateString()}</Text>
        {budgetType && <Text style={[styles.type, { color: colors.muted }]}>{budgetType}</Text>}
      </View>
    </TouchableOpacity>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  price: { fontSize: 16, fontFamily: 'Outfit_700Bold' },
  title: { fontSize: 16, fontFamily: 'Outfit_800ExtraBold', marginBottom: 6 },
  desc: { fontSize: 13, fontFamily: 'Outfit_500Medium', opacity: 0.6, lineHeight: 20, marginBottom: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontSize: 12, fontFamily: 'Outfit_500Medium' },
  type: { fontSize: 11, fontFamily: 'Outfit_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
})
