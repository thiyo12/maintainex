import { useEffect, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FileText, ShieldCheck, Coffee, Clock } from 'phosphor-react-native'
import { useColors } from '../../../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { fonts } from '../../../../lib/fonts'

export default function TermsScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const fadeAnim = useRef(new Animated.Value(0)).current

  const sections = [
    {
      title: t('profile.termsOfService'),
      Icon: FileText,
      content:
        'By using MΛINTΛINEX, you agree to these terms. MΛINTΛINEX connects customers with taskers for various services. We do not directly employ taskers and are not liable for the quality of work performed. All bookings and payments are handled through our platform. You must provide accurate information when creating an account. Any misuse of the platform may result in account termination.',
    },
    {
      title: t('profile.privacyPolicy'),
      Icon: ShieldCheck,
      content:
        'We collect personal information such as your name, email, phone number, and location data to provide our services. Your data is stored securely and is never shared with third parties without your consent. We use encryption and industry-standard security measures to protect your information. You can request deletion of your data at any time by contacting support.',
    },
    {
      title: t('profile.cookiePolicy'),
      Icon: Coffee,
      content:
        'MΛINTΛINEX uses cookies to enhance your experience. These include essential cookies for authentication, analytics cookies to help us improve the platform, and preference cookies to remember your settings. You can manage cookie preferences in your browser settings. Disabling certain cookies may affect platform functionality.',
    },
  ]

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <Text style={styles.heading}>{t('profile.termsPrivacy')}</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          {sections.map((s, i) => (
            <View key={i} style={styles.card}>
              <View style={styles.cardHeader}>
                <s.Icon size={22} color="#F5A623" weight="fill" />
                <Text style={styles.cardTitle}>  {s.title}</Text>
              </View>
              <Text style={styles.cardBody}>{s.content}</Text>
            </View>
          ))}

          <View style={styles.footer}>
            <Clock size={16} color="#6F6B6B" weight="fill" />
            <Text style={styles.footerText}>  {t('profile.lastUpdated')}</Text>
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  heading: { fontSize: 28, fontFamily: 'Outfit_900Black', color: '#FFFFFF', paddingHorizontal: 24, marginBottom: 16 },
  scroll: { paddingHorizontal: 24 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 17, fontFamily: 'Outfit_700Bold', color: '#FFFFFF' },
  cardBody: { fontSize: 13, color: '#6F6B6B', fontFamily: 'Outfit_500Medium', lineHeight: 20 },
  footer: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: { fontSize: 12, color: '#6F6B6B', fontFamily: 'Outfit_500Medium' },
})
