import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CreditCard, Money } from 'phosphor-react-native'
import V3PageHeader from '@/components/v3/V3PageHeader'
import { V3SectionLabel, V3SettingsCard, V3SettingsRow } from '@/components/v3/V3SettingsUI'
import { v2Payments } from '@/api/v2-payments'
import { v3 } from '@/theme/v3/tokens'

export default function PaymentScreen() {
  const [availability, setAvailability] = useState<{
    onlinePaymentAvailable: boolean
  } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    v2Payments.availability()
      .then(result => {
        if (active) setAvailability(result)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => { active = false }
  }, [])

  const methodsUnavailable = failed || !availability

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <V3PageHeader title="Payments" subtitle="Payment options are confirmed for each booking." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <V3SectionLabel>Available at checkout</V3SectionLabel>
        <V3SettingsCard>
          <V3SettingsRow
            icon={CreditCard}
            title="Online payment"
            subtitle={methodsUnavailable
              ? failed ? 'Could not verify payment availability. Check again at checkout.' : 'Checking current availability…'
              : availability.onlinePaymentAvailable ? 'Shown only for supported bookings and currencies' : 'Online checkout is not enabled for this account or market'}
            value={methodsUnavailable ? 'Unknown' : availability.onlinePaymentAvailable ? 'Available where eligible' : 'Unavailable'}
          />
          <V3SettingsRow
            icon={Money}
            title="Cash"
            subtitle="Eligibility depends on the booking market and provider. Selecting cash does not confirm payment."
            value="Check booking"
            last
          />
        </V3SettingsCard>

        {methodsUnavailable && !failed && (
          <View style={styles.loading} accessibilityRole="progressbar">
            <ActivityIndicator color={v3.colors.ink} />
          </View>
        )}

        <View style={styles.note}>
          <Text style={styles.noteTitle}>No saved methods</Text>
          <Text style={styles.noteText}>
            MaintainEX does not have a connected saved-card or bank-account manager. Never enter payment details outside an enabled checkout. Your final amount and payment status are shown on the booking.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  content: { paddingHorizontal: 18, paddingBottom: 36 },
  loading: { alignItems: 'center', padding: 16 },
  note: { marginTop: 16, padding: 16, borderRadius: 18, backgroundColor: v3.colors.amberSoft },
  noteTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 14, color: v3.colors.ink },
  noteText: { marginTop: 4, fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 18, color: v3.colors.textSecondary },
})
