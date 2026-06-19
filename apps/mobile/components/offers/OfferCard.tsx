import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../lib/ThemeContext'

interface Props {
  title: string
  description?: string
  discountLabel: string
  price?: string
  badgeText?: string
  onPress: () => void
}

export default function OfferCard({ title, description, discountLabel, price, badgeText, onPress }: Props) {
  const colors = useColors()
  const styles = makeStyles(colors)

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.white, borderColor: colors.amber }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.badge, { backgroundColor: colors.amber }]}>
        <Text style={styles.badgeText}>{badgeText || 'OFFER'}</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.discount, { color: colors.amberDark }]}>{discountLabel}</Text>
        <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
        {description ? (
          <Text style={[styles.desc, { color: colors.muted }]} numberOfLines={2}>{description}</Text>
        ) : null}
        {price ? (
          <Text style={[styles.price, { color: colors.amberDark }]}>{price}</Text>
        ) : null}
      </View>
      <View style={[styles.arrow, { backgroundColor: colors.amberBg }]}>
        <Ionicons name="arrow-forward" size={14} color={colors.amberDark} />
      </View>
    </TouchableOpacity>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 24,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 48,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: 'Outfit_900Black',
    color: '#111827',
    writingDirection: 'ltr',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    transform: [{ rotate: '-90deg' }],
  },
  body: {
    flex: 1,
    padding: 12,
    gap: 3,
  },
  discount: {
    fontSize: 16,
    fontFamily: 'Outfit_900Black',
    letterSpacing: -0.3,
  },
  title: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  desc: {
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
    lineHeight: 14,
  },
  price: {
    fontSize: 12,
    fontFamily: 'Outfit_800ExtraBold',
    marginTop: 2,
  },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
})
