import React from 'react'
import { StyleProp, ViewStyle } from 'react-native'
import PressableScale from './PressableScale'
import { useColors } from '../../lib/theme'
import { borderRadius, opacity } from '../../lib/tokens'

interface IconButtonProps {
  onPress?: () => void
  disabled?: boolean
  size?: number
  variant?: 'filled' | 'tinted' | 'ghost'
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
  testID?: string
}

/** Canonical V2 circular icon button. Minimum 44px touch target. */
export default function IconButton({
  onPress,
  disabled = false,
  size = 44,
  variant = 'tinted',
  style,
  children,
  testID,
}: IconButtonProps) {
  const colors = useColors()

  return (
    <PressableScale
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      testID={testID}
      style={[
        {
          width: Math.max(size, 44),
          height: Math.max(size, 44),
          borderRadius: borderRadius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor:
            variant === 'filled'
              ? disabled
                ? colors.surfaceHigh
                : colors.amber
              : variant === 'tinted'
                ? colors.surface
                : 'transparent',
          ...(disabled ? { opacity: opacity.disabled + 0.3 } : null),
        },
        style,
      ]}
    >
      {children}
    </PressableScale>
  )
}
