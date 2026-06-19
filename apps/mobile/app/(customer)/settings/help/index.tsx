import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../../../lib/ThemeContext'

const faqs = [
  {
    q: 'How do I find a tasker?',
    a: 'Browse categories on the home screen or use the search bar. Select a service, compare tasker profiles, and book the one that fits your needs.',
  },
  {
    q: 'How do payments work?',
    a: 'Payments are processed securely through our platform. You can pay via card (Visa/Mastercard), PayHere, or Stripe. Payment is held securely until the job is completed.',
  },
  {
    q: 'Can I cancel a booking?',
    a: 'Yes, you can cancel a booking from your active bookings screen. Cancellation policies may apply depending on how far in advance you cancel.',
  },
  {
    q: 'How do I contact support?',
    a: 'You can reach us via email at support@maintainex.com or call us at +94 11 234 5678. Our team is available Mon–Sat, 8 AM – 8 PM.',
  },
]

export default function HelpScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()
  }, [])

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i)

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <Text style={styles.heading}>Help & Support</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

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

          <Text style={styles.sectionTitle}>Contact Us</Text>
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
