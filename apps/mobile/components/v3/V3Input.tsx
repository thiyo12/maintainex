import { useState } from 'react'
import { StyleProp, StyleSheet, Text, TextInput, TouchableOpacity, View, ViewStyle } from 'react-native'
import { Eye, EyeSlash } from 'phosphor-react-native'
import { v3 } from '../../theme/v3/tokens'

interface Props {
  label?: string
  placeholder?: string
  value: string
  onChangeText: (text: string) => void
  error?: string
  secureTextEntry?: boolean
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric'
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  editable?: boolean
  rightAccessory?: React.ReactNode
  containerStyle?: StyleProp<ViewStyle>
}

export default function V3Input({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  editable = true,
  rightAccessory,
  containerStyle,
}: Props) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = secureTextEntry && !showPassword

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputRow, error ? styles.inputError : null]}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={v3.colors.textPlaceholder}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
        />
        {secureTextEntry ? (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {showPassword
              ? <Eye size={18} color={v3.colors.textMuted} weight="bold" />
              : <EyeSlash size={18} color={v3.colors.textMuted} weight="bold" />}
          </TouchableOpacity>
        ) : rightAccessory ? <View style={styles.eyeBtn}>{rightAccessory}</View> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 10, fontFamily: 'Outfit_700Bold', color: '#4F4F4F', marginLeft: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', height: v3.components.input.height, borderRadius: v3.components.input.borderRadius, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, paddingHorizontal: 16 },
  inputError: { borderColor: v3.colors.error },
  input: { flex: 1, fontSize: 12, fontFamily: 'Outfit_500Medium', color: v3.colors.textPrimary, paddingVertical: 0 },
  eyeBtn: { paddingLeft: 8 },
  error: { fontSize: 10, fontFamily: 'Outfit_500Medium', color: v3.colors.error, marginLeft: 2 },
})
