import { View, Text, StyleSheet } from 'react-native'
import { useColors } from '../../lib/ThemeContext'
import { fonts } from '../../lib/fonts'

type BadgeVariant = 'open' | 'pending' | 'inProgress' | 'completed' | 'cancelled' | 'amber' | 'green' | 'blue' | 'purple' | 'muted'

interface Props {
  label: string
  variant?: BadgeVariant
  dot?: boolean
}

export default function Badge({ label, variant = 'amber', dot: showDot }: Props) {
  const colors = useColors()
    const styles = makeStyles(colors)

  const vs: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
    open: { bg: '#D1FAE5', text: colors.success, dot: colors.success },
    pending: { bg: '#FEF3CD', text: colors.amberDark, dot: colors.amber },
    inProgress: { bg: '#DBEAFE', text: '#2563EB', dot: '#3B82F6' },
    completed: { bg: '#E5E7EB', text: '#6B7280', dot: '#6B7280' },
    cancelled: { bg: '#FEE2E2', text: '#EF4444', dot: '#EF4444' },
    amber: { bg: colors.amberLight, text: colors.amberDark, dot: colors.amber },
    green: { bg: '#D1FAE5', text: colors.success, dot: colors.success },
    blue: { bg: '#DBEAFE', text: '#2563EB', dot: '#3B82F6' },
    purple: { bg: '#EDE9FE', text: '#7C3AED', dot: '#8B5CF6' },
    muted: { bg: colors.cream, text: colors.muted, dot: colors.muted },
  }
  const st = vs[variant]
  return (
    <View style={[styles.badge, { backgroundColor: st.bg }]}>
      {showDot && <View style={[styles.dot, { backgroundColor: st.dot }]} />}
      <Text style={[styles.label, { color: st.text }]}>{label}</Text>
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 100,
    alignSelf: 'flex-start',
    gap: 4,
  },
  dot:   { width: 5, height: 5, borderRadius: 3 },
  label: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
})
