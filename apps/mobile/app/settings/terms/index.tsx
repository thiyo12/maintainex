import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { fontSizes } from '../../../lib/tokens'

export default function TermsScreen() {
  const router = useRouter()
  const colors = useColors()
  const styles = makeStyles(colors)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Terms & Privacy</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Terms of Service</Text>
        <Text style={styles.paragraph}>
          By using Maintainex, you agree to these terms. Our platform connects users with service providers.
          We facilitate payments through escrow to protect both parties.
        </Text>
        <Text style={styles.paragraph}>
          Service providers are independent contractors. Maintainex is not responsible for the quality of work
          performed, but we provide dispute resolution to address any issues.
        </Text>
        <Text style={styles.sectionTitle}>Privacy Policy</Text>
        <Text style={styles.paragraph}>
          We collect your name, email, phone number, and location to provide our services. Your data is stored
          securely and never shared with third parties without your consent.
        </Text>
        <Text style={styles.paragraph}>
          Your payment information is processed through secure third-party payment gateways. We do not store
          credit card numbers.
        </Text>
        <Text style={styles.sectionTitle}>User Responsibilities</Text>
        <Text style={styles.paragraph}>
          You agree to provide accurate information, use the platform lawfully, treat others with respect,
          and not engage in fraudulent activities.
        </Text>
        <Text style={styles.sectionTitle}>Contact</Text>
        <Text style={styles.paragraph}>
          For privacy-related inquiries, contact privacy@maintainex.com
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 },
  title: { fontSize: fontSizes.h3, fontFamily: fonts.heading, color: colors.ink },
  content: { padding: 24 },
  sectionTitle: { fontSize: fontSizes.h3, fontFamily: fonts.heading, color: colors.ink, marginBottom: 12, marginTop: 20 },
  paragraph: { fontSize: fontSizes.body, fontFamily: fonts.body, color: colors.muted, lineHeight: 22, marginBottom: 12 },
})
