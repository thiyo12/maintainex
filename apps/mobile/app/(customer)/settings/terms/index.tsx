import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { v3 } from '../../../../theme/v3/tokens'
import V3PageHeader from '../../../../components/v3/V3PageHeader'

const SECTIONS = [
  ['Using MaintainEX', 'MaintainEX connects customers with independent taskers, companies and property owners. Confirm scope, price and timing before work starts.'],
  ['Payments & protection', 'Eligible bookings can use MaintainEX payment and escrow workflows. The final payment screen shows the amount and protection state before confirmation.'],
  ['Safety & conduct', 'Users must provide accurate information, respect other users and follow applicable laws. Report unsafe behavior through Help & safety.'],
  ['Property listings', 'Owners are responsible for listing accuracy, availability and legal permission to rent or sell the property.'],
  ['Privacy', 'Account and booking information is used to operate the marketplace, provide support and improve safety. Exact contact details are disclosed only when required by the workflow.'],
]

export default function TermsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <V3PageHeader title="Terms & privacy" subtitle="The essentials in plain language." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {SECTIONS.map(([title, body]) => (
          <View key={title} style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
          </View>
        ))}
        <Text style={styles.note}>This in-app summary does not replace the full legal terms published by MaintainEX.</Text>
      </ScrollView>
    </SafeAreaView>
  )
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  content: { paddingHorizontal: 18, paddingBottom: 36 },
  card: { marginBottom: 10, padding: 16, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line },
  title: { fontFamily: 'Outfit_800ExtraBold', fontSize: 15, color: v3.colors.ink },
  body: { marginTop: 6, fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 19, color: v3.colors.textSecondary },
  note: { marginTop: 8, fontFamily: 'Outfit_500Medium', fontSize: 10.5, lineHeight: 16, color: v3.colors.textMuted },
})
