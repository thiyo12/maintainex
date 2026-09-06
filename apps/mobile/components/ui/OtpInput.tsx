import { useRef, useState, useEffect } from 'react'
import { View, TextInput, StyleSheet, Text, Animated } from 'react-native'

interface Props {
  length?: number
  onComplete: (code: string) => void
  autoFocus?: boolean
  error?: string
  loading?: boolean
}

export default function OtpInput({
  length = 6, onComplete, autoFocus = true,
  error, loading,
}: Props) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''))
  const [focused, setFocused] = useState<number>(0)
  const inputRefs = useRef<(TextInput | null)[]>([])
  const shakeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!error) return
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -4, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start(() => {
      setValues(Array(length).fill(''))
      inputRefs.current[0]?.focus()
    })
  }, [error])

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    }
  }, [])

  const handleChange = (text: string, index: number) => {
    if (text.length > 1) {
      const digits = text.replace(/\D/g, '').slice(0, length)
      const newValues = [...Array(length).fill('')]
      digits.split('').forEach((d, i) => { newValues[i] = d })
      setValues(newValues)
      if (digits.length === length) {
        inputRefs.current[length - 1]?.blur()
        onComplete(digits)
      } else {
        inputRefs.current[digits.length]?.focus()
      }
      return
    }

    const digit = text.replace(/\D/g, '').slice(-1)
    const newValues = [...values]
    newValues[index] = digit
    setValues(newValues)

    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
      setFocused(index + 1)
    }

    if (digit && index === length - 1) {
      const code = newValues.join('')
      if (code.length === length) {
        inputRefs.current[index]?.blur()
        onComplete(code)
      }
    }
  }

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace') {
      const newValues = [...values]
      if (values[index]) {
        newValues[index] = ''
        setValues(newValues)
      } else if (index > 0) {
        newValues[index - 1] = ''
        setValues(newValues)
        inputRefs.current[index - 1]?.focus()
        setFocused(index - 1)
      }
    }
  }

  const isComplete = values.join('').length === length
  const hasError = !!error

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
      <View style={styles.row}>
        {Array(length).fill(0).map((_, index) => {
          const isFocused = focused === index
          const hasValue = !!values[index]
          const borderColor = hasError
            ? '#EF4444'
            : isComplete
              ? '#22C55E'
              : isFocused
                ? '#F5A623'
                : '#2E2E2E'

          return (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref }}
              style={[styles.box, { borderColor }]}
              value={values[index]}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              onFocus={() => setFocused(index)}
              keyboardType="number-pad"
              maxLength={6}
              selectTextOnFocus
              editable={!loading}
              caretHidden
            />
          )
        })}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginVertical: 24,
  },
  box: {
    width: 48,
    height: 58,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: '#1C1C1C',
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: 'Outfit_700Bold',
    textAlign: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
    fontFamily: 'Outfit_400Regular',
    marginTop: -16,
  },
})
