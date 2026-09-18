import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as SecureStore from 'expo-secure-store'
import { Bell, ChatCircle, Gift, House, Megaphone, Wrench } from 'phosphor-react-native'
import { v3 } from '../../../theme/v3/tokens'
import V3PageHeader from '../../../components/v3/V3PageHeader'
import { V3SectionLabel, V3SettingsCard, V3SettingsRow } from '../../../components/v3/V3SettingsUI'

const SETTINGS_KEY = 'notification_settings'
const DEFAULTS = { jobUpdates: true, messages: true, quotes: true, rentalUpdates: true, promotions: true, productUpdates: false }

export default function NotificationsScreen() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState(DEFAULTS)

  useEffect(() => {
    SecureStore.getItemAsync(SETTINGS_KEY)
      .then((stored) => stored && setSettings({ ...DEFAULTS, ...JSON.parse(stored) }))
      .finally(() => setLoading(false))
  }, [])

  const toggle = async (key: keyof typeof DEFAULTS) => {
    const next = { ...settings, [key]: !settings[key] }
    setSettings(next)
    await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(next))
  }

  const control = (key: keyof typeof DEFAULTS) => (
    <Switch
      value={settings[key]}
      onValueChange={() => toggle(key)}
      trackColor={{ false: '#D6D6D6', true: v3.colors.amber }}
      thumbColor={v3.colors.paper}
      ios_backgroundColor="#D6D6D6"
    />
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <V3PageHeader title="Notifications" subtitle="Choose what deserves your attention." />
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={v3.colors.ink} /> : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Bell size={22} color={v3.colors.ink} weight="fill" />
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Important alerts stay on top</Text>
              <Text style={styles.heroText}>Active-job and safety updates remain visually distinct from marketing.</Text>
            </View>
          </View>

          <V3SectionLabel>Bookings & jobs</V3SectionLabel>
          <V3SettingsCard>
            <V3SettingsRow icon={Wrench} title="Quotes & counter offers" subtitle="New quotes and price changes" trailing={control('quotes')} />
            <V3SettingsRow icon={Bell} title="Tasker arrival & live job" subtitle="Status changes and arrival alerts" trailing={control('jobUpdates')} />
            <V3SettingsRow icon={ChatCircle} title="Messages" subtitle="Tasker, company and owner chats" trailing={control('messages')} />
            <V3SettingsRow icon={House} title="Rental booking updates" subtitle="Stay requests and host responses" trailing={control('rentalUpdates')} last />
          </V3SettingsCard>

          <View style={{ height: 18 }} />
          <V3SectionLabel>Offers & product</V3SectionLabel>
          <V3SettingsCard>
            <V3SettingsRow icon={Gift} title="Offers & vouchers" subtitle="Eligible promotions" trailing={control('promotions')} />
            <V3SettingsRow icon={Megaphone} title="Product updates" subtitle="New MaintainEX features" trailing={control('productUpdates')} last />
          </V3SettingsCard>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  content: { paddingHorizontal: 18, paddingBottom: 36 },
  hero: { marginBottom: 20, padding: 16, borderRadius: 18, backgroundColor: v3.colors.amberSoft, flexDirection: 'row', gap: 12, alignItems: 'center' },
  heroTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 14, color: v3.colors.ink },
  heroText: { marginTop: 3, fontFamily: 'Outfit_400Regular', fontSize: 11.5, lineHeight: 16, color: v3.colors.textSecondary },
})
