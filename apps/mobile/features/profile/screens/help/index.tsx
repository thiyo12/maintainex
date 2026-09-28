import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'
import { fontSizes } from '@/lib/tokens'

const faqs = [
  { q: 'How do I create an account?', a: 'Download the app and sign up with your email or phone number. Choose your role: Customer, Tasker, or Company.' },
  { q: 'How do I book a service?', a: 'Browse job categories, select a tasker, send a booking request, and wait for the tasker to accept.' },
  { q: 'How does payment work?', a: 'Payments are held in escrow and released only after you confirm the job is complete.' },
  { q: 'How do I withdraw money?', a: 'Go to your Wallet and use the Withdraw option. Funds are transferred to your registered bank account.' },
  { q: 'How do I raise a dispute?', a: 'Open the job details and use the Dispute option. Our team will review and resolve it.' },
]

export default function HelpScreen() {
  const router = useRouter()
  const colors = useColors()
  const styles = makeStyles(colors)
  const { t } = { t: (k: string) => ({ 'settings.help': 'Help & Support', 'settings.contact': 'Contact Us', 'settings.faq': 'Frequently Asked Questions' })[k] || k }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Help & Support</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        {faqs.map((faq, i) => (
          <View key={i} style={styles.faqItem}>
            <Text style={styles.question}>{faq.q}</Text>
            <Text style={styles.answer}>{faq.a}</Text>
          </View>
        ))}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Contact Us</Text>
        <Text style={styles.answer}>Email: support@maintainex.com{"\n"}Response time: 24-48 hours</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 },
  title: { fontSize: fontSizes.h3, fontFamily: fonts.heading, color: colors.ink },
  content: { padding: 24 },
  sectionTitle: { fontSize: fontSizes.h3, fontFamily: fonts.heading, color: colors.ink, marginBottom: 16 },
  faqItem: { backgroundColor: colors.white, borderRadius: 12, padding: 16, marginBottom: 12 },
  question: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium, color: colors.ink, marginBottom: 4 },
  answer: { fontSize: fontSizes.bodySmall, fontFamily: fonts.body, color: colors.muted, lineHeight: 20 },
})
