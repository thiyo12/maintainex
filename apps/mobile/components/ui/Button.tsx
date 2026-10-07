import React from 'react'
import { ActivityIndicator, StyleProp, TextStyle, ViewStyle } from 'react-native'
import PressableScale from './PressableScale'
import { Body } from './Typography'
import { useColors } from '../../lib/theme'
import { borderRadius, fontSizes, opacity, spacing } from '../../lib/tokens'
import { fonts } from '../../lib/fonts'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'md' | 'sm'

interface ButtonProps {
  title: string
  onPress?: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  testID?: string
}

/**
 * Canonical V2 button. Amber primary on dark, explicit disabled/loading
 * states, minimum 48px touch target. Never white-on-white: disabled keeps
 * a visible surface with muted text.
 */
export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
  textStyle,
  testID,
}: ButtonProps) {
  const colors = useColors()
  const inactive = disabled || loading
  const height = size === 'sm' ? 40 : 52

  const backgroundColor =
    variant === 'primary'
      ? inactive
        ? colors.surfaceHigh
        : colors.amber
      : variant === 'danger'
        ? inactive
          ? colors.surfaceHigh
          : colors.error
        : 'transparent'

  const textColor =
    variant === 'primary' || variant === 'danger'
      ? inactive
        ? colors.muted
        : variant === 'danger'
          ? '#FFFFFF'
          : '#111111'
      : variant === 'secondary'
        ? inactive
          ? colors.muted
          : colors.textPrimary
        : inactive
          ? colors.muted
          : colors.amber

  return (
    <PressableScale
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      testID={testID}
      style={[
        {
          height,
          borderRadius: borderRadius.button,
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
          ...(fullWidth ? { alignSelf: 'stretch' as const } : { alignSelf: 'flex-start' as const }),
          ...(variant === 'secondary'
            ? { borderWidth: 1, borderColor: inactive ? colors.border : colors.muted }
            : null),
          ...(inactive ? { opacity: opacity.disabled + 0.3 } : null),
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Body
          style={[
            {
              fontFamily: fonts.semibold,
              fontSize: size === 'sm' ? fontSizes.buttonSmall : fontSizes.button,
              color: textColor,
            },
            textStyle,
          ]}
        >
          {title}
        </Body>
      )}
    </PressableScale>
  )
}
