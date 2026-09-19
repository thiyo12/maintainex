import { useEffect, useMemo, useRef } from 'react'
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Buildings, CaretRight, UserCircle } from 'phosphor-react-native'
import { useRouter } from 'expo-router'

import { getCurrentLanguage } from '../../lib/i18n'
import { v3 } from '../../theme/v3/tokens'
import AuthShell from '../../components/v3/AuthShell'
import V3NavBar from '../../components/v3/V3NavBar'

const COPY = {
  en: {
    nav: 'Provider profile',
    eyebrow: 'HOW YOU WORK',
    title: 'Choose your provider profile',
    subtitle: 'Customers will see the profile type you register here. This also controls the tools and verification flow you get.',
    individual: 'Individual professional',
    individualDesc: 'You work on your own, choose your exact services and receive jobs directly.',
    individualBadge: 'SOLO',
    company: 'Service company',
    companyDesc: 'You operate through a business, manage a team, quote projects and dispatch work.',
    companyBadge: 'TEAM',
    individualMeta: 'Personal ID verification',
    companyMeta: 'Business profile & team workspace',
  },
  ta: {
    nav: 'சேவை வழங்குநர் சுயவிவரம்',
    eyebrow: 'நீங்கள் எப்படி வேலை செய்கிறீர்கள்?',
    title: 'உங்கள் சேவை சுயவிவரத்தைத் தேர்வு செய்யுங்கள்',
    subtitle: 'இங்கே தேர்வு செய்யும் வகைதான் வாடிக்கையாளர்களுக்கு காட்டப்படும். அதற்கேற்ப உங்கள் கருவிகளும் சரிபார்ப்பும் அமையும்.',
    individual: 'தனிநபர் நிபுணர்',
    individualDesc: 'நீங்கள் தனியாக வேலை செய்கிறீர்கள். உங்கள் சேவைகளைத் தேர்வு செய்து வேலைகளை நேரடியாகப் பெறலாம்.',
    individualBadge: 'தனிநபர்',
    company: 'சேவை நிறுவனம்',
    companyDesc: 'நிறுவனமாக வேலை செய்து, குழுவை நிர்வகித்து, திட்டங்களுக்கு விலை வழங்கி வேலைகளை ஒதுக்கலாம்.',
    companyBadge: 'நிறுவனம்',
    individualMeta: 'தனிப்பட்ட அடையாளச் சரிபார்ப்பு',
    companyMeta: 'நிறுவன சுயவிவரம் மற்றும் குழு நிர்வாகம்',
  },
  si: {
    nav: 'සේවා සපයන්නාගේ පැතිකඩ',
    eyebrow: 'ඔබ වැඩ කරන්නේ කොහොමද?',
    title: 'ඔබගේ සේවා පැතිකඩ තෝරන්න',
    subtitle: 'ඔබ මෙහි තෝරන පැතිකඩ වර්ගය පාරිභෝගිකයන්ට පෙන්වයි. ඔබට ලැබෙන මෙවලම් සහ සත්‍යාපන ක්‍රියාවලියත් ඒ අනුව වෙනස් වේ.',
    individual: 'තනි වෘත්තිකයෙක්',
    individualDesc: 'ඔබ තනිව වැඩ කරයි. ඔබට කළ හැකි සේවා තෝරා රැකියා සෘජුවම ලබාගන්න.',
    individualBadge: 'තනි',
    company: 'සේවා සමාගමක්',
    companyDesc: 'ව්‍යාපාරයක් ලෙස වැඩ කරමින් කණ්ඩායම, මිල ගණන් සහ වැඩ බෙදාහැරීම කළමනාකරණය කරන්න.',
    companyBadge: 'කණ්ඩායම',
    individualMeta: 'පුද්ගලික හැඳුනුම්පත් සත්‍යාපනය',
    companyMeta: 'සමාගම් පැතිකඩ සහ කණ්ඩායම් පාලනය',
  },
} as const

export default function ProviderTypeScreen() {
  const router = useRouter()
  const language = getCurrentLanguage()?.slice(0, 2)
  const copy = COPY[language === 'ta' || language === 'si' ? language : 'en']

  const drift = useRef(new Animated.Value(0)).current
  const appear = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(appear, { toValue: 1, friction: 8, tension: 55, useNativeDriver: true }).start()
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 2800, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 2800, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [appear, drift])

  const softMove = useMemo(() => ({
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-10, 12] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [9, -7] }) },
      { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.08] }) },
    ],
  }), [drift])

  return (
    <AuthShell bg={v3.colors.canvas}>
      <V3NavBar title={copy.nav} onBack={() => router.back()} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: appear,
            transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
          },
        ]}
      >
        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>

        <TouchableOpacity
          style={[styles.providerCard, styles.individualCard]}
          activeOpacity={0.86}
          onPress={() => router.push({ pathname: '/(auth)/register', params: { role: 'TASKER' } } as any)}
        >
          <Animated.View style={[styles.bigOrb, styles.individualOrb, softMove]} />
          <View style={styles.cardHeader}>
            <View style={styles.iconLight}><UserCircle size={28} color={v3.colors.ink} weight="fill" /></View>
            <View style={styles.badgeLight}><Text style={styles.badgeLightText}>{copy.individualBadge}</Text></View>
          </View>
          <View>
            <Text style={styles.individualTitle}>{copy.individual}</Text>
            <Text style={styles.individualDesc}>{copy.individualDesc}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLight}>{copy.individualMeta}</Text>
            <View style={styles.arrowLight}><CaretRight size={18} color={v3.colors.ink} weight="bold" /></View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.providerCard, styles.companyCard]}
          activeOpacity={0.86}
          onPress={() => router.push({ pathname: '/(auth)/register', params: { role: 'COMPANY' } } as any)}
        >
          <Animated.View
            style={[
              styles.bigOrb,
              styles.companyOrbOne,
              {
                transform: [
                  { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [14, -12] }) },
                  { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [-9, 10] }) },
                  { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1.05, 0.95] }) },
                ],
              },
            ]}
          />
          <Animated.View style={[styles.smallOrb, styles.companyOrbTwo, softMove]} />
          <View style={styles.cardHeader}>
            <View style={styles.iconDark}><Buildings size={27} color="#FFFFFF" weight="fill" /></View>
            <View style={styles.badgeDark}><Text style={styles.badgeDarkText}>{copy.companyBadge}</Text></View>
          </View>
          <View>
            <Text style={styles.companyTitle}>{copy.company}</Text>
            <Text style={styles.companyDesc}>{copy.companyDesc}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaDark}>{copy.companyMeta}</Text>
            <View style={styles.arrowDark}><CaretRight size={18} color="#FFFFFF" weight="bold" /></View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </AuthShell>
  )
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 18, paddingTop: 12 },
  eyebrow: { fontSize: 8.5, letterSpacing: 1.05, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.textMuted, marginBottom: 8 },
  title: { fontSize: 29, lineHeight: 34, fontFamily: 'Outfit_900Black', color: v3.colors.ink, letterSpacing: -0.4 },
  subtitle: { marginTop: 8, marginBottom: 18, maxWidth: 345, fontSize: 10.2, lineHeight: 15.5, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  providerCard: { minHeight: 224, borderRadius: 28, padding: 18, marginBottom: 14, overflow: 'hidden', justifyContent: 'space-between' },
  individualCard: { backgroundColor: '#F1F3FF', borderWidth: 1, borderColor: '#D8DDF9' },
  companyCard: { backgroundColor: '#080808', borderWidth: 1, borderColor: '#252525' },
  bigOrb: { position: 'absolute', width: 190, height: 190, borderRadius: 95 },
  smallOrb: { position: 'absolute', width: 104, height: 104, borderRadius: 52 },
  individualOrb: { right: -55, top: -64, backgroundColor: '#AAB8FF', opacity: 0.42 },
  companyOrbOne: { right: -48, top: -69, backgroundColor: '#B891FF', opacity: 0.2 },
  companyOrbTwo: { left: -34, bottom: -37, backgroundColor: '#F1B846', opacity: 0.16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconLight: { width: 50, height: 50, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  iconDark: { width: 50, height: 50, borderRadius: 17, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333333', alignItems: 'center', justifyContent: 'center' },
  badgeLight: { minHeight: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  badgeDark: { minHeight: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  badgeLightText: { fontSize: 7.7, letterSpacing: 0.7, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  badgeDarkText: { fontSize: 7.7, letterSpacing: 0.7, fontFamily: 'Outfit_900Black', color: '#DEDEDE' },
  individualTitle: { marginTop: 14, fontSize: 20, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  individualDesc: { marginTop: 5, maxWidth: 295, fontSize: 9.6, lineHeight: 14.5, fontFamily: 'Outfit_600SemiBold', color: '#565D76' },
  companyTitle: { marginTop: 14, fontSize: 20, fontFamily: 'Outfit_900Black', color: '#FFFFFF' },
  companyDesc: { marginTop: 5, maxWidth: 295, fontSize: 9.6, lineHeight: 14.5, fontFamily: 'Outfit_600SemiBold', color: '#B7B7B7' },
  metaRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaLight: { flex: 1, paddingRight: 12, fontSize: 8.7, fontFamily: 'Outfit_700Bold', color: '#59617E' },
  metaDark: { flex: 1, paddingRight: 12, fontSize: 8.7, fontFamily: 'Outfit_700Bold', color: '#A6A6A6' },
  arrowLight: { width: 37, height: 37, borderRadius: 18.5, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  arrowDark: { width: 37, height: 37, borderRadius: 18.5, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333333', alignItems: 'center', justifyContent: 'center' },
})
