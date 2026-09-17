import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Alert, Switch, ActivityIndicator } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ChatText, User, MapPin, CreditCard, Ticket, Crown, ClipboardText,
  BuildingOffice, Wrench, Question, Info, FileText, Translate,
  SignOut, Trash, CaretRight, Wallet, ShieldCheck, Camera,
} from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../../lib/auth'
import { auth, upload } from '../../../lib/api'
import { v3 } from '../../../theme/v3/tokens'
import { tierById } from '../../../lib/tiers'
import { useTheme } from '../../../lib/ThemeContext'

import V3CustomerBottomNav from '../../../components/v3/V3CustomerBottomNav'
import V3TierBadge from '../../../components/v3/V3TierBadge'
import AvatarCircle from '../../../components/ui/AvatarCircle'
import LanguageSelector from '../../../components/ui/LanguageSelector'

function MenuRow({ icon: Icon, label, onPress, color: accent, badge }: any) {
  return (
    <View style={styles.menuRow}>
      <View style={[styles.menuIconWrap, { backgroundColor: v3.colors.surfaceGray }]}>
        <Icon size={20} color={accent || v3.colors.ink} weight="fill" />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      {badge != null && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <CaretRight size={14} color={v3.colors.textMuted} weight="bold" />
    </View>
  )
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>
}

export default function AccountScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const theme = useTheme()
  const { user, logout, refreshUser } = useAuth()
  const [deleting, setDeleting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const pickProfilePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('common.error'), t('errors.upload'))
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    })
    if (result.canceled || !result.assets[0]) return
    setUploadingPhoto(true)
    try {
      const { url } = await upload.file(result.assets[0].uri)
      await auth.updateProfile({ profileImage: url })
      await refreshUser()
    } catch {
      Alert.alert(t('common.error'), t('errors.upload'))
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleBecomeTasker = () => {
    Alert.alert(
      t('account.becomeTasker'),
      t('account.becomeTaskerNote'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.continue') as string, onPress: () => router.push('/(auth)/role-switch?target=TASKER' as any) },
      ]
    )
  }

  const handleDelete = () => {
    Alert.alert(
      t('account.deleteAccount'),
      t('account.deleteAccountConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('account.deleteAccount'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            try {
              await auth.deleteAccount()
              await logout()
              router.replace('/(auth)/welcome')
            } catch (e: any) {
              Alert.alert(t('common.error'), e?.message || t('errors.generic'))
            } finally {
              setDeleting(false)
            }
          },
        },
      ]
    )
  }

  const handleLogout = async () => {
    await logout()
    router.replace('/(auth)/welcome')
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* ═══ Profile Header ═══ */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            <AvatarCircle uri={(user as any)?.profileImage || (user as any)?.avatar} name={user?.name} size={76} />
            <View style={styles.avatarBadge}>
              {uploadingPhoto ? <ActivityIndicator size="small" color={v3.colors.ink} /> : <Camera size={14} color={v3.colors.ink} weight="fill" />}
            </View>
          </View>
          <Text style={styles.name}>{user?.name || 'User'}</Text>
          <Text style={styles.sub}>{user?.email || ''}</Text>
          {user?.phone ? <Text style={styles.sub}>{user.phone}</Text> : null}
        </View>

        {/* ═══ Tier Badge ═══ */}
        <View style={styles.tierSection}>
          <V3TierBadge tierLevel={(user as any)?.tierLevel} />
        </View>

        {/* ═══ My Account ═══ */}
        <SectionLabel label="My Account" />
        <View style={styles.section}>
          <MenuRow icon={ChatText} label={t('account.messages')} color={v3.colors.info} onPress={() => router.push('/(chat)' as any)} />
          <MenuRow icon={User} label={t('account.personalInfo')} onPress={() => router.push('/settings/my-profile')} />
          <MenuRow icon={MapPin} label={t('account.savedAddresses')} onPress={() => router.push('/settings/addresses')} />
          <MenuRow icon={CreditCard} label={t('account.payment')} onPress={() => router.push('/settings/payment')} />
          <MenuRow icon={Ticket} label={t('account.vouchers')} onPress={() => router.push('/settings/vouchers')} />
          <MenuRow icon={Crown} label={t('account.membership')} onPress={() => router.push('/settings/membership')} />
        </View>

        {/* ═══ Services ═══ */}
        <SectionLabel label="Services" />
        <View style={styles.section}>
          <MenuRow icon={ClipboardText} label={t('account.myJobs')} onPress={() => router.push('/(customer)/(tabs)/activity' as any)} />
          <MenuRow icon={BuildingOffice} label={t('account.realEstate')} onPress={() => router.push('/real-estate' as any)} />
          <MenuRow icon={Wrench} label={t('account.becomeTasker')} onPress={handleBecomeTasker} />
        </View>

        {/* ═══ Support ═══ */}
        <SectionLabel label="Support" />
        <View style={styles.section}>
          <MenuRow icon={Question} label={t('account.help')} onPress={() => router.push('/settings/help')} />
          <MenuRow icon={Info} label={t('account.about')} onPress={() => router.push('/settings/about')} />
          <MenuRow icon={FileText} label={t('account.terms')} onPress={() => router.push('/settings/terms')} />
          <View style={[styles.menuRow, { borderWidth: 1, borderColor: v3.colors.line }]}>
            <View style={[styles.menuIconWrap, { backgroundColor: v3.colors.surfaceGray }]}>
              <Translate size={20} color={v3.colors.ink} weight="fill" />
            </View>
            <Text style={styles.menuLabel}>{t('account.language')}</Text>
            <LanguageSelector />
          </View>
          <View style={[styles.menuRow, { borderWidth: 1, borderColor: v3.colors.line }]}>
            <View style={[styles.menuIconWrap, { backgroundColor: v3.colors.surfaceGray }]}>
              <ShieldCheck size={20} color={v3.colors.ink} weight="fill" />
            </View>
            <Text style={styles.menuLabel}>{t('account.darkMode')}</Text>
            <Switch
              value={theme.isDark}
              onValueChange={() => theme.toggleTheme()}
              trackColor={{ false: v3.colors.line, true: v3.colors.ink }}
              thumbColor={v3.colors.paper}
            />
          </View>
        </View>

        {/* ═══ Earn with MX ═══ */}
        {user?.role === 'CUSTOMER' ? (
          <View style={styles.earnCard}>
            <View style={styles.earnIconBox}>
              <Wallet size={22} color={v3.colors.paper} weight="fill" />
            </View>
            <View style={styles.earnBody}>
              <Text style={styles.earnTitle}>{t('account.earnWithMX')}</Text>
              <Text style={styles.earnSub}>{t('account.earnWithMXSub')}</Text>
            </View>
            <CaretRight size={16} color={v3.colors.paper} weight="bold" />
          </View>
        ) : null}

        {/* ═══ Danger Zone ═══ */}
        <SectionLabel label="Account" />
        <View style={styles.dangerRow}>
          {deleting ? (
            <Text style={styles.dangerText}>{t('common.loading')}</Text>
          ) : (
            <>
              <Trash size={18} color={v3.colors.error} weight="bold" />
              <Text style={styles.dangerText} onPress={handleDelete}>{t('account.deleteAccount')}</Text>
            </>
          )}
        </View>
        <View style={styles.dangerRow}>
          <SignOut size={18} color={v3.colors.error} weight="bold" />
          <Text style={styles.dangerText} onPress={handleLogout}>{t('account.logout')}</Text>
        </View>

        <Text style={styles.version}>MaintainEX v1.0.0</Text>

        <View style={{ height: 100 }} />
      </ScrollView>

      <V3CustomerBottomNav
        activeTab="account"
        onTabPress={(tab) => {
          if (tab === 'account') return
          if (tab === 'home') router.push('/(customer)/(tabs)' as any)
          else router.push(`/(customer)/(tabs)/${tab}` as any)
        }}
        onPostJob={() => router.push('/(customer)/jobs/v2/create' as any)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  scroll: { paddingBottom: 20, paddingHorizontal: 18, paddingTop: 8 },

  profileHeader: { alignItems: 'center', paddingTop: 8, paddingBottom: 16, gap: 2 },
  avatarWrap: { position: 'relative' },
  avatarBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13,
    backgroundColor: v3.colors.paper, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: v3.colors.canvas,
  },
  name: { fontSize: 24, fontFamily: 'Outfit_900Black', color: v3.colors.textPrimary, marginTop: 8 },
  sub: { fontSize: 13, fontFamily: 'Outfit_500Medium', color: v3.colors.textMuted },

  tierSection: { alignItems: 'center', marginBottom: 16 },

  sectionLabel: {
    fontSize: 11, fontFamily: 'Outfit_700Bold', textTransform: 'uppercase', letterSpacing: 0.8,
    color: v3.colors.textMuted, marginBottom: 8, marginTop: 16,
  },

  section: { gap: 8 },

  menuRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: v3.radius.lg,
    backgroundColor: v3.colors.surfaceWhite, borderWidth: 1, borderColor: v3.colors.line,
  },
  menuIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuLabel: { fontSize: 14, fontFamily: 'Outfit_500Medium', color: v3.colors.textPrimary, flex: 1 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: v3.colors.error, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, marginRight: 4 },
  badgeText: { fontSize: 11, fontFamily: 'Outfit_700Bold', color: v3.colors.paper },

  earnCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: v3.colors.ink, borderRadius: v3.radius.lg,
    padding: 16, marginTop: 16,
  },
  earnIconBox: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  earnBody: { flex: 1, marginLeft: 12 },
  earnTitle: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: v3.colors.paper },
  earnSub: { fontSize: 11, fontFamily: 'Outfit_500Medium', color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  dangerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 14, borderRadius: v3.radius.lg, borderWidth: 1, borderColor: v3.colors.error + '44',
    backgroundColor: v3.colors.surfaceWhite, marginBottom: 8,
  },
  dangerText: { fontSize: 15, fontFamily: 'Outfit_600SemiBold', color: v3.colors.error },

  version: { textAlign: 'center', fontSize: 11, fontFamily: 'Outfit_400Regular', color: v3.colors.textLight, marginTop: 20 },
})
