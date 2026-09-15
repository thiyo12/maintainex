import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { useColors } from '../../lib/ThemeContext'
import { fonts } from '../../lib/fonts'

interface PinInputProps {
  length?: number
  onComplete: (pin: string) => void
  error?: string
  disabled?: boolean
}

export default function PinInput({ length = 6, onComplete, error, disabled }: PinInputProps) {
  const colors = useColors()
  const styles = makeStyles(colors)
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''))

  const handleChange = (text: string, index: number) => {
    if (disabled) return
    const newDigits = [...digits]
    newDigits[index] = text.slice(-1)
    setDigits(newDigits)

    if (text && index < length - 1) {
      // Auto-focus next input handled by React Native
    }

    const pin = newDigits.join('')
    if (pin.length === length && !newDigits.some(d => !d)) {
      onComplete(pin)
      setDigits(Array(length).fill(''))
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        {digits.map((digit, i) => (
          <TextInput
            key={i}
            style={[styles.input, digit ? styles.inputFilled : null, error ? styles.inputError : null]}
            value={digit}
            onChangeText={(text) => handleChange(text, i)}
            keyboardType="number-pad"
            maxLength={1}
            editable={!disabled}
            secureTextEntry
          />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { alignItems: 'center' },
    inputRow: { flexDirection: 'row', gap: 8 },
    input: {
      width: 48,
      height: 56,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.card,
      textAlign: 'center',
      fontSize: 24,
      fontFamily: fonts.bold,
      color: colors.text,
    },
    inputFilled: { borderColor: colors.amber },
    inputError: { borderColor: colors.error },
    error: { color: colors.error, fontSize: 13, fontFamily: fonts.regular, marginTop: 8 },
  })
}
