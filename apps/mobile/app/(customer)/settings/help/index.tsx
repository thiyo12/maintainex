import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'

export default function HelpScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const faqs = [
    { q: t('profile.faq1Q'), a: t('profile.faq1A') },
    { q: t('profile.faq2Q'), a: t('profile.faq2A') },
    { q: t('profile.faq3Q'), a: t('profile.faq3A') },
    { q: t('profile.faq4Q'), a: t('profile.faq4A') },
  ]

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()
  }, [])

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i)

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <Text style={styles.heading}>{t('profile.helpSupport')}</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <Text style={styles.sectionTitle}>{t('profile.faq')}</Text>

          <View style={styles.card}>
            {faqs.map((faq, i) => {
              const isOpen = openIndex === i
              return (
                <View key={i} style={[styles.faqItem, i === faqs.length - 1 && { borderBottomWidth: 0 }]}>
                  <TouchableOpacity style={styles.faqHeader} onPress={() => toggle(i)} activeOpacity={0.7}>
                    <Text style={styles.faqQuestion}>{faq.q}</Text>
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.gray}
                    />
                  </TouchableOpacity>
                  {isOpen && (
                    <Text style={styles.faqAnswer}>{faq.a}</Text>
                  )}
                </View>
              )
            })}
          </View>

          <Text style={styles.sectionTitle}>{t('profile.contactUs')}</Text>
          <View style={styles.card}>
            <View style={styles.contactRow}>
              <Ionicons name="mail-outline" size={20} color={colors.customerAccent} />
              <Text style={styles.contactText}>  support@maintainex.com</Text>
            </View>
            <View style={[styles.contactRow, { borderBottomWidth: 0 }]}>
              <Ionicons name="call-outline" size={20} color={colors.customerAccent} />
              <Text style={styles.contactText}>  +94 11 234 5678</Text>
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark, paddingHorizontal: 24, marginBottom: 16 },
  scroll: { paddingHorizontal: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.gray, marginBottom: 10, marginTop: 8, textTransform: 'uppercase' },
  card: {
    backgroundColor: colors.white, borderRadius: 14, padding: 4, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  faqItem: {
    borderBottomWidth: 1, borderBottomColor: colors.lightGray,
    paddingHorizontal: 16,
  },
  faqHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 16,
  },
  faqQuestion: { fontSize: 15, fontWeight: '600', color: colors.dark, flex: 1, paddingRight: 12 },
  faqAnswer: { fontSize: 13, color: colors.gray, lineHeight: 20, paddingBottom: 16 },
  contactRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: colors.lightGray,
  },
  contactText: { fontSize: 15, fontWeight: '500', color: colors.dark },
})
