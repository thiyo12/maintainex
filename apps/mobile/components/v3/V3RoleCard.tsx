import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { v3 } from '../../theme/v3/tokens'

interface Props {
  icon: React.ReactNode
  iconBg: string
  title: string
  subtitle: string
  badge: string
  badgeColor: string
  badgeBg: string
  selected?: boolean
  disabled?: boolean
  onPress?: () => void
}

export default function V3RoleCard({
  icon,
  iconBg,
  title,
  subtitle,
  badge,
  badgeColor,
  badgeBg,
  selected,
  disabled,
  onPress,
}: Props) {
  const card = (
    <View style={[
      styles.card,
      selected && styles.cardSelected,
      disabled && styles.cardDisabled,
    ]}>
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <Text style={[styles.title, disabled && styles.textDisabled]}>{title}</Text>
      <Text style={[styles.subtitle, disabled && styles.textDisabled]}>{subtitle}</Text>
      <View style={[styles.badge, { backgroundColor: badgeBg }]}>
        <Text style={[styles.badgeText, { color: badgeColor }]}>{badge}</Text>
      </View>
    </View>
  )

  if (disabled) return card

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      {card}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    height: v3.components.roleCard.height,
    borderRadius: v3.components.roleCard.borderRadius,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    padding: 20,
    justifyContent: 'center',
    gap: 8,
  },
  cardSelected: { borderColor: v3.colors.ink, borderWidth: 2 },
  cardDisabled: { opacity: 0.5 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Outfit_800ExtraBold',
    fontWeight: '850',
    color: v3.colors.textPrimary,
  },
  subtitle: {
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
    fontWeight: '600',
    color: v3.colors.textSecondary,
  },
  badge: {
    height: v3.components.badge.height,
    borderRadius: v3.components.badge.borderRadius,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  badgeText: {
    fontSize: 8.8,
    fontFamily: 'Outfit_700Bold',
    fontWeight: '800',
  },
  textDisabled: { opacity: 0.6 },
})
