import { useEffect, useMemo, useRef } from 'react'
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Briefcase, CaretRight, House } from 'phosphor-react-native'
import { useRouter } from 'expo-router'

import { getCurrentLanguage } from '@/lib/i18n'
import { v3 } from '@/theme/v3/tokens'
import AuthShell from '@/components/v3/AuthShell'
import V3NavBar from '@/components/v3/V3NavBar'

const COPY = {
  en: {
    nav: 'Choose profile',
    eyebrow: 'YOUR MAINTAINEX SPACE',
    title: 'What are you here to do?',
    subtitle: 'Choose where you want to start. You can move between your available profiles later.',
    customer: 'Get something done',
    customerDesc: 'Book services, post jobs and manage work for your home or property.',
    provider: 'Earn with MaintainEX',
    providerDesc: 'Work as an individual professional or operate through your company.',
    customerBadge: 'CUSTOMER',
    providerBadge: 'PROVIDER',
  },
  ta: {
    nav: 'சுயவிவரத்தைத் தேர்வு செய்க',
    eyebrow: 'உங்கள் MAINTAINEX பகுதி',
    title: 'MaintainEX-ஐ எதற்காக பயன்படுத்தப் போகிறீர்கள்?',
    subtitle: 'முதலில் எந்தப் பகுதியில் தொடங்க வேண்டும் என்பதைத் தேர்வு செய்யுங்கள். பின்னர் உங்கள் சுயவிவரங்களுக்கு இடையில் மாறலாம்.',
    customer: 'எனக்கு ஒரு சேவை தேவை',
    customerDesc: 'சேவைகளை பதிவு செய்யவும், வேலைகளை இடவும், வீடு அல்லது சொத்து தொடர்பான பணிகளை நிர்வகிக்கவும்.',
    provider: 'MaintainEX மூலம் வேலை பெற',
    providerDesc: 'தனிநபர் நிபுணராகவும் அல்லது உங்கள் நிறுவனத்தின் மூலம் சேவைகளை வழங்கவும்.',
    customerBadge: 'வாடிக்கையாளர்',
    providerBadge: 'சேவை வழங்குநர்',
  },
  si: {
    nav: 'පැතිකඩ තෝරන්න',
    eyebrow: 'ඔබගේ MAINTAINEX අවකාශය',
    title: 'MaintainEX භාවිතා කරන්නෙ කුමක් සඳහාද?',
    subtitle: 'මුලින්ම ඔබට අවශ්‍ය පැත්ත තෝරන්න. පසුව ඔබට තිබෙන පැතිකඩ අතර මාරු විය හැක.',
    customer: 'මට සේවාවක් අවශ්‍යයි',
    customerDesc: 'සේවා වෙන්කරගන්න, වැඩ පළකරන්න, නිවස හෝ දේපළ සම්බන්ධ වැඩ කළමනාකරණය කරන්න.',
    provider: 'MaintainEX හරහා ආදායම් උපයන්න',
    providerDesc: 'තනි වෘත්තිකයෙකු ලෙස හෝ ඔබගේ සමාගම හරහා සේවා ලබා දෙන්න.',
    customerBadge: 'පාරිභෝගික',
    providerBadge: 'සේවා සපයන්නා',
  },
} as const

export default function RoleSelectScreen() {
  const router = useRouter()
  const language = getCurrentLanguage()?.slice(0, 2)
  const copy = COPY[language === 'ta' || language === 'si' ? language : 'en']

  const float = useRef(new Animated.Value(0)).current
  const enter = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 420, useNativeDriver: true }).start()
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [enter, float])

  const floatingTransform = useMemo(() => ({
    transform: [
      { translateX: float.interpolate({ inputRange: [0, 1], outputRange: [-8, 9] }) },
      { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [5, -7] }) },
      { scale: float.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
    ],
  }), [float])

  return (
    <AuthShell bg={v3.colors.canvas}>
      <V3NavBar title={copy.nav} onBack={() => router.back()} />
      <Animated.View
        style={[
          styles.content,
          {
            opacity: enter,
            transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
          },
        ]}
      >
        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>

        <TouchableOpacity
          style={[styles.card, styles.customerCard]}
          activeOpacity={0.86}
          onPress={() => router.push({ pathname: '/(auth)/register', params: { role: 'CUSTOMER' } } as any)}
        >
          <Animated.View style={[styles.orb, styles.customerOrb, floatingTransform]} />
          <View style={styles.cardTop}>
            <View style={styles.customerIcon}>
              <House size={22} color={v3.colors.ink} weight="fill" />
            </View>
            <View style={styles.lightBadge}><Text style={styles.lightBadgeText}>{copy.customerBadge}</Text></View>
          </View>
          <View style={styles.cardBottom}>
            <View style={styles.copy}>
              <Text style={styles.customerTitle}>{copy.customer}</Text>
              <Text style={styles.customerDesc}>{copy.customerDesc}</Text>
            </View>
            <View style={styles.lightArrow}><CaretRight size={18} color={v3.colors.ink} weight="bold" /></View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.providerCard]}
          activeOpacity={0.86}
          onPress={() => router.push('/(auth)/provider-type')}
        >
          <Animated.View
            style={[
              styles.orb,
              styles.providerOrbOne,
              {
                transform: [
                  { translateX: float.interpolate({ inputRange: [0, 1], outputRange: [10, -12] }) },
                  { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] }) },
                  { scale: float.interpolate({ inputRange: [0, 1], outputRange: [1.08, 0.96] }) },
                ],
              },
            ]}
          />
          <Animated.View style={[styles.orb, styles.providerOrbTwo, floatingTransform]} />
          <View style={styles.cardTop}>
            <View style={styles.providerIcon}>
              <Briefcase size={22} color="#FFFFFF" weight="fill" />
            </View>
            <View style={styles.darkBadge}><Text style={styles.darkBadgeText}>{copy.providerBadge}</Text></View>
          </View>
          <View style={styles.cardBottom}>
            <View style={styles.copy}>
              <Text style={styles.providerTitle}>{copy.provider}</Text>
              <Text style={styles.providerDesc}>{copy.providerDesc}</Text>
            </View>
            <View style={styles.darkArrow}><CaretRight size={18} color="#FFFFFF" weight="bold" /></View>
          </View>
        </TouchableOpacity>

        <Text style={styles.footnote}>MΛINTΛINEX · one account, the right workspace.</Text>
      </Animated.View>
    </AuthShell>
  )
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 18, paddingTop: 14 },
  eyebrow: { fontSize: 8.5, letterSpacing: 1.05, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.textMuted, marginBottom: 8 },
  title: { fontSize: 30, lineHeight: 35, fontFamily: 'Outfit_900Black', color: v3.colors.ink, letterSpacing: -0.45 },
  subtitle: { marginTop: 8, marginBottom: 22, maxWidth: 340, fontSize: 10.5, lineHeight: 16, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  card: { height: 210, borderRadius: 26, padding: 18, marginBottom: 14, overflow: 'hidden', justifyContent: 'space-between' },
  customerCard: { backgroundColor: '#FFF7E5', borderWidth: 1, borderColor: '#F0DCAD' },
  providerCard: { backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: '#232323' },
  orb: { position: 'absolute', borderRadius: 999 },
  customerOrb: { width: 170, height: 170, right: -56, top: -54, backgroundColor: '#FFD36E', opacity: 0.44 },
  providerOrbOne: { width: 168, height: 168, right: -55, top: -65, backgroundColor: '#2E5BFF', opacity: 0.2 },
  providerOrbTwo: { width: 115, height: 115, left: -42, bottom: -50, backgroundColor: '#F4B63E', opacity: 0.15 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  customerIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  providerIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#1E1E1E', borderWidth: 1, borderColor: '#333333', alignItems: 'center', justifyContent: 'center' },
  lightBadge: { minHeight: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.72)', alignItems: 'center', justifyContent: 'center' },
  lightBadgeText: { fontSize: 7.8, letterSpacing: 0.7, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  darkBadge: { minHeight: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  darkBadgeText: { fontSize: 7.8, letterSpacing: 0.7, fontFamily: 'Outfit_900Black', color: '#D8D8D8' },
  cardBottom: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  copy: { flex: 1 },
  customerTitle: { fontSize: 20, lineHeight: 24, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  customerDesc: { marginTop: 5, fontSize: 9.5, lineHeight: 14, fontFamily: 'Outfit_600SemiBold', color: '#665B45' },
  providerTitle: { fontSize: 20, lineHeight: 24, fontFamily: 'Outfit_900Black', color: '#FFFFFF' },
  providerDesc: { marginTop: 5, fontSize: 9.5, lineHeight: 14, fontFamily: 'Outfit_600SemiBold', color: '#B8B8B8' },
  lightArrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  darkArrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1B1B1B', borderWidth: 1, borderColor: '#343434', alignItems: 'center', justifyContent: 'center' },
  footnote: { marginTop: 4, textAlign: 'center', fontSize: 8.5, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textMuted },
})
