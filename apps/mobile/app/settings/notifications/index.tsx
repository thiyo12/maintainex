import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useColors } from '../../../lib/ThemeContext'
import { useAuth } from '../../../lib/auth'
import { fonts } from '../../../lib/fonts'
import { useTranslation } from 'react-i18next'
import {
  CaretLeft, CaretRight, SignOut, User, Bell, CreditCard,
  MapPin, Question, Info, FileText, Star,
} from 'phosphor-react-native'

const SETTINGS_ICON_MAP: Record<string, React.ComponentType<any>> = {
  'User': User,
  'Bell': Bell,
  'CreditCard': CreditCard,
  'MapPin': MapPin,
  'Question': Question,
  'Info': Info,
  'FileText': FileText,
  'Star': Star,
}

export default function SettingsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const colors = useColors()
  const styles = makeStyles(colors)
  const { user, logout } = useAuth()

  const settingsItems = [
    { icon: 'User', label: t('profile.edit'), route: '/settings/edit-profile' },
    { icon: 'Bell', label: t('profile.notifications'), route: '/notifications' },
    { icon: 'CreditCard', label: t('profile.payment'), route: '/settings/payment' },
    { icon: 'MapPin', label: t('profile.savedAddresses'), route: '/settings/addresses' },
    { icon: 'Question', label: t('profile.helpSupport'), route: '/settings/help' },
    { icon: 'Info', label: t('profile.aboutApp'), route: '/settings/about' },
    { icon: 'FileText', label: t('profile.termsPrivacy'), route: '/settings/terms' },
  ]

  const roleSettings = user?.role === 'COMPANY' ? [{ icon: 'Star', label: t('company.subscription'), route: '/(company)/settings/subscription' }] : []

  const allItems = [...roleSettings, ...settingsItems]

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <CaretLeft size={22} color={colors.ink} weight="bold" />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.ink }]}>{t('settings.title')}</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>{t('profile.account')}</Text>
          {allItems.map((item, i) => {
            const IconComponent = SETTINGS_ICON_MAP[item.icon] || Info
            return (
              <TouchableOpacity
                key={item.label}
                style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                onPress={() => router.push(item.route as any)}
              >
                <View style={[styles.iconWrap, { backgroundColor: colors.amberLight }]}>
                  <IconComponent size={16} color={colors.amberDark} weight="bold" />
                </View>
                <Text style={[styles.rowLabel, { color: colors.ink }]}>{item.label}</Text>
                <CaretRight size={16} color={colors.muted} weight="bold" />
              </TouchableOpacity>
            )
          })}
        </View>

        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: colors.border }]}
          onPress={async () => { await logout(); router.replace('/(auth)/welcome') }}
        >
          <SignOut size={16} color="#EF4444" weight="bold" />
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
