import React, { forwardRef } from 'react'
import {
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native'
import { BodySmall, Caption } from './Typography'
import { useColors } from '../../lib/theme'
import { borderRadius, fontSizes, spacing } from '../../lib/tokens'
import { fonts } from '../../lib/fonts'

interface MxTextInputProps extends RNTextInputProps {
  label?: string
  error?: string | null
  hint?: string | null
  containerStyle?: StyleProp<ViewStyle>
}

/** Canonical V2 text input. Amber focus ring, explicit error text, readable placeholder. */
const TextInput = forwardRef<RNTextInput, MxTextInputProps>(function TextInput(
  { label, error, hint, containerStyle, style, editable = true, ...rest },
  ref,
) {
  const colors = useColors()
  const [focused, setFocused] = React.useState(false)

  return (
    <View style={containerStyle}>
      {label ? (
        <BodySmall tone="secondary" style={{ marginBottom: spacing.xs }}>
          {label}
        </BodySmall>
      ) : null}
      <RNTextInput
        ref={ref}
        editable={editable}
        placeholderTextColor={colors.muted}
        onFocus={e => {
          setFocused(true)
          rest.onFocus?.(e)
        }}
        onBlur={e => {
          setFocused(false)
          rest.onBlur?.(e)
        }}
        style={[
          {
            minHeight: 52,
            borderRadius: borderRadius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: error ? colors.error : focused ? colors.amber : colors.border,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            fontSize: fontSizes.body,
            fontFamily: fonts.body,
            color: colors.textPrimary,
            opacity: editable ? 1 : 0.6,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Caption tone="error" style={{ marginTop: spacing.xs }}>
          {error}
        </Caption>
      ) : hint ? (
        <Caption tone="muted" style={{ marginTop: spacing.xs }}>
          {hint}
        </Caption>
      ) : null}
    </View>
  )
})

export default TextInput
