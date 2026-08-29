import { useRef, useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, Alert, Switch } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { User, PencilSimple, ShieldCheck, Bell, CreditCard, MapPin, Globe, Translate, ArrowsLeftRight, Question, FileText, Info, SignOut, CaretRight, Clock, Shield, Sun, Moon, ChatText } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { useCountry } from '../lib/country'
import { useColors, useTheme } from '../lib/ThemeContext'
import { fonts } from '../lib/fonts'
import { getAuthToken, notifications } from '../lib/api'
import LanguageSelector from './ui/LanguageSelector'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'

export default function ProfileContent() {
  const colors = useColors()
  const theme = useTheme()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const { selectedCountry, countries, setCountry } = useCountry()
  const [identityStatus, setIdentityStatus] = useState<string>('NOT_SUBMITTED')
  const [unread, setUnread] = useState(0)

  useFocusEffect(
    useCallback(() => {
      let active = true
      const refresh = () => {
        notifications.unreadCount().then(({ count }) => {
          if (active) setUnread(count)
        }).catch(() => {})
      }
      refresh()
      const timer = setInterval(refresh, 60000)
      return () => { active = false; clearInterval(timer) }
    }, [])
  )

  function MenuRow({ icon: Icon, label, onPress, color: accent, badge }: any) {
    const scale = useRef(new Animated.Value(1)).current
    return (
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, friction: 8, tension: 100, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }).start()}
        onPress={onPress}
      >
        <Animated.View style={[styles.menuRow, { transform: [{ scale }] }]}>
          <View style={[styles.menuIconWrap, { backgroundColor: (accent || colors.amber) + '20' }]}>
            <Icon size={20} color={accent || colors.amber} weight="fill" />
          </View>
          <Text style={[styles.menuLabel, { color: colors.ink }]}>{label}</Text>
          {badge != null && badge > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
          <CaretRight size={16} color={colors.muted} weight="bold" />
        </Animated.View>
      </TouchableOpacity>
    )
  }

  useEffect(() => {
    ;(async () => {
      try {
        const token = await getAuthToken()
        const res = await fetch(`${API_URL}/api/mobile/v2/identity`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setIdentityStatus(data.identityStatus)
        }
      } catch (e) { console.error('Load identity error:', e) }
    })()
  }, [])

  const handleLogout = async () => {
    await logout()
    router.replace('/(auth)/welcome')
  }

  const isDark = theme.isDark

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.amber }]}>
            <Text style={styles.avatarText}>{(user?.name || 'U')[0]}</Text>
          </View>
          <Text style={[styles.name, { color: colors.ink }]}>{user?.name || t('profile.userFallback')}</Text>
          <Text style={[styles.email, { color: colors.muted }]}>{user?.email || ''}</Text>
          <Text style={[styles.phone, { color: colors.muted }]}>{user?.phone || ''}</Text>
          <TouchableOpacity
            style={[styles.identityBadge, identityStatus === 'APPROVED' ? styles.identityApproved : identityStatus === 'PENDING' ? styles.identityPending : styles.identityUnverified]}
            onPress={() => router.push('/(tasker)/identity')}
            activeOpacity={0.7}
          >
            {identityStatus === 'APPROVED' ? (
              <ShieldCheck size={14} color="#059669" weight="fill" />
            ) : identityStatus === 'PENDING' ? (
              <Clock size={14} color="#D97706" weight="fill" />
            ) : (
              <Shield size={14} color="#DC2626" weight="regular" />
            )}
            <Text style={[styles.identityBadgeText, { color: identityStatus === 'APPROVED' ? '#059669' : identityStatus === 'PENDING' ? '#D97706' : '#DC2626' }]}>
              {identityStatus === 'APPROVED' ? t('verify.status.verified') : identityStatus === 'PENDING' ? t('verify.status.pending') : identityStatus === 'REJECTED' ? t('verify.status.rejected') : t('verify.status.notSubmitted')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <MenuRow icon={ChatText} label={t('profile.messages')} color="#2563EB"
            onPress={() => router.push('/(chat)' as any)} />
          <MenuRow icon={User} label={t('profile.myProfile')} color={colors.amber}
            onPress={() => router.push('/settings/my-profile')} />
          <MenuRow icon={PencilSimple} label={t('profile.edit')} color={colors.amber}
            onPress={() => router.push('/settings/edit-profile')} />
          <MenuRow icon={ShieldCheck} label={t('verify.title')} color="#8B5CF6"
            onPress={() => router.push('/(tasker)/identity')} />
          <MenuRow icon={Bell} label={t('profile.notifications')} color="#F59E0B" badge={unread}
            onPress={() => router.push('/notifications')} />
          <MenuRow icon={CreditCard} label={t('profile.payment')} color="#10B981"
            onPress={() => router.push('/settings/payment')} />
          <MenuRow icon={MapPin} label={t('profile.savedAddresses')} color="#3B82F6"
            onPress={() => router.push('/settings/addresses')} />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>{t('profile.region')}</Text>

          {/* Theme Toggle */}
          <View style={[styles.menuRow, { backgroundColor: colors.white }]}>
            <View style={[styles.menuIconWrap, { backgroundColor: colors.amber + '20' }]}>
              {isDark ? <Moon size={20} color={colors.amber} weight="fill" /> : <Sun size={20} color={colors.amber} weight="fill" />}
            </View>
            <Text style={[styles.menuLabel, { color: colors.ink }]}>{t('profile.darkMode') || 'Dark Mode'}</Text>
            <Switch
              value={isDark}
              onValueChange={() => theme.toggleTheme()}
              trackColor={{ false: colors.border, true: colors.amber }}
              thumbColor={isDark ? '#fff' : '#fff'}
            />
          </View>

          <MenuRow icon={Globe} label={t('profile.countryLabel', { name: selectedCountry?.name || t('profile.notSet') })} color="#F59E0B"
            onPress={() => {
              const labels = countries.map(c => c.name)
              Alert.alert(t('profile.selectCountry'), '', [
                ...labels.map((name, i) => ({ text: name, onPress: () => setCountry(countries[i].code) })),
                { text: t('common.cancel'), style: 'cancel' as const },
              ])
            }} />
          <View style={[styles.menuRow, { backgroundColor: colors.white }]}>
            <View style={[styles.menuIconWrap, { backgroundColor: colors.amber + '20' }]}>
              <Translate size={20} color={colors.amber} weight="fill" />
            </View>
            <Text style={[styles.menuLabel, { color: colors.ink }]}>{t('profile.language')}</Text>
            <LanguageSelector />
          </View>
          <MenuRow icon={ArrowsLeftRight} label={t('profile.switchToTasker')} color="#F59E0B"
            onPress={() => router.push('/(auth)/role-switch?target=TASKER')} />
        </View>

        <View style={styles.section}>
          <MenuRow icon={Question} label={t('profile.helpSupport')} color="#8B5CF6"
            onPress={() => router.push('/settings/help')} />
          <MenuRow icon={FileText} label={t('profile.termsPrivacy')} color="#6B7280"
            onPress={() => router.push('/settings/terms')} />
          <MenuRow icon={Info} label={t('profile.about')} color="#EC4899"
            onPress={() => router.push('/settings/about')} />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <SignOut size={20} color={colors.error} weight="bold" />
          <Text style={styles.logoutBtnText}> {t('profile.logout')}</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: colors.muted }]}>{t('profile.version', { version: '1.0.0' })}</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  profileHeader: { alignItems: 'center', paddingTop: 24, paddingBottom: 24 },
  avatar: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontFamily: fonts.headingBold, color: colors.ink },
  name: { fontSize: 22, fontFamily: fonts.headingBold, marginBottom: 4 },
  email: { fontSize: 14, fontFamily: fonts.body, marginBottom: 2 },
  phone: { fontSize: 14, fontFamily: fonts.body, marginBottom: 14 },
  identityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 14 },
  identityApproved: { backgroundColor: '#D1FAE5' },
  identityPending: { backgroundColor: '#FEF3C7' },
  identityUnverified: { backgroundColor: '#FEE2E2' },
  identityBadgeText: { fontSize: 13, fontFamily: fonts.bodyMedium },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontFamily: fonts.bodySemiBold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  menuIconWrap: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuLabel: { fontSize: 15, fontFamily: fonts.bodyMedium, flex: 1 },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.error,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, marginRight: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  logoutBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginHorizontal: 20, padding: 16, borderRadius: 20,
    borderWidth: 1.5, borderColor: colors.error, marginBottom: 12,
  },
  logoutBtnText: { fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.error },
  version: { textAlign: 'center', fontSize: 12, fontFamily: fonts.body, marginBottom: 32 },
})
