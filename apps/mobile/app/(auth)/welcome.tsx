import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import Logo from '../../components/ui/Logo'
import LanguageSelector from '../../components/ui/LanguageSelector'
import { spacing, borderRadius } from '../../lib/tokens'

const roles = [
  {
    id: 'CUSTOMER',
    icon: 'person-outline' as const,
    titleKey: 'welcomeOnboarding.customerTitle',
    subtitleKey: 'welcomeOnboarding.customerDesc',
    accent: '#3B82F6',
    iconBg: '#EFF6FF',
  },
  {
    id: 'TASKER',
    icon: 'construct-outline' as const,
    titleKey: 'welcomeOnboarding.taskerTitle',
    subtitleKey: 'welcomeOnboarding.taskerDesc',
    accent: '#F59E0B',
    iconBg: '#FFFBEB',
  },
  {
    id: 'COMPANY',
    icon: 'business-outline' as const,
    titleKey: 'welcomeOnboarding.companyTitle',
    subtitleKey: 'welcomeOnboarding.companyDesc',
    accent: '#8B5CF6',
    iconBg: '#F5F3FF',
  },
]

const AMBER = '#F59E0B'

export default function WelcomeScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const pulseAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [])

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] })

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoWrapper}>
          <Animated.View style={[styles.logoCircle, { transform: [{ scale: pulseScale }] }]}>
            <Logo size={40} />
          </Animated.View>
        </View>

        <Text style={styles.heading}>{t('welcomeOnboarding.heading')}</Text>
        <Text style={styles.subtitle}>{t('welcomeOnboarding.subtitle')}</Text>

        <View style={styles.cardList}>
          {roles.map((role) => (
            <TouchableOpacity
              key={role.id}
              style={styles.card}
              onPress={() => router.push({ pathname: '/(auth)/register', params: { role: role.id } })}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: role.iconBg }]}>
                <Ionicons name={role.icon} size={24} color={role.accent} />
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: role.accent }]}>{t(role.titleKey)}</Text>
                <Text style={styles.cardSub}>{t(role.subtitleKey)}</Text>
              </View>
              <View style={styles.arrowBox}>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.langRow}>
          <LanguageSelector />
        </View>

        <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/(auth)/login')} activeOpacity={0.7}>
          <Text style={styles.signInText}>
            {t('welcomeOnboarding.signIn')}{' '}
            <Text style={styles.signInLink}>{t('welcomeOnboarding.signInLink')}</Text>
          </Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  content: { flex: 1, paddingHorizontal: spacing.xxl, justifyContent: 'center' },
  logoWrapper: { alignItems: 'center', marginBottom: spacing.lg },
  logoCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: AMBER + '30' },
  heading: { fontSize: 28, fontWeight: '800', color: '#111827', textAlign: 'center', lineHeight: 34, marginBottom: spacing.sm },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: spacing.xxxl },
  cardList: { gap: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, backgroundColor: '#FFFFFF', borderRadius: borderRadius.lg, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, minHeight: 72 },
  iconBox: { width: 48, height: 48, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  cardSub: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  arrowBox: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm },
  langRow: { alignItems: 'center', marginTop: spacing.xxxl },
  signInBtn: { alignItems: 'center', marginTop: spacing.sm, paddingVertical: spacing.sm },
  signInText: { fontSize: 14, color: '#6B7280' },
  signInLink: { fontWeight: '700', color: AMBER },

})
