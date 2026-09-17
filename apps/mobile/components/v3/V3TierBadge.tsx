import { View, Text, StyleSheet } from 'react-native'
import { v3 } from '../../theme/v3/tokens'
import { tierById } from '../../lib/tiers'

interface Props {
  tierLevel?: string
}

export default function V3TierBadge({ tierLevel }: Props) {
  const tier = tierById(tierLevel)
  const Icon = tier.icon

  return (
    <View style={[styles.badge, { backgroundColor: v3.colors.amberTint }]}>
      <Icon size={12} color={tier.color} weight="fill" />
      <Text style={[styles.text, { color: tier.color }]}>{tier.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: v3.radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
  },
})
