import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '@/lib/ThemeContext'

interface Props {
  price: string
  label: string
  buttonText: string
  onPress: () => void
  disabled?: boolean
  icon?: keyof typeof Ionicons.glyphMap
}

export default function StickyBottomBar({ price, label, buttonText, onPress, disabled, icon }: Props) {
  const colors = useColors()
    const styles = makeStyles(colors)
  return (
    <View style={[styles.wrap, { backgroundColor: colors.white, borderTopColor: colors.border }]}>
      <View style={styles.container}>
        <View style={styles.priceCol}>
          <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
          <Text style={[styles.price, { color: colors.ink }]}>{price}</Text>
        </View>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.amber }, disabled && { opacity: 0.5 }]}
          onPress={onPress}
          disabled={disabled}
          activeOpacity={0.8}
        >
          {icon && <Ionicons name={icon} size={18} color={colors.white} style={{ marginRight: 6 }} />}
          <Text style={[styles.buttonText, { color: colors.white }]}>{buttonText}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingBottom: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 8,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  priceCol: {},
  label: { fontSize: 11 },
  price: { fontSize: 18, fontWeight: '700' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
})
