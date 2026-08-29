import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../../lib/ThemeContext'
import { useAuth } from '../../../lib/auth'
import { fonts } from '../../../lib/fonts'
import { useTranslation } from 'react-i18next'

export default function SettingsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const colors = useColors()
  const styles = makeStyles(colors)
  const { user, logout } = useAuth()

  const settingsItems = [
    { icon: 'person-outline', label: t('profile.edit'), route: '/settings/edit-profile' },
    { icon: 'notifications-outline', label: t('profile.notifications'), route: '/notifications' },
    { icon: 'card-outline', label: t('profile.payment'), route: '/settings/payment' },
    { icon: 'location-outline', label: t('profile.savedAddresses'), route: '/settings/addresses' },
    { icon: 'help-circle-outline', label: t('profile.helpSupport'), route: '/settings/help' },
    { icon: 'information-circle-outline', label: t('profile.aboutApp'), route: '/settings/about' },
    { icon: 'document-text-outline', label: t('profile.termsPrivacy'), route: '/settings/terms' },
  ]

  const roleSettings = user?.role === 'COMPANY' ? [{ icon: 'star-outline', label: t('company.subscription'), route: '/(company)/settings/subscription' }] : []

  const allItems = [...roleSettings, ...settingsItems]

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.ink }]}>{t('settings.title')}</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>{t('profile.account')}</Text>
          {allItems.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
              onPress={() => router.push(item.route as any)}
            >
              <View style={[styles.iconWrap, { backgroundColor: colors.amberLight }]}>
                <Ionicons name={item.icon as any} size={16} color={colors.amberDark} />
              </View>
              <Text style={[styles.rowLabel, { color: colors.ink }]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: colors.border }]}
          onPress={async () => { await logout(); router.replace('/(auth)/welcome') }}
        >
          <Ionicons name="log-out-outline" size={16} color="#EF4444" />
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 17, fontFamily: fonts.headingBold },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontFamily: fonts.headingBold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingHorizontal: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, gap: 12,
  },
  iconWrap: {
    width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  rowLabel: { flex: 1, fontSize: 14, fontFamily: fonts.bodyMedium },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 12, borderWidth: 1, marginTop: 8,
  },
  logoutText: { fontSize: 14, fontFamily: fonts.headingBold, color: '#EF4444' },
})
