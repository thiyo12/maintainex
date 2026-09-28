import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'

interface Props {
  icon: string
  name: string
  selected?: boolean
  onPress: () => void
}

export default function CategoryChip({ icon, name, selected, onPress }: Props) {
  const colors = useColors()
    const styles = makeStyles(colors)
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        { backgroundColor: colors.white, borderColor: colors.border, shadowColor: colors.ink },
        selected && { backgroundColor: colors.amberBg, borderColor: colors.amber },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[
        styles.name,
        { color: colors.ink },
        selected && { color: colors.amberDark, fontFamily: fonts.headingBold },
      ]}>{name}</Text>
    </TouchableOpacity>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  chip: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    minWidth: 90,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  icon: { fontSize: 28, marginBottom: 6 },
  name: { fontSize: 12, fontFamily: fonts.bodyMedium, textAlign: 'center' },
})
