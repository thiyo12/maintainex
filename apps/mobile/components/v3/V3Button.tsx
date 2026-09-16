import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native'
import { v3 } from '../../theme/v3/tokens'

type Variant = 'primary' | 'secondary' | 'ghost'

interface Props {
  label: string
  onPress: () => void
  variant?: Variant
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
  fullWidth?: boolean
}

export default function V3Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
  fullWidth = true,
}: Props) {
  const isDisabled = disabled || loading

  const bg = () => {
    if (variant === 'primary') return v3.colors.ink
    if (variant === 'secondary') return 'transparent'
    return 'transparent'
  }

  const textColor = () => {
    if (variant === 'primary') return v3.colors.paper
    if (variant === 'secondary') return v3.colors.ink
    return v3.colors.ink
  }

  return (
    <TouchableOpacity
      style={[
        styles.base,
        fullWidth && styles.fullWidth,
        { backgroundColor: bg() },
        variant === 'secondary' && { borderWidth: 1, borderColor: v3.colors.line },
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? v3.colors.paper : v3.colors.ink} />
      ) : (
        <Text style={[styles.label, { color: textColor() }]}>{label}</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    height: v3.components.cta.height,
    borderRadius: v3.components.cta.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.45 },
  label: {
    fontSize: 13.5,
    fontFamily: 'Outfit_800ExtraBold',
    fontWeight: '850',
    letterSpacing: 0,
  },
})
