import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Globe, ShieldCheck, Sparkle } from 'phosphor-react-native'
import Constants from 'expo-constants'
import { v3 } from '../../../../theme/v3/tokens'
import V3PageHeader from '../../../../components/v3/V3PageHeader'
import { V3SectionLabel, V3SettingsCard, V3SettingsRow } from '../../../../components/v3/V3SettingsUI'

export default function AboutScreen() {
  const version = Constants.expoConfig?.version || '1.0.0'
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <V3PageHeader title="About MaintainEX" subtitle="One place to get things done." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brandCard}>
          <Text style={styles.brand}>MΛINTΛINEX</Text>
          <Text style={styles.tagline}>Shine Beyond Expectations.</Text>
          <Text style={styles.version}>Version {version}</Text>
        </View>
        <V3SectionLabel>Platform</V3SectionLabel>
        <V3SettingsCard>
          <V3SettingsRow icon={Sparkle} title="Services" subtitle="Book local professionals for everyday work" />
          <V3SettingsRow icon={Globe} title="Property" subtitle="Daily stays, rentals, sale and land" />
          <V3SettingsRow icon={ShieldCheck} title="Trust & protection" subtitle="Verification, job records and protected payments" last />
        </V3SettingsCard>
      </ScrollView>
    </SafeAreaView>
  )
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  content: { paddingHorizontal: 18, paddingBottom: 36 },
  brandCard: { marginBottom: 20, padding: 22, borderRadius: 22, backgroundColor: v3.colors.ink },
  brand: { fontFamily: 'Outfit_900Black', fontSize: 20, color: v3.colors.paper, letterSpacing: 1 },
  tagline: { marginTop: 8, fontFamily: 'Outfit_500Medium', fontSize: 12, color: '#CFCFCF' },
  version: { marginTop: 18, fontFamily: 'Outfit_700Bold', fontSize: 11, color: v3.colors.amber },
})
