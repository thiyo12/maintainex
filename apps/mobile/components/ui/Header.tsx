import React from 'react'
import { View, StyleProp, ViewStyle } from 'react-native'
import { ArrowLeft } from 'phosphor-react-native'
import { useRouter } from 'expo-router'
import IconButton from './IconButton'
import { H2 } from './Typography'
import { useColors } from '../../lib/theme'
import { spacing } from '../../lib/tokens'

interface HeaderProps {
  title: string
  showBack?: boolean
  onBack?: () => void
  right?: React.ReactNode
  style?: StyleProp<ViewStyle>
}

/** Canonical V2 screen header: back button + title + optional right action. */
export default function Header({ title, showBack = true, onBack, right, style }: HeaderProps) {
  const colors = useColors()
  const router = useRouter()

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          gap: spacing.sm,
          backgroundColor: colors.background,
        },
        style,
      ]}
    >
      {showBack ? (
        <IconButton variant="ghost" size={40} onPress={onBack ?? (() => router.back())} testID="header-back">
          <ArrowLeft size={22} color={colors.textPrimary} />
        </IconButton>
      ) : null}
      <H2 numberOfLines={1} style={{ flex: 1 }}>
        {title}
      </H2>
      {right}
    </View>
  )
}
