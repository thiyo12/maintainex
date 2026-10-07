import React from 'react'
import { View, StyleProp, ViewStyle } from 'react-native'
import { WarningCircle } from 'phosphor-react-native'
import Button from './Button'
import { H3, BodySmall } from './Typography'
import { useColors } from '../../lib/theme'
import { spacing } from '../../lib/tokens'

interface ErrorStateProps {
  title?: string
  message?: string | null
  retryText?: string | null
  onRetry?: () => void
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Canonical V2 error state. Title primary tone, message muted — never blank. */
export default function ErrorState({
  title = 'Something went wrong',
  message,
  retryText = 'Try again',
  onRetry,
  style,
  testID,
}: ErrorStateProps) {
  const colors = useColors()

  return (
    <View
      testID={testID}
      style={[{ alignItems: 'center', padding: spacing.xxl }, style]}
    >
      <WarningCircle size={48} color={colors.error} weight="fill" />
      <H3 style={{ marginTop: spacing.lg, textAlign: 'center' }}>{title}</H3>
      {message ? (
        <BodySmall tone="muted" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
          {message}
        </BodySmall>
      ) : null}
      {onRetry && retryText ? (
        <Button title={retryText} onPress={onRetry} variant="secondary" fullWidth={false} style={{ marginTop: spacing.lg }} />
      ) : null}
    </View>
  )
}
