import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as SecureStore from 'expo-secure-store'
import { useColors } from '../../../lib/ThemeContext'

const SETTINGS_KEY = 'notification_settings'

const DEFAULTS = {
  jobUpdates: true,
  messages: true,
  quotes: true,
  promotions: false,
  emailNotifications: true,
  smsNotifications: false,
}

export default function NotificationsScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState(DEFAULTS)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const stored = await SecureStore.getItemAsync(SETTINGS_KEY)
      if (stored) setSettings({ ...DEFAULTS, ...JSON.parse(stored) })
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const toggle = async (key: keyof typeof DEFAULTS) => {
    const next = { ...settings, [key]: !settings[key] }
    setSettings(next)
    await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(next))
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Notifications</Text>

      {loading ? (
        <ActivityIndicator size="large" color={colors.customerAccent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <Text style={styles.sectionTitle}>Push notifications</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Job updates</Text>
              <Switch value={settings.jobUpdates} onValueChange={() => toggle('jobUpdates')} trackColor={{ false: colors.lightGray, true: colors.customerAccent }} />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Messages</Text>
              <Switch value={settings.messages} onValueChange={() => toggle('messages')} trackColor={{ false: colors.lightGray, true: colors.customerAccent }} />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>New quotes</Text>
              <Switch value={settings.quotes} onValueChange={() => toggle('quotes')} trackColor={{ false: colors.lightGray, true: colors.customerAccent }} />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Promotions & offers</Text>
              <Switch value={settings.promotions} onValueChange={() => toggle('promotions')} trackColor={{ false: colors.lightGray, true: colors.customerAccent }} />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Notification channels</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Email notifications</Text>
              <Switch value={settings.emailNotifications} onValueChange={() => toggle('emailNotifications')} trackColor={{ false: colors.lightGray, true: colors.customerAccent }} />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>SMS notifications</Text>
              <Switch value={settings.smsNotifications} onValueChange={() => toggle('smsNotifications')} trackColor={{ false: colors.lightGray, true: colors.customerAccent }} />
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark, paddingHorizontal: 24, marginBottom: 16 },
  scroll: { paddingHorizontal: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.gray, marginBottom: 10, marginTop: 8, textTransform: 'uppercase' },
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  label: { fontSize: 15, fontWeight: '600', color: colors.dark },
})
