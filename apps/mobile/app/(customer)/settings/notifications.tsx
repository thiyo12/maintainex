import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const colors = {
  primary: '#F59E0B',
  purple: '#7C3AED',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  white: '#FFFFFF',
  green: '#10B981',
}

export default function NotificationsScreen() {
  const router = useRouter()
  const [settings, setSettings] = useState({
    jobUpdates: true,
    messages: true,
    quotes: true,
    promotions: false,
    emailNotifications: true,
    smsNotifications: false,
  })

  const toggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.heading}>Notifications</Text>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <Text style={styles.sectionTitle}>Push notifications</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Job updates</Text>
            <Switch value={settings.jobUpdates} onValueChange={() => toggle('jobUpdates')} trackColor={{ false: colors.lightGray, true: colors.purple }} />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Messages</Text>
            <Switch value={settings.messages} onValueChange={() => toggle('messages')} trackColor={{ false: colors.lightGray, true: colors.purple }} />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>New quotes</Text>
            <Switch value={settings.quotes} onValueChange={() => toggle('quotes')} trackColor={{ false: colors.lightGray, true: colors.purple }} />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Promotions & offers</Text>
            <Switch value={settings.promotions} onValueChange={() => toggle('promotions')} trackColor={{ false: colors.lightGray, true: colors.purple }} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Notification channels</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Email notifications</Text>
            <Switch value={settings.emailNotifications} onValueChange={() => toggle('emailNotifications')} trackColor={{ false: colors.lightGray, true: colors.purple }} />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>SMS notifications</Text>
            <Switch value={settings.smsNotifications} onValueChange={() => toggle('smsNotifications')} trackColor={{ false: colors.lightGray, true: colors.purple }} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  backBtn: { paddingHorizontal: 24, paddingTop: 8 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
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
