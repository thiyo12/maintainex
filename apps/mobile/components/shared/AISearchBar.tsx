import { useRef, useEffect } from 'react'
import { View, TextInput, TouchableOpacity, Animated, Easing, StyleSheet, Platform } from 'react-native'
import { Sparkle, ArrowRight } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../lib/ThemeContext'
import { fonts } from '../../lib/fonts'

interface Props {
  value: string
  onChangeText: (t: string) => void
  onSearch: () => void
  placeholder?: string
}

export default function AISearchBar({ value, onChangeText, onSearch, placeholder }: Props) {
  const colors = useColors()
  const { t } = useTranslation()
  const glowRadius = useRef(new Animated.Value(8)).current
  const glowOp     = useRef(new Animated.Value(0.2)).current
  const sparkScale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(glowRadius, { toValue: 20, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(glowOp,     { toValue: 0.5, duration: 1800, useNativeDriver: false }),
        Animated.timing(sparkScale, { toValue: 1.2, duration: 1800, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(glowRadius, { toValue: 8, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(glowOp,     { toValue: 0.2, duration: 1800, useNativeDriver: false }),
        Animated.timing(sparkScale, { toValue: 1.0, duration: 1800, useNativeDriver: true }),
      ]),
    ])).start()
  }, [])

  return (
    <View style={styles.wrap}>
      {Platform.OS === 'ios' ? (
        <Animated.View style={[styles.glowLayer, {
          shadowColor: colors.amber,
          shadowOpacity: glowOp,
          shadowRadius: glowRadius,
          shadowOffset: { width: 0, height: 0 },
        }]} />
      ) : (
        <Animated.View style={[styles.androidGlow, {
          opacity: glowOp,
          transform: [{ scale: sparkScale }],
        }]} />
      )}
      <Animated.View style={[styles.leftIcon, { transform: [{ scale: sparkScale }] }]}>
        <Sparkle size={16} color={colors.amberDark} weight="fill" />
      </Animated.View>
      <TextInput
        style={[styles.input, { color: colors.ink, backgroundColor: colors.white, borderColor: colors.border }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || t('home.searchPlaceholder')}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        onSubmitEditing={onSearch}
      />
      <TouchableOpacity
        style={[styles.sendBtn, {
          backgroundColor: colors.amber,
          shadowColor: colors.amber, shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
        }]}
        onPress={onSearch}
        activeOpacity={0.8}
      >
        <ArrowRight size={14} color="#111827" weight="bold" />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap:        { marginHorizontal: 8, marginBottom: 8, position: 'relative' },
  glowLayer:   { position: 'absolute', inset: -6, borderRadius: 24, backgroundColor: 'transparent' },
  androidGlow: { position: 'absolute', inset: -4, borderRadius: 22, backgroundColor: 'rgba(245,158,11,0.12)' },
  leftIcon:    { position: 'absolute', left: 16, top: '50%', marginTop: -8, zIndex: 2 },
  input: {
    height: 52, borderRadius: 18, borderWidth: 1.5,
    paddingLeft: 42, paddingRight: 48,
    fontSize: 15, fontFamily: fonts.bodyMedium,
  },
  sendBtn: {
    position: 'absolute', right: 8, top: '50%', marginTop: -15,
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
  },
})
