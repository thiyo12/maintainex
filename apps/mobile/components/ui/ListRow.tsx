import React from 'react'
import { View, StyleProp, ViewStyle } from 'react-native'
import { CaretRight } from 'phosphor-react-native'
import PressableScale from './PressableScale'
import { Body, BodySmall } from './Typography'
import { useColors } from '../../lib/theme'
import { spacing } from '../../lib/tokens'

interface ListRowProps {
  title: string
  subtitle?: string | null
  left?: React.ReactNode
  right?: React.ReactNode
  chevron?: boolean
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Canonical V2 settings/menu row. Title always primary tone; subtitle muted. */
export default function ListRow({ title, subtitle, left, right, chevron, onPress, style, testID }: ListRowProps) {
  const colors = useColors()
  const body = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 56,
          paddingVertical: spacing.sm,
          gap: spacing.md,
        },
        style,
      ]}
    >
      {left}
      <View style={{ flex: 1 }}>
        <Body numberOfLines={1}>{title}</Body>
        {subtitle ? (
          <BodySmall tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>
            {subtitle}
          </BodySmall>
        ) : null}
      </View>
      {right}
      {chevron || (!right && onPress) ? <CaretRight size={18} color={colors.muted} /> : null}
    </View>
  )

  if (!onPress) return <View testID={testID}>{body}</View>
  return (
    <PressableScale onPress={onPress} testID={testID}>
      {body}
    </PressableScale>
  )
}
