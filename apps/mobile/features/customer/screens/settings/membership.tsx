import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CheckCircle, Crown, Headset, Lightning, Ticket } from 'phosphor-react-native'
import { v3 } from '@/theme/v3/tokens'
import V3PageHeader from '@/components/v3/V3PageHeader'
import { V3SectionLabel, V3SettingsCard, V3SettingsRow } from '@/components/v3/V3SettingsUI'

export default function MembershipScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <V3PageHeader title="Membership" subtitle="More value for frequent bookings." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.badge}><Crown size={17} color={v3.colors.amberDark} weight="fill" /><Text style={styles.badgeText}>MX PLUS</Text></View>
          <Text style={styles.heroTitle}>LKR 1,490 / month</Text>
          <Text style={styles.heroText}>Priority matching · lower service fees · member vouchers</Text>
          <TouchableOpacity activeOpacity={0.8} style={styles.primary}>
            <Text style={styles.primaryText}>Start MX Plus</Text>
          </TouchableOpacity>
        </View>

        <V3SectionLabel>Included</V3SectionLabel>
        <V3SettingsCard>
          <V3SettingsRow icon={Lightning} title="Priority matching" subtitle="Move faster when nearby providers are available" value="Included" />
          <V3SettingsRow icon={CheckCircle} title="Reduced service fee" subtitle="Applies to eligible jobs" value="Eligible" />
          <V3SettingsRow icon={Ticket} title="Member vouchers" subtitle="New monthly member offers" value="Monthly" />
          <V3SettingsRow icon={Headset} title="Priority support" subtitle="Faster support routing" value="Included" last />
        </V3SettingsCard>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  content: { paddingHorizontal: 18, paddingBottom: 36 },
  hero: { marginBottom: 20, padding: 20, borderRadius: 22, backgroundColor: v3.colors.ink },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9, backgroundColor: v3.colors.amberSoft },
  badgeText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 10, color: v3.colors.amberDark, letterSpacing: 0.8 },
  heroTitle: { marginTop: 18, fontFamily: 'Outfit_900Black', fontSize: 26, color: v3.colors.paper },
  heroText: { marginTop: 5, fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 18, color: '#CFCFCF' },
  primary: { marginTop: 18, height: 50, borderRadius: 14, backgroundColor: v3.colors.amber, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 14, color: v3.colors.ink },
})
