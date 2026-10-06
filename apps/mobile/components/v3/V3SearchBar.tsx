import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { MagnifyingGlass } from 'phosphor-react-native'
import { v3 } from '../../theme/v3/tokens'

interface Props {
  value?: string
  onChangeText?: (text: string) => void
  onPress?: () => void
  placeholder?: string
  editable?: boolean
}

export default function V3SearchBar({ value, onChangeText, onPress, placeholder, editable = true }: Props) {
  if (onPress && !onChangeText) {
    return (
      <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
        <MagnifyingGlass size={16} color={v3.colors.textMuted} weight="regular" />
        <View style={styles.placeholderText}>
          {placeholder ? (
            <View>
              <View style={styles.placeholderLine} />
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <MagnifyingGlass size={16} color={v3.colors.textMuted} weight="regular" />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || 'Search services...'}
        placeholderTextColor={v3.colors.textPlaceholder}
        editable={editable}
        returnKeyType="search"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: v3.colors.surfaceWhite,
    borderWidth: 1,
    borderColor: v3.colors.line,
    borderRadius: v3.components.cta.borderRadius,
    height: 50,
    paddingHorizontal: 16,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 11.2,
    fontFamily: 'Outfit_500Medium',
    color: v3.colors.textPrimary,
    padding: 0,
  },
  placeholderText: {
    flex: 1,
  },
  placeholderLine: {
    width: 120,
    height: 10,
    borderRadius: 5,
    backgroundColor: v3.colors.surfaceGray,
  },
})
