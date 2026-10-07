import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Bank, CreditCard, Money, Plus, Wallet } from 'phosphor-react-native'
import { useRouter } from 'expo-router'
import { v3 } from '@/theme/v3/tokens'
import V3PageHeader from '@/components/v3/V3PageHeader'
import { V3SectionLabel, V3SettingsCard, V3SettingsRow } from '@/components/v3/V3SettingsUI'

export default function PaymentScreen() {
  const router = useRouter()
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <V3PageHeader title="Payments" subtitle="Choose how you want to secure eligible bookings." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <V3SectionLabel>Payment methods</V3SectionLabel>
        <V3SettingsCard>
          <V3SettingsRow icon={CreditCard} title="PayPal online checkout" subtitle="Pay securely with PayPal for eligible online payments" value="Online" onPress={() => Alert.alert('PayPal', 'PayPal checkout opens when you confirm an eligible booking.')} />
          <V3SettingsRow icon={Money} title="Cash" subtitle="Available for eligible jobs" value="Eligible" onPress={() => Alert.alert('Cash', 'Cash is shown only when the selected job supports it.')} />
          <V3SettingsRow icon={Wallet} title="MX Wallet" subtitle="Balance, top ups and refunds" onPress={() => router.push('/(customer)/wallet' as any)} />
          <V3SettingsRow icon={Bank} title="Payout / refund destination" subtitle="Manage where eligible refunds are returned" onPress={() => Alert.alert('Refund destination', 'Refund destination management is being connected to the payment provider.')} last />
        </V3SettingsCard>

        <TouchableOpacity activeOpacity={0.8} style={styles.primary} onPress={() => Alert.alert('Add payment method', 'Payment-provider setup is not enabled yet.')}>
          <Plus size={18} color={v3.colors.paper} weight="bold" />
          <Text style={styles.primaryText}>Add payment method</Text>
        </TouchableOpacity>

        <View style={styles.note}>
          <Text style={styles.noteTitle}>Protected checkout</Text>
          <Text style={styles.noteText}>MaintainEX shows the final amount, service fee and protection status before you confirm payment.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  content: { paddingHorizontal: 18, paddingBottom: 36 },
  primary: { marginTop: 16, height: 54, borderRadius: 16, backgroundColor: v3.colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: v3.colors.paper },
  note: { marginTop: 16, padding: 16, borderRadius: 18, backgroundColor: v3.colors.amberSoft },
  noteTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 14, color: v3.colors.ink },
  noteText: { marginTop: 4, fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 18, color: v3.colors.textSecondary },
})
