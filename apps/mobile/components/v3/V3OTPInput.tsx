import { useState, useRef, useEffect } from 'react'
import { View, Text, TextInput, StyleSheet, Animated } from 'react-native'
import { v3 } from '../../theme/v3/tokens'

type Size = 'standard' | 'compact'

interface Props {
  size?: Size
  length?: number
  onComplete: (code: string) => void
  error?: string
  loading?: boolean
  autoFocus?: boolean
}

const SIZES = {
  standard: { width: 54, height: 62, borderRadius: 16, fontSize: 22 },
  compact: { width: 44, height: 52, borderRadius: 14, fontSize: 17 },
}

export default function V3OTPInput({
  size = 'standard',
  length = 6,
  onComplete,
  error,
  loading,
  autoFocus = true,
}: Props) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''))
  const [focused, setFocused] = useState(autoFocus ? 0 : -1)
  const inputRefs = useRef<(TextInput | null)[]>([])
  const shakeAnim = useRef(new Animated.Value(0)).current
  const s = SIZES[size]

  useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start(() => {
        setValues(Array(length).fill(''))
        inputRefs.current[0]?.focus()
      })
    }
  }, [error])

  const handleChange = (text: string, index: number) => {
    if (text.length > 1) {
      const pasted = text.slice(0, length).split('')
      const newValues = [...values]
      pasted.forEach((char, i) => { if (i < length) newValues[i] = char })
      setValues(newValues)
      const nextIdx = Math.min(pasted.length, length - 1)
      inputRefs.current[nextIdx]?.focus()
      if (pasted.length >= length) onComplete(newValues.join(''))
      return
    }

    const newValues = [...values]
    newValues[index] = text
    setValues(newValues)

    if (text && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    if (newValues.every(v => v) && newValues.join('').length === length) {
      onComplete(newValues.join(''))
    }
  }

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !values[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const isActive = (i: number) => i === focused
  const isFilled = (i: number) => !!values[i]

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
      <View style={styles.row}>
        {Array.from({ length }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.box,
              {
                width: s.width,
                height: s.height,
                borderRadius: s.borderRadius,
              },
              isActive(i) && styles.boxActive,
              isFilled(i) && styles.boxFilled,
              error && styles.boxError,
            ]}
          >
            <TextInput
              ref={ref => { inputRefs.current[i] = ref }}
              style={[styles.digit, { fontSize: s.fontSize }]}
              value={values[i]}
              onChangeText={text => handleChange(text, i)}
              onKeyPress={e => handleKeyPress(e, i)}
              onFocus={() => setFocused(i)}
              onBlur={() => setFocused(-1)}
              keyboardType="number-pad"
              maxLength={size === 'compact' ? 1 : 2}
              autoFocus={autoFocus && i === 0}
              editable={!loading}
              selectTextOnFocus
            />
          </View>
        ))}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  box: {
    borderWidth: 1.5,
    borderColor: v3.colors.line,
    backgroundColor: v3.colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: v3.colors.ink },
  boxFilled: { borderColor: v3.colors.ink },
  boxError: { borderColor: v3.colors.error },
  digit: {
    fontFamily: 'Outfit_800ExtraBold',
    fontWeight: '850',
    color: v3.colors.textPrimary,
    textAlign: 'center',
    paddingVertical: 0,
  },
})
