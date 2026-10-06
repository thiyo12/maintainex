import React from 'react'
import { Modal, Pressable, View, StyleProp, ViewStyle, useWindowDimensions } from 'react-native'
import { H3, BodySmall } from './Typography'
import Button from './Button'
import { useColors } from '../../lib/theme'
import { borderRadius, spacing } from '../../lib/tokens'

interface BottomSheetProps {
  visible: boolean
  onClose: () => void
  title?: string
  subtitle?: string | null
  children: React.ReactNode
  primaryAction?: { title: string; onPress: () => void; loading?: boolean; disabled?: boolean }
  secondaryAction?: { title: string; onPress: () => void }
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Canonical V2 bottom sheet. Title always primary tone on elevated surface. */
export default function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  primaryAction,
  secondaryAction,
  style,
  testID,
}: BottomSheetProps) {
  const colors = useColors()
  const { height } = useWindowDimensions()

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} testID={testID}>
      <Pressable
        onPress={onClose}
        testID={testID ? `${testID}-backdrop` : undefined}
        style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={e => e.stopPropagation?.()}
          style={[
            {
              backgroundColor: colors.elevated,
              borderTopLeftRadius: borderRadius.bottomSheet,
              borderTopRightRadius: borderRadius.bottomSheet,
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: colors.border,
              padding: spacing.xl,
              paddingBottom: spacing.xxxl,
              maxHeight: height * 0.85,
            },
            style,
          ]}
        >
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg }} />
          {title ? <H3 style={{ marginBottom: subtitle ? spacing.xs : spacing.lg }}>{title}</H3> : null}
          {subtitle ? (
            <BodySmall tone="secondary" style={{ marginBottom: spacing.lg }}>
              {subtitle}
            </BodySmall>
          ) : null}
          {children}
          {primaryAction ? (
            <Button
              title={primaryAction.title}
              onPress={primaryAction.onPress}
              loading={primaryAction.loading}
              disabled={primaryAction.disabled}
              style={{ marginTop: spacing.lg }}
            />
          ) : null}
          {secondaryAction ? (
            <Button title={secondaryAction.title} onPress={secondaryAction.onPress} variant="ghost" style={{ marginTop: spacing.sm }} />
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  )
}
