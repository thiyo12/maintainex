import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Animated, Image, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { changeLanguage } from '../../lib/i18n'

const COPY = {
  en: {
    choose: 'Choose your language',
    line1: 'Get things done,',
    line2: 'without the runaround.',
    sub: 'Book trusted people, get quotes fast, and find places to rent.',
    continue: 'Continue',
    login: 'I already have an account',
  },
  ta: {
    choose: 'உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்',
    line1: 'வேலைகளை எளிதாக,',
    line2: 'சுற்றித்திரிவில்லாமல் முடிக்கவும்.',
    sub: 'நம்பகமான சேவை வழங்குநர்களை கண்டுபிடித்து, விரைவாக விலைகளைப் பெறுங்கள்.',
    continue: 'தொடரவும்',
    login: 'எனக்கு ஏற்கனவே கணக்கு உள்ளது',
  },
  si: {
    choose: 'ඔබගේ භාෂාව තෝරන්න',
    line1: 'වැඩ පහසුවෙන් කරගන්න,',
    line2: 'අනවශ්‍ය වටපිටාවක් නැතිව.',
    sub: 'විශ්වාසදායක සේවා සපයන්නන් සොයා මිල ගණන් ඉක්මනින් ලබාගන්න.',
    continue: 'ඉදිරියට',
    login: 'මට දැනටමත් ගිණුමක් ඇත',
  },
} as const

type LanguageCode = keyof typeof COPY

export default function WelcomeScreen() {
  const router = useRouter()
  const [language, setLanguage] = useState<LanguageCode | null>(null)
  const markOp = useRef(new Animated.Value(0)).current
  const markScale = useRef(new Animated.Value(0.9)).current
  const textOp = useRef(new Animated.Value(0)).current
  const textY = useRef(new Animated.Value(16)).current
  const heroOp = useRef(new Animated.Value(0)).current
  const heroY = useRef(new Animated.Value(20)).current
  const btnsOp = useRef(new Animated.Value(0)).current
  const btnsY = useRef(new Animated.Value(14)).current

  const copy = COPY[language || 'en']

  useEffect(() => {
    AsyncStorage.getItem('app-language')
      .then((saved) => {
        if (saved === 'en' || saved === 'ta' || saved === 'si') setLanguage(saved)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(markOp, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(markScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(textOp, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(textY, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(heroOp, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(heroY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.delay(150),
      Animated.parallel([
        Animated.timing(btnsOp, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(btnsY, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
    ]).start()
  }, [btnsOp, btnsY, heroOp, heroY, markOp, markScale, textOp, textY])

  const selectLanguage = async (next: LanguageCode) => {
    setLanguage(next)
    await AsyncStorage.setItem('app-language', next)
    await changeLanguage(next)
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topArea}>
        <Animated.View style={[styles.markWrap, { opacity: markOp, transform: [{ scale: markScale }] }]}>
          <Image source={require('../../assets/logo.png')} style={{ width: 60, height: 60 }} resizeMode="contain" />
        </Animated.View>

        <Animated.View style={[styles.brandWrap, { opacity: textOp, transform: [{ translateY: textY }] }]}>
          <Text style={styles.brand}>MΛINTΛINEX</Text>
        </Animated.View>
      </View>

      <View style={styles.midArea}>
        <Animated.View style={[styles.heroWrap, { opacity: heroOp, transform: [{ translateY: heroY }] }]}>
          <Text style={styles.heroLine1}>{copy.line1}</Text>
          <Text style={styles.heroLine2}>{copy.line2}</Text>
          <Text style={styles.heroSub}>{copy.sub}</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.btnArea, { opacity: btnsOp, transform: [{ translateY: btnsY }] }]}>
        <Text style={styles.languageTitle}>{copy.choose}</Text>
        <View style={styles.languageRow}>
          <LanguageChip label="English" active={language === 'en'} onPress={() => selectLanguage('en')} />
          <LanguageChip label="தமிழ்" active={language === 'ta'} onPress={() => selectLanguage('ta')} />
          <LanguageChip label="සිංහල" active={language === 'si'} onPress={() => selectLanguage('si')} />
        </View>

        <TouchableOpacity
          style={[styles.btnPrimary, !language && styles.btnDisabled]}
          onPress={() => router.push('/(auth)/role-select')}
          activeOpacity={0.85}
          disabled={!language}
        >
          <Text style={styles.btnPrimaryText}>{copy.continue}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnSecondary, !language && styles.btnDisabled]}
          onPress={() => router.push('/(auth)/login')}
          activeOpacity={0.85}
          disabled={!language}
        >
          <Text style={styles.btnSecondaryText}>{copy.login}</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  )
}

function LanguageChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.languageChip, active && styles.languageChipActive]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.languageChipText, active && styles.languageChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', paddingHorizontal: 24 },
  topArea: { flex: 2, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 },
  markWrap: {},
  brandWrap: { marginTop: 16 },
  brand: {
    fontSize: 23,
    fontFamily: 'Outfit_900Black',
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  midArea: { flex: 3.6, justifyContent: 'center', paddingBottom: 12 },
  heroWrap: {},
  heroLine1: { fontSize: 30, fontFamily: 'Outfit_900Black', fontWeight: '900', color: '#FFFFFF' },
  heroLine2: { fontSize: 30, fontFamily: 'Outfit_900Black', fontWeight: '900', color: '#FFFFFF', marginTop: 4 },
  heroSub: { fontSize: 11.5, fontFamily: 'Outfit_500Medium', fontWeight: '600', color: '#B9B9B9', marginTop: 14, lineHeight: 18 },
  btnArea: { flex: 2.4, justifyContent: 'flex-end', paddingBottom: 24, gap: 12 },
  languageTitle: { color: '#B9B9B9', fontSize: 10, fontFamily: 'Outfit_700Bold', textAlign: 'center', letterSpacing: 0.3 },
  languageRow: { flexDirection: 'row', gap: 8, marginBottom: 2 },
  languageChip: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#343434',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  languageChipActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  languageChipText: { color: '#D0D0D0', fontSize: 11, fontFamily: 'Outfit_700Bold' },
  languageChipTextActive: { color: '#000000' },
  btnPrimary: { height: 56, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 13.5, fontFamily: 'Outfit_800ExtraBold', fontWeight: '800', color: '#000000' },
  btnSecondary: { height: 52, borderRadius: 16, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#E5E5E5', alignItems: 'center', justifyContent: 'center' },
  btnSecondaryText: { fontSize: 13.5, fontFamily: 'Outfit_800ExtraBold', fontWeight: '800', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.45 },
})
