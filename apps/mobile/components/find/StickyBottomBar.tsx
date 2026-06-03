import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/colors'

interface Props {
  price: string
  label: string
  buttonText: string
  onPress: () => void
  disabled?: boolean
  icon?: keyof typeof Ionicons.glyphMap
}

export default function StickyBottomBar({ price, label, buttonText, onPress, disabled, icon }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.container}>
        <View style={styles.priceCol}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.price}>{price}</Text>
        </View>
        <TouchableOpacity
          style={[styles.button, disabled && styles.buttonDisabled]}
          onPress={onPress}
          disabled={disabled}
          activeOpacity={0.8}
        >
          {icon && <Ionicons name={icon} size={18} color="#fff" style={{ marginRight: 6 }} />}
          <Text style={styles.buttonText}>{buttonText}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  label: { fontSize: 11, color: colors.muted },
  price: { fontSize: 18, fontWeight: '700', color: colors.ink },
  button: {
    backgroundColor: colors.amber,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 15, fontWeight: '600', color: colors.white },
})
