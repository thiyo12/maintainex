import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as SecureStore from 'expo-secure-store'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'

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
  const { t } = useTranslation()
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
      <Text style={styles.heading}>{t('settings.notifications')}</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#F5A623" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <Text style={styles.sectionTitle}>{t('settings.notifications')}</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>{t('settings.jobUpdates')}</Text>
              <Switch value={settings.jobUpdates} onValueChange={() => toggle('jobUpdates')} trackColor={{ false: '#2E2E2E', true: '#F5A623' }} />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{t('settings.messages')}</Text>
              <Switch value={settings.messages} onValueChange={() => toggle('messages')} trackColor={{ false: '#2E2E2E', true: '#F5A623' }} />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{t('settings.quotes')}</Text>
              <Switch value={settings.quotes} onValueChange={() => toggle('quotes')} trackColor={{ false: '#2E2E2E', true: '#F5A623' }} />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{t('settings.promotions')}</Text>
              <Switch value={settings.promotions} onValueChange={() => toggle('promotions')} trackColor={{ false: '#2E2E2E', true: '#F5A623' }} />
            </View>
          </View>

          <Text style={styles.sectionTitle}>{t('settings.notifications')}</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>{t('profile.email')}</Text>
              <Switch value={settings.emailNotifications} onValueChange={() => toggle('emailNotifications')} trackColor={{ false: '#2E2E2E', true: '#F5A623' }} />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{t('profile.phone')}</Text>
              <Switch value={settings.smsNotifications} onValueChange={() => toggle('smsNotifications')} trackColor={{ false: '#2E2E2E', true: '#F5A623' }} />
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  heading: { fontSize: 28, fontFamily: 'Outfit_900Black', color: '#FFFFFF', paddingHorizontal: 24, marginBottom: 16 },
  scroll: { paddingHorizontal: 24 },
  sectionTitle: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: '#6F6B6B', marginBottom: 10, marginTop: 8, textTransform: 'uppercase' },
  card: {
    backgroundColor: '#FFFFFF',
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
    borderBottomColor: '#2E2E2E',
  },
  label: { fontSize: 15, fontFamily: 'Outfit_600SemiBold', color: '#FFFFFF' },
})
