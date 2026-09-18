import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChatCircle, CreditCard, House, Lifebuoy, ShieldWarning, UserCircle, Wrench } from 'phosphor-react-native'
import { v3 } from '../../../../theme/v3/tokens'
import V3PageHeader from '../../../../components/v3/V3PageHeader'
import { V3SectionLabel, V3SettingsCard, V3SettingsRow } from '../../../../components/v3/V3SettingsUI'
import { useRouter } from 'expo-router'

export default function HelpScreen() {
  const router = useRouter()
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <V3PageHeader title="Help" subtitle="Choose a topic or contact MaintainEX support." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Lifebuoy size={24} color={v3.colors.ink} weight="fill" />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>How can we help?</Text>
            <Text style={styles.heroText}>Start with the area that best matches your issue.</Text>
          </View>
        </View>

        <V3SectionLabel>Support topics</V3SectionLabel>
        <V3SettingsCard>
          <V3SettingsRow icon={Wrench} title="Jobs & taskers" subtitle="Booking, quotes and cancellations" onPress={() => router.push('/(customer)/(tabs)/activity' as any)} />
          <V3SettingsRow icon={CreditCard} title="Payments & refunds" subtitle="Escrow, cards and wallet" onPress={() => router.push('/(customer)/wallet' as any)} />
          <V3SettingsRow icon={House} title="Property & rentals" subtitle="Bookings, hosts and listings" onPress={() => router.push('/real-estate' as any)} />
          <V3SettingsRow icon={ShieldWarning} title="Safety & disputes" subtitle="Report an issue or payment dispute" onPress={() => router.push('/(customer)/(tabs)/activity' as any)} />
          <V3SettingsRow icon={UserCircle} title="Account & verification" subtitle="Login, identity and privacy" onPress={() => router.push('/(customer)/settings/my-profile' as any)} />
          <V3SettingsRow icon={ChatCircle} title="Contact MaintainEX" subtitle="Email support" onPress={() => Linking.openURL('mailto:support@maintainex.lk')} last />
        </V3SettingsCard>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  content: { paddingHorizontal: 18, paddingBottom: 36 },
  hero: { marginBottom: 20, padding: 16, borderRadius: 18, backgroundColor: v3.colors.amberSoft, flexDirection: 'row', gap: 12, alignItems: 'center' },
  heroTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 16, color: v3.colors.ink },
  heroText: { marginTop: 3, fontFamily: 'Outfit_400Regular', fontSize: 11.5, color: v3.colors.textSecondary },
})
