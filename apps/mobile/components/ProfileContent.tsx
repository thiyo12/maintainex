import { useRef, useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { useCountry } from '../lib/country'
import { useColors } from '../lib/ThemeContext'
import { getAuthToken } from '../lib/api'
import LanguageSelector from './ui/LanguageSelector'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'

export default function ProfileContent() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const { selectedCountry, countries, setCountry } = useCountry()
  const [identityStatus, setIdentityStatus] = useState<string>('NOT_SUBMITTED')

  function MenuRow({ icon, label, onPress, color }: any) {
    const scale = useRef(new Animated.Value(1)).current
    return (
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, friction: 8, tension: 100, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }).start()}
        onPress={onPress}
      >
        <Animated.View style={[styles.menuRow, { transform: [{ scale }] }]}>
          <View style={[styles.menuIconWrap, { backgroundColor: (color || colors.amber) + '20' }]}>
            <Ionicons name={icon} size={20} color={color || colors.amber} />
          </View>
          <Text style={styles.menuLabel}>{label}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name || 'U')[0]}</Text>
          </View>
          <Text style={styles.name}>{user?.name || 'User'}</Text>
          <Text style={styles.email}>{user?.email || ''}</Text>
          <Text style={styles.phone}>{user?.phone || ''}</Text>
          <TouchableOpacity
            style={[styles.identityBadge, identityStatus === 'APPROVED' ? styles.identityApproved : identityStatus === 'PENDING' ? styles.identityPending : styles.identityUnverified]}
            onPress={() => router.push('/(tasker)/identity')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={identityStatus === 'APPROVED' ? 'shield-checkmark' : identityStatus === 'PENDING' ? 'time' : 'shield-outline'}
              size={14}
              color={identityStatus === 'APPROVED' ? '#059669' : identityStatus === 'PENDING' ? '#D97706' : '#DC2626'}
            />
            <Text style={[styles.identityBadgeText, { color: identityStatus === 'APPROVED' ? '#059669' : identityStatus === 'PENDING' ? '#D97706' : '#DC2626' }]}>
              {identityStatus === 'APPROVED' ? t('verify.status.verified') : identityStatus === 'PENDING' ? t('verify.status.pending') : identityStatus === 'REJECTED' ? t('verify.status.rejected') : t('verify.status.notSubmitted')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <MenuRow icon="person-outline" label={t('profile.title')} color={colors.amber}
            onPress={() => router.push('/settings/my-profile')} />
          <MenuRow icon="create-outline" label={t('profile.edit')} color={colors.amber}
            onPress={() => router.push('/settings/edit-profile')} />
          <MenuRow icon="shield-checkmark-outline" label={t('verify.title')} color="#8B5CF6"
            onPress={() => router.push('/(tasker)/identity')} />
          <MenuRow icon="notifications-outline" label={t('profile.notifications')} color="#F59E0B"
            onPress={() => router.push('/settings/notifications')} />
          <MenuRow icon="card-outline" label={t('profile.payment')} color="#10B981"
            onPress={() => router.push('/settings/payment')} />
          <MenuRow icon="location-outline" label={t('profile.serviceAreas') || 'Addresses'} color="#3B82F6"
            onPress={() => router.push('/settings/addresses')} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Region</Text>
          <MenuRow icon="globe-outline" label={`Country: ${selectedCountry?.name || 'Not set'}`} color="#F59E0B"
            onPress={() => {
              const labels = countries.map(c => c.name)
              Alert.alert('Select Country', '', [
                ...labels.map((name, i) => ({ text: name, onPress: () => setCountry(countries[i].code) })),
                { text: 'Cancel', style: 'cancel' as const },
              ])
            }} />
          <View style={styles.menuRow}>
            <View style={[styles.menuIconWrap, { backgroundColor: colors.amber + '20' }]}>
              <Ionicons name="language-outline" size={20} color={colors.amber} />
            </View>
            <Text style={styles.menuLabel}>Language</Text>
            <LanguageSelector />
          </View>
          <MenuRow icon="swap-horizontal" label="Switch to Work as a Tasker" color="#F59E0B"
            onPress={() => router.push('/(auth)/role-switch?target=TASKER')} />
        </View>

        <View style={styles.section}>
          <MenuRow icon="help-circle-outline" label={t('common.help') || 'Help & support'} color="#8B5CF6"
            onPress={() => router.push('/settings/help')} />
          <MenuRow icon="document-text-outline" label="Terms & privacy" color="#6B7280"
            onPress={() => router.push('/settings/terms')} />
          <MenuRow icon="information-circle-outline" label="About Maintainex" color="#EC4899"
            onPress={() => router.push('/settings/about')} />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={colors.red} />
          <Text style={styles.logoutBtnText}> {t('profile.logout') || 'Log out'}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  profileHeader: { alignItems: 'center', paddingTop: 24, paddingBottom: 24 },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.amber,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: colors.ink },
  name: { fontSize: 22, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  email: { fontSize: 14, color: colors.muted, marginBottom: 2 },
  phone: { fontSize: 14, color: colors.muted, marginBottom: 14 },
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.amber,
    paddingHorizontal: 24, paddingVertical: 8, borderRadius: 20,
  },
  editProfileText: { fontSize: 14, fontWeight: '600', color: colors.amber },
  identityBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20,
    marginBottom: 14,
  },
  identityApproved: { backgroundColor: '#D1FAE5' },
  identityPending: { backgroundColor: '#FEF3C7' },
  identityUnverified: { backgroundColor: '#FEE2E2' },
  identityBadgeText: { fontSize: 13, fontWeight: '600' },
  section: { paddingHorizontal: 24, marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
    padding: 16, borderRadius: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  menuLabel: { fontSize: 15, fontWeight: '600', color: colors.ink, flex: 1 },
  logoutBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginHorizontal: 24, backgroundColor: colors.white, padding: 16,
    borderRadius: 12, borderWidth: 1.5, borderColor: colors.red, marginBottom: 12,
  },
  logoutBtnText: { fontSize: 16, fontWeight: '700', color: colors.red },
  version: { textAlign: 'center', fontSize: 12, color: colors.muted, marginBottom: 32 },
})
