import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Buildings, CaretRight, House, UserCircle, Wrench } from 'phosphor-react-native'
import { useRouter } from 'expo-router'

import { useAuth } from '../../lib/auth'
import { getCurrentLanguage } from '../../lib/i18n'
import type { User } from '../../lib/types'
import { v3 } from '../../theme/v3/tokens'
import AuthShell from '../../components/v3/AuthShell'
import V3NavBar from '../../components/v3/V3NavBar'

const COPY = {
  en: {
    nav: 'Choose profile',
    eyebrow: 'YOUR MAINTAINEX SPACES',
    title: 'Where do you want to continue?',
    subtitle: 'One sign-in can open the workspace connected to your account. Your jobs, reviews and history stay with the correct profile.',
    customer: 'Customer',
    customerDesc: 'Book services, post jobs and manage your home or property work.',
    individual: 'Individual provider',
    individualDesc: 'Receive jobs for the exact services registered to your Tasker profile.',
    company: 'Company',
    companyDesc: 'Quote work, dispatch teams and manage company operations.',
    current: 'CURRENT',
    ready: 'READY',
    setup: 'SET UP',
    unavailable: 'NOT SET UP',
    companySetup: 'Create company workspace',
    taskerUnavailable: 'An Individual provider profile has not been created for this account yet.',
  },
  ta: {
    nav: 'சுயவிவரத்தைத் தேர்வு செய்யுங்கள்',
    eyebrow: 'உங்கள் MAINTAINEX பகுதிகள்',
    title: 'எந்தப் பகுதியில் தொடர வேண்டும்?',
    subtitle: 'ஒரே உள்நுழைவில் உங்கள் கணக்குடன் இணைந்த சரியான பகுதியைத் திறக்கலாம். வேலைகள், மதிப்பீடுகள் மற்றும் வரலாறு அந்தந்த சுயவிவரத்திலேயே இருக்கும்.',
    customer: 'வாடிக்கையாளர்',
    customerDesc: 'சேவைகளை பதிவு செய்து, வேலைகளை இடித்து, வீடு அல்லது சொத்து பணிகளை நிர்வகிக்கவும்.',
    individual: 'தனிநபர் சேவை வழங்குநர்',
    individualDesc: 'உங்கள் Tasker சுயவிவரத்தில் தேர்ந்தெடுத்த சேவைகளுக்கான வேலைகளைப் பெறுங்கள்.',
    company: 'நிறுவனம்',
    companyDesc: 'விலை வழங்கி, குழுவுக்கு வேலை ஒதுக்கி, நிறுவன செயல்பாடுகளை நிர்வகிக்கவும்.',
    current: 'தற்போது',
    ready: 'தயார்',
    setup: 'அமைக்கவும்',
    unavailable: 'அமைக்கப்படவில்லை',
    companySetup: 'நிறுவன பகுதியை உருவாக்கவும்',
    taskerUnavailable: 'இந்தக் கணக்கிற்கு தனிநபர் சேவை வழங்குநர் சுயவிவரம் இன்னும் உருவாக்கப்படவில்லை.',
  },
  si: {
    nav: 'පැතිකඩ තෝරන්න',
    eyebrow: 'ඔබගේ MAINTAINEX අවකාශ',
    title: 'ඔබට දැන් කොතැනින් ඉදිරියට යන්නද?',
    subtitle: 'එකම පිවිසුමෙන් ඔබගේ ගිණුමට සම්බන්ධ නිවැරදි වැඩ අවකාශය විවෘත කළ හැක. වැඩ, ඇගයීම් සහ ඉතිහාසය ඒ ඒ පැතිකඩ සමඟම තබා ගනී.',
    customer: 'පාරිභෝගික',
    customerDesc: 'සේවා වෙන්කරගන්න, වැඩ පළකරන්න සහ නිවස හෝ දේපළ වැඩ කළමනාකරණය කරන්න.',
    individual: 'තනි සේවා සපයන්නා',
    individualDesc: 'ඔබගේ Tasker පැතිකඩේ තෝරා ඇති සේවාවන්ට ගැළපෙන වැඩ ලබාගන්න.',
    company: 'සමාගම',
    companyDesc: 'මිල ගණන් යවන්න, කණ්ඩායම්වලට වැඩ බෙදන්න සහ සමාගම් කටයුතු කළමනාකරණය කරන්න.',
    current: 'දැනට',
    ready: 'සූදානම්',
    setup: 'සකසන්න',
    unavailable: 'සකසා නැත',
    companySetup: 'සමාගම් අවකාශය සාදන්න',
    taskerUnavailable: 'මෙම ගිණුමට තනි සේවා සපයන්නාගේ පැතිකඩක් තවම සාදා නැත.',
  },
} as const

type Role = 'CUSTOMER' | 'TASKER' | 'COMPANY'

export default function RoleSwitchScreen() {
  const { user, switchRole } = useAuth()
  const router = useRouter()
  const [switching, setSwitching] = useState<Role | null>(null)

  const language = getCurrentLanguage()?.slice(0, 2)
  const copy = COPY[language === 'ta' || language === 'si' ? language : 'en']

  const currentRole: Role = user?.role === 'TASKER' ? 'TASKER' : user?.role === 'COMPANY' ? 'COMPANY' : 'CUSTOMER'
  const profiles = new Set(user?.availableProfiles || ['CUSTOMER', currentRole])
  const hasTasker = profiles.has('TASKER')
  const hasCompany = profiles.has('COMPANY')

  const drift = useRef(new Animated.Value(0)).current
  const enter = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, friction: 8, tension: 55, useNativeDriver: true }).start()
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 2700, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 2700, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [drift, enter])

  const floatA = useMemo(() => ({
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-9, 11] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [8, -8] }) },
      { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.08] }) },
    ],
  }), [drift])

  const floatB = useMemo(() => ({
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [12, -10] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [-7, 9] }) },
      { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1.06, 0.96] }) },
    ],
  }), [drift])

  const routeForUser = (nextUser: User) => {
    if (nextUser.role === 'COMPANY') {
      if (nextUser.needsOnboarding) router.replace('/(auth)/onboarding/company-setup')
      else router.replace('/(company)')
      return
    }

    if (nextUser.role === 'TASKER') {
      const identity = (nextUser.identityStatus || 'NOT_SUBMITTED').toUpperCase()
      const identityReady = identity === 'VERIFIED' || identity === 'APPROVED'
      if (nextUser.needsOnboarding || nextUser.taskerOnboardingStage === 'SERVICES') {
        router.replace('/(auth)/onboarding/tasker-services')
      } else if (nextUser.taskerOnboardingStage === 'IDENTITY' || (!identityReady && (identity === 'NOT_SUBMITTED' || identity === 'REJECTED'))) {
        router.replace({ pathname: '/(tasker)/identity', params: { onboarding: '1' } } as any)
      } else if (nextUser.taskerOnboardingStage === 'PENDING_APPROVAL' || !identityReady) {
        router.replace('/(auth)/pending-approval')
      } else {
        router.replace('/(tasker)')
      }
      return
    }

    router.replace('/(customer)')
  }

  const changeRole = async (next: Role) => {
    if (switching) return

    if (next === currentRole) {
      router.back()
      return
    }

    if (next === 'TASKER' && !hasTasker) {
      Alert.alert(copy.unavailable, copy.taskerUnavailable)
      return
    }

    setSwitching(next)
    try {
      const nextUser = await switchRole(next)
      routeForUser(nextUser)
    } catch (err: any) {
      let message = err?.message || 'Failed to switch profile'
      try { message = JSON.parse(message).error || message } catch {}
      Alert.alert('Unable to switch profile', message)
      setSwitching(null)
    }
  }

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
        <Animated.View style={[styles.pageOrbOne, floatA]} />
        <Animated.View style={[styles.pageOrbTwo, floatB]} />

        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>

        <ProfileCard
          tone="customer"
          icon={<House size={23} color={v3.colors.ink} weight="fill" />}
          title={copy.customer}
          description={copy.customerDesc}
          badge={currentRole === 'CUSTOMER' ? copy.current : copy.ready}
          current={currentRole === 'CUSTOMER'}
          loading={switching === 'CUSTOMER'}
          onPress={() => changeRole('CUSTOMER')}
          floatStyle={floatA}
        />

        <ProfileCard
          tone="tasker"
          icon={<Wrench size={23} color="#FFFFFF" weight="fill" />}
          title={copy.individual}
          description={copy.individualDesc}
          badge={currentRole === 'TASKER' ? copy.current : hasTasker ? copy.ready : copy.unavailable}
          current={currentRole === 'TASKER'}
          disabled={!hasTasker && currentRole !== 'TASKER'}
          loading={switching === 'TASKER'}
          onPress={() => changeRole('TASKER')}
          floatStyle={floatB}
        />

        <ProfileCard
          tone="company"
          icon={<Buildings size={23} color="#FFFFFF" weight="fill" />}
          title={copy.company}
          description={hasCompany || currentRole === 'COMPANY' ? copy.companyDesc : copy.companySetup}
          badge={currentRole === 'COMPANY' ? copy.current : hasCompany ? copy.ready : copy.setup}
          current={currentRole === 'COMPANY'}
          loading={switching === 'COMPANY'}
          onPress={() => changeRole('COMPANY')}
          floatStyle={floatA}
        />

        <View style={styles.accountNote}>
          <UserCircle size={17} color={v3.colors.textMuted} weight="bold" />
          <Text style={styles.accountNoteText}>One mobile sign-in · separate Customer, Individual and Company workspaces.</Text>
        </View>
      </Animated.View>
    </AuthShell>
  )
}

function ProfileCard({ tone, icon, title, description, badge, current, disabled, loading, onPress, floatStyle }: {
  tone: 'customer' | 'tasker' | 'company'
  icon: React.ReactNode
  title: string
  description: string
  badge: string
  current?: boolean
  disabled?: boolean
  loading?: boolean
  onPress: () => void
  floatStyle: any
}) {
  const dark = tone !== 'customer'

  return (
    <TouchableOpacity
      style={[
        styles.card,
        tone === 'customer' ? styles.customerCard : tone === 'tasker' ? styles.taskerCard : styles.companyCard,
        current && styles.currentCard,
        disabled && styles.disabledCard,
      ]}
      activeOpacity={0.86}
      onPress={onPress}
      disabled={disabled || loading}
    >
      <Animated.View
        style={[
          styles.cardOrb,
          tone === 'customer' ? styles.customerOrb : tone === 'tasker' ? styles.taskerOrb : styles.companyOrb,
          floatStyle,
        ]}
      />
      <View style={styles.cardHeader}>
        <View style={[styles.iconWrap, dark ? styles.iconDark : styles.iconLight]}>{icon}</View>
        <View style={[styles.badge, dark ? styles.badgeDark : styles.badgeLight]}>
          <Text style={[styles.badgeText, dark ? styles.badgeTextDark : styles.badgeTextLight]}>{loading ? '…' : badge}</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.cardCopy}>
          <Text style={[styles.cardTitle, dark && styles.cardTitleDark]}>{title}</Text>
          <Text style={[styles.cardDesc, dark && styles.cardDescDark]}>{description}</Text>
        </View>
        <View style={[styles.arrow, dark ? styles.arrowDark : styles.arrowLight]}>
          <CaretRight size={18} color={dark ? '#FFFFFF' : v3.colors.ink} weight="bold" />
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 18, paddingTop: 10, overflow: 'hidden' },
  pageOrbOne: { position: 'absolute', width: 210, height: 210, borderRadius: 105, right: -120, top: -30, backgroundColor: '#E7D7FF', opacity: 0.34 },
  pageOrbTwo: { position: 'absolute', width: 150, height: 150, borderRadius: 75, left: -90, bottom: 60, backgroundColor: '#FFE3A2', opacity: 0.28 },
  eyebrow: { fontSize: 8.5, letterSpacing: 1.05, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.textMuted, marginBottom: 8 },
  title: { fontSize: 29, lineHeight: 34, fontFamily: 'Outfit_900Black', color: v3.colors.ink, letterSpacing: -0.4 },
  subtitle: { marginTop: 8, marginBottom: 18, maxWidth: 350, fontSize: 10.2, lineHeight: 15.5, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  card: { minHeight: 150, borderRadius: 24, padding: 16, marginBottom: 11, overflow: 'hidden', justifyContent: 'space-between' },
  customerCard: { backgroundColor: '#FFF4D8', borderWidth: 1, borderColor: '#F0D8A5' },
  taskerCard: { backgroundColor: '#090909', borderWidth: 1, borderColor: '#292929' },
  companyCard: { backgroundColor: '#161226', borderWidth: 1, borderColor: '#342A52' },
  currentCard: { borderWidth: 2 },
  disabledCard: { opacity: 0.48 },
  cardOrb: { position: 'absolute', width: 150, height: 150, borderRadius: 75, right: -44, top: -58 },
  customerOrb: { backgroundColor: '#FFC94C', opacity: 0.38 },
  taskerOrb: { backgroundColor: '#4169FF', opacity: 0.2 },
  companyOrb: { backgroundColor: '#9A73FF', opacity: 0.24 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconWrap: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconLight: { backgroundColor: '#FFFFFF' },
  iconDark: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  badge: { minHeight: 24, paddingHorizontal: 9, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badgeLight: { backgroundColor: 'rgba(255,255,255,0.72)' },
  badgeDark: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  badgeText: { fontSize: 7.5, letterSpacing: 0.65, fontFamily: 'Outfit_900Black' },
  badgeTextLight: { color: v3.colors.ink },
  badgeTextDark: { color: '#E8E8E8' },
  cardBottom: { marginTop: 20, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  cardCopy: { flex: 1 },
  cardTitle: { fontSize: 18.5, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  cardTitleDark: { color: '#FFFFFF' },
  cardDesc: { marginTop: 4, maxWidth: 280, fontSize: 9.2, lineHeight: 13.8, fontFamily: 'Outfit_600SemiBold', color: '#665B45' },
  cardDescDark: { color: '#B9B9B9' },
  arrow: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  arrowLight: { backgroundColor: '#FFFFFF' },
  arrowDark: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  accountNote: { minHeight: 42, marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  accountNoteText: { maxWidth: 300, textAlign: 'center', fontSize: 8.5, lineHeight: 12.5, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textMuted },
})
