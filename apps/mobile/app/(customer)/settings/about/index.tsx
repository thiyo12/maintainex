import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Linking, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Hammer, Globe, Envelope, Shield, Link } from 'phosphor-react-native'
import { useColors } from '../../../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { fonts } from '../../../../lib/fonts'

export default function AboutScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <Text style={styles.heading}>{t('profile.aboutApp')}</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <View style={styles.brandCard}>
            <View style={styles.iconWrap}>
              <Hammer size={36} color="#FFFFFF" weight="fill" />
            </View>
            <Text style={styles.appName}>MΛINTΛINEX</Text>
            <Text style={styles.version}>Version 1.0.0</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.description}>
              MΛINTΛINEX is Sri Lanka's trusted platform connecting customers with skilled
              taskers for home maintenance, repairs, and professional services. We make it
              easy to find, book, and pay for quality service providers in your area.
            </Text>
          </View>

          <View style={styles.card}>
            <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('https://maintainex.com')}>
              <Globe size={20} color="#F5A623" weight="fill" />
              <Text style={styles.linkText}>  www.maintainex.com</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.linkRow, { borderBottomWidth: 0 }]} onPress={() => Linking.openURL('mailto:hello@maintainex.com')}>
              <Envelope size={20} color="#F5A623" weight="fill" />
              <Text style={styles.linkText}>  hello@maintainex.com</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.policyBtn} onPress={() => router.push('/settings/terms')}>
            <Shield size={18} color="#F5A623" weight="fill" />
            <Text style={styles.policyBtnText}>  Privacy Policy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.creditRow}
            onPress={() => Linking.openURL('https://instagram.com/thiyothman')}
          >
            <Link size={12} color="#6F6B6B" weight="fill" />
            <Text style={styles.creditText}>
              Design & Developed by <Text style={styles.creditName}>Thiyoth</Text> · @thiyothman
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  heading: { fontSize: 28, fontFamily: 'Outfit_900Black', color: '#FFFFFF', paddingHorizontal: 24, marginBottom: 16 },
  scroll: { paddingHorizontal: 24 },
  brandCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 28,
    alignItems: 'center', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: '#F5A623',
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  appName: { fontSize: 22, fontFamily: 'Outfit_900Black', color: '#FFFFFF' },
  version: { fontSize: 13, color: '#6F6B6B', marginTop: 4, fontFamily: 'Outfit_500Medium' },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  description: { fontSize: 14, color: '#6F6B6B', fontFamily: 'Outfit_500Medium', lineHeight: 22 },
  linkRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2E2E2E',
  },
  linkText: { fontSize: 15, fontFamily: 'Outfit_600SemiBold', color: '#F5A623' },
  policyBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 14, marginBottom: 24,
  },
  policyBtnText: { fontSize: 14, fontFamily: 'Outfit_600SemiBold', color: '#F5A623' },
  creditRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 4, paddingVertical: 12, marginBottom: 20,
  },
  creditText: { fontSize: 11, color: '#6F6B6B', fontFamily: 'Outfit_500Medium' },
  creditName: { color: '#F5A623', fontFamily: 'Outfit_700Bold' },
})
