import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CreditCard, Money } from 'phosphor-react-native'
import V3PageHeader from '@/components/v3/V3PageHeader'
import { V3SectionLabel, V3SettingsCard, V3SettingsRow } from '@/components/v3/V3SettingsUI'
import { v2Payments } from '@/api/v2-payments'
import { v3 } from '@/theme/v3/tokens'

export default function CustomerPaymentSettingsScreen() {
  const [onlineAvailable, setOnlineAvailable] = useState<boolean | null>(null)
  const [availabilityFailed, setAvailabilityFailed] = useState(false)

  useEffect(() => {
    let active = true
    v2Payments.availability()
      .then(result => active && setOnlineAvailable(result.onlinePaymentAvailable))
      .catch(() => active && setAvailabilityFailed(true))
    return () => { active = false }
  }, [])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <V3PageHeader title="Payments" subtitle="See eligible options when you confirm a booking." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <V3SectionLabel>Booking payment options</V3SectionLabel>
        <V3SettingsCard>
          <V3SettingsRow
            icon={CreditCard}
            title="Online checkout"
            subtitle={availabilityFailed
              ? 'Availability could not be checked. Try again from the booking.'
              : onlineAvailable === null
                ? 'Checking current availability…'
                : onlineAvailable
                  ? 'Shown only when the booking market and provider are supported'
                  : 'Not enabled for this deployment'}
            value={availabilityFailed || onlineAvailable === null ? 'Unknown' : onlineAvailable ? 'Where eligible' : 'Unavailable'}
          />
          <V3SettingsRow
            icon={Money}
            title="Cash"
            subtitle="Only offered for eligible Sri Lankan bookings. Choosing cash does not confirm that money was received."
            value="Check booking"
            last
          />
        </V3SettingsCard>
        {onlineAvailable === null && !availabilityFailed && (
          <View style={styles.loading} accessibilityRole="progressbar">
            <ActivityIndicator color={v3.colors.ink} />
          </View>
        )}
        <View style={styles.note}>
          <Text style={styles.noteTitle}>No saved payment methods</Text>
          <Text style={styles.noteText}>
            Saved cards and bank accounts are not connected. Payment, refund and cash-collection status is shown on each booking from its verified record.
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
