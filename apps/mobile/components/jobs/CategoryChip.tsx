import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { colors } from '../../lib/colors'
import { fonts } from '../../lib/fonts'

interface Props {
  icon: string
  name: string
  selected?: boolean
  onPress: () => void
}

export default function CategoryChip({ icon, name, selected, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.selected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.name, selected && styles.nameSelected]}>{name}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    minWidth: 90,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  selected: {
    backgroundColor: colors.amberBg,
    borderColor: colors.amber,
  },
  icon: { fontSize: 28, marginBottom: 6 },
  name: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.ink, textAlign: 'center' },
  nameSelected: { color: colors.amberDark, fontFamily: fonts.headingBold },
})
