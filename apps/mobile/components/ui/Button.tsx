import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native'
import { colors } from '../../lib/colors'
import { fonts, fontSizes } from '../../lib/fonts'
import { spacing, borderRadius } from '../../lib/tokens'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost'

interface Props {
  label: string
  onPress: () => void
  variant?: Variant
  loading?: boolean
  disabled?: boolean
  color?: string
  style?: ViewStyle
  fullWidth?: boolean
}

export default function Button({ label, onPress, variant = 'primary', loading, disabled, color, style, fullWidth }: Props) {
  const isDisabled = disabled || loading

  const bgColor = () => {
    if (variant === 'primary') return color || colors.primary
    if (variant === 'secondary') return colors.surface
    return 'transparent'
  }

  const textColor = () => {
    if (variant === 'primary') return colors.white
    if (variant === 'outline') return color || colors.primary
    if (variant === 'ghost') return color || colors.inkLight
    return colors.ink
  }

  return (
    <TouchableOpacity
      style={[
        styles.base,
        fullWidth && styles.fullWidth,
        { backgroundColor: bgColor() },
        variant === 'outline' && { borderWidth: 2, borderColor: color || colors.primary },
        variant === 'ghost' && { borderWidth: 0 },
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : (color || colors.primary)} />
      ) : (
        <Text style={[styles.label, { color: textColor() }]}>{label}</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  label: { fontSize: fontSizes.button, fontFamily: fonts.button },
})
