import { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, TextInput, View } from 'react-native'
import { v3 } from '../../theme/v3/tokens'

type Size = 'standard' | 'compact'

interface Props {
  size?: Size
  length?: number
  onComplete: (code: string) => void
  onChangeCode?: (code: string) => void
  autoSubmit?: boolean
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
  onChangeCode,
  autoSubmit = true,
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
    if (!error) return
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start(() => {
      const empty = Array(length).fill('')
      setValues(empty)
      onChangeCode?.('')
      inputRefs.current[0]?.focus()
    })
  }, [error, length, onChangeCode, shakeAnim])

  const publish = (next: string[]) => {
    const code = next.join('')
    onChangeCode?.(code)
    if (autoSubmit && next.every(Boolean) && code.length === length) onComplete(code)
  }

  const handleChange = (text: string, index: number) => {
    const digits = text.replace(/\D/g, '')
    if (digits.length > 1) {
      const pasted = digits.slice(0, length).split('')
      const next = Array(length).fill('')
      pasted.forEach((char, i) => { next[i] = char })
      setValues(next)
      publish(next)
      const nextIdx = Math.min(pasted.length, length - 1)
      inputRefs.current[nextIdx]?.focus()
      return
    }

    const next = [...values]
    next[index] = digits
    setValues(next)
    publish(next)
    if (digits && index < length - 1) inputRefs.current[index + 1]?.focus()
  }

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !values[index] && index > 0) inputRefs.current[index - 1]?.focus()
  }

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
      <View style={styles.row}>
        {Array.from({ length }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.box,
              { width: s.width, height: s.height, borderRadius: s.borderRadius },
              i === focused && styles.boxActive,
              !!values[i] && styles.boxFilled,
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
              maxLength={length}
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
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  box: { borderWidth: 1.5, borderColor: v3.colors.line, backgroundColor: v3.colors.paper, alignItems: 'center', justifyContent: 'center' },
  boxActive: { borderColor: v3.colors.ink },
  boxFilled: { borderColor: v3.colors.ink },
  boxError: { borderColor: v3.colors.error },
  digit: { fontFamily: 'Outfit_800ExtraBold', color: v3.colors.textPrimary, textAlign: 'center', paddingVertical: 0 },
})
