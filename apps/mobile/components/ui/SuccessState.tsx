import React from 'react'
import { View, StyleProp, ViewStyle } from 'react-native'
import { CheckCircle } from 'phosphor-react-native'
import Button from './Button'
import { H3, BodySmall } from './Typography'
import { useColors } from '../../lib/theme'
import { spacing } from '../../lib/tokens'

interface SuccessStateProps {
  title: string
  message?: string | null
  actionText?: string | null
  onAction?: () => void
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Canonical V2 success state. */
export default function SuccessState({
  title,
  message,
  actionText,
  onAction,
  style,
  testID,
}: SuccessStateProps) {
  const colors = useColors()

  return (
    <View
      testID={testID}
      style={[{ alignItems: 'center', padding: spacing.xxl }, style]}
    >
      <CheckCircle size={48} color={colors.success} weight="fill" />
      <H3 style={{ marginTop: spacing.lg, textAlign: 'center' }}>{title}</H3>
      {message ? (
        <BodySmall tone="muted" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
          {message}
        </BodySmall>
      ) : null}
      {onAction && actionText ? (
        <Button title={actionText} onPress={onAction} fullWidth={false} style={{ marginTop: spacing.lg }} />
      ) : null}
    </View>
  )
}
