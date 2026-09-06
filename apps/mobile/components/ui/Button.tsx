import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native'
import { useColors } from '../../lib/ThemeContext'
import { fonts } from '../../lib/fonts'

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
  const colors = useColors()
    const styles = makeStyles(colors)
  const isDisabled = disabled || loading

  const bgColor = () => {
    if (variant === 'primary') return color || colors.primary
    if (variant === 'secondary') return colors.surface
    return 'transparent'
  }

  const textColor = () => {
    if (variant === 'primary') return '#111'
    if (variant === 'outline') return color || colors.primary
    if (variant === 'ghost') return color || colors.muted
    return '#111'
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
        variant === 'primary' && {
          shadowColor: '#F5A623',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
          elevation: 6,
        },
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#111' : (color || colors.primary)} />
      ) : (
        <Text style={[styles.label, { color: textColor() }]}>{label}</Text>
      )}
    </TouchableOpacity>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  base: {
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  fullWidth: { width: '100%' },
  disabled:  { opacity: 0.45 },
  label:     { fontSize: 14, fontFamily: 'Outfit_700Bold', letterSpacing: 0.1 },
})
