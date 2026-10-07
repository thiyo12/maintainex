import React from 'react'
import { View, TextInput as RNTextInput, StyleProp, ViewStyle } from 'react-native'
import { MagnifyingGlass, XCircle } from 'phosphor-react-native'
import PressableScale from './PressableScale'
import { useColors } from '../../lib/theme'
import { borderRadius, fontSizes, spacing } from '../../lib/tokens'
import { fonts } from '../../lib/fonts'

interface SearchInputProps {
  value: string
  onChangeText: (text: string) => void
  onSubmit?: () => void
  placeholder?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Canonical V2 search field with clear button. */
export default function SearchInput({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Search',
  style,
  testID,
}: SearchInputProps) {
  const colors = useColors()

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 52,
          borderRadius: borderRadius.full,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          paddingLeft: spacing.lg,
          paddingRight: spacing.sm,
        },
        style,
      ]}
    >
      <MagnifyingGlass size={20} color={colors.muted} />
      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        testID={testID}
        style={{
          flex: 1,
          marginLeft: spacing.sm,
          fontSize: fontSizes.body,
          fontFamily: fonts.body,
          color: colors.textPrimary,
          paddingVertical: spacing.md,
        }}
      />
      {value.length > 0 ? (
        <PressableScale onPress={() => onChangeText('')} style={{ padding: spacing.xs }}>
          <XCircle size={20} color={colors.muted} weight="fill" />
        </PressableScale>
      ) : null}
    </View>
  )
}
