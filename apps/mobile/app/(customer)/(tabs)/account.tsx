import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Alert, Switch, ActivityIndicator } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import {
  ChatText, User, MapPin, CreditCard, Ticket, Crown, ClipboardText,
  BuildingOffice, Wrench, Question, Info, FileText, Translate,
  SignOut, Trash, CaretRight, Wallet, ShieldCheck, Camera,
} from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../../lib/auth'
import { auth, upload } from '../../../lib/api'
import { colors, spacing, radius, typography, shadows } from '../../../lib/design'
import { tierById } from '../../../lib/tiers'
import { useTheme } from '../../../lib/ThemeContext'

import AvatarCircle from '../../../components/ui/AvatarCircle'
import PressableScale from '../../../components/ui/PressableScale'
import LanguageSelector from '../../../components/ui/LanguageSelector'

function MenuRow({ icon: Icon, label, onPress, color: accent, badge }: any) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.97} style={styles.menuPress}>
      <View style={styles.menuRow}>
        <View style={[styles.menuIconWrap, { backgroundColor: (accent || colors.accent) + '18' }]}>
          <Icon size={20} color={accent || colors.accent} weight="fill" />
        </View>
        <Text style={styles.menuLabel}>{label}</Text>
        {badge != null && badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        <CaretRight size={15} color={colors.textMuted} weight="bold" />
      </View>
    </PressableScale>
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

  const tier = tierById((user as any)?.tierLevel)
  const TierIcon = tier.icon

  const goActivityTab = () => router.push('/(customer)/(tabs)/activity' as any)

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
        {/* ═══ Profile header ═══ */}
        <View style={styles.profileHeader}>
          <PressableScale onPress={pickProfilePhoto} scaleTo={0.97} style={styles.avatarPress}>
            <AvatarCircle uri={(user as any)?.profileImage || (user as any)?.avatar} name={user?.name} size={76} />
            <View style={styles.avatarBadge}>
              {uploadingPhoto ? <ActivityIndicator size="small" color="#111827" /> : <Camera size={14} color="#111827" weight="fill" />}
            </View>
          </PressableScale>
          <Text style={styles.name}>{user?.name || t('profile.userFallback')}</Text>
          <Text style={styles.sub}>{user?.email || ''}</Text>
          {user?.phone ? <Text style={styles.sub}>{user.phone}</Text> : null}
          <Text style={[styles.avatarHint, { color: colors.textMuted }]}>{t('account.tapPhoto')}</Text>
        </View>

        {/* ═══ Membership card ═══ */}
        <PressableScale onPress={() => router.push('/settings/membership')} scaleTo={0.97} style={styles.tierPress}>
          <LinearGradient colors={[tier.color, colors.surfaceHigh]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tierCard}>
            <View style={styles.tierIconBox}>
              <TierIcon size={26} color="#FFFFFF" weight="fill" />
            </View>
            <View style={styles.tierBody}>
              <Text style={styles.tierLabel}>{t('account.currentTier')}</Text>
              <Text style={styles.tierName}>{t(`tiers.${tier.id.toLowerCase()}`)}</Text>
            </View>
            <CaretRight size={18} color="rgba(255,255,255,0.9)" weight="bold" />
          </LinearGradient>
        </PressableScale>

        {/* ═══ My Account ═══ */}
        <SectionLabel label={t('account.myAccount')} />
        <View style={styles.section}>
          <MenuRow icon={ChatText} label={t('account.messages')} color="#2563EB" onPress={() => router.push('/(chat)' as any)} />
          <MenuRow icon={User} label={t('account.personalInfo')} color={colors.accent} onPress={() => router.push('/settings/my-profile')} />
          <MenuRow icon={MapPin} label={t('account.savedAddresses')} color="#3B82F6" onPress={() => router.push('/settings/addresses')} />
          <MenuRow icon={CreditCard} label={t('account.payment')} color="#10B981" onPress={() => router.push('/settings/payment')} />
          <MenuRow icon={Ticket} label={t('account.vouchers')} color="#EC4899" onPress={() => router.push('/settings/vouchers')} />
          <MenuRow icon={Crown} label={t('account.membership')} color={colors.accent} onPress={() => router.push('/settings/membership')} />
        </View>

        {/* ═══ Services ═══ */}
        <SectionLabel label={t('account.services')} />
        <View style={styles.section}>
          <MenuRow icon={ClipboardText} label={t('account.myJobs')} color="#0EA5E9" onPress={goActivityTab} />
          <MenuRow icon={BuildingOffice} label={t('account.realEstate')} color="#8B5CF6" onPress={() => router.push('/real-estate' as any)} />
          <MenuRow icon={Wrench} label={t('account.becomeTasker')} color={colors.accent} onPress={handleBecomeTasker} />
        </View>

        {/* ═══ Support ═══ */}
        <SectionLabel label={t('account.support')} />
        <View style={styles.section}>
          <MenuRow icon={Question} label={t('account.help')} color="#8B5CF6" onPress={() => router.push('/settings/help')} />
          <MenuRow icon={Info} label={t('account.about')} color="#EC4899" onPress={() => router.push('/settings/about')} />
          <MenuRow icon={FileText} label={t('account.terms')} color="#6B7280" onPress={() => router.push('/settings/terms')} />
          <View style={[styles.menuRow, { borderWidth: 1, borderColor: colors.border }]}>
            <View style={[styles.menuIconWrap, { backgroundColor: colors.accent + '18' }]}>
              <Translate size={20} color={colors.accent} weight="fill" />
            </View>
            <Text style={styles.menuLabel}>{t('account.language')}</Text>
            <LanguageSelector />
          </View>
          <View style={[styles.menuRow, { borderWidth: 1, borderColor: colors.border }]}>
            <View style={[styles.menuIconWrap, { backgroundColor: colors.accent + '18' }]}>
              {theme.isDark ? <ShieldCheck size={20} color={colors.accent} weight="fill" /> : <ShieldCheck size={20} color={colors.accent} weight="fill" />}
            </View>
            <Text style={styles.menuLabel}>{t('account.darkMode')}</Text>
            <Switch
              value={theme.isDark}
              onValueChange={() => theme.toggleTheme()}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={theme.isDark ? colors.surfaceHigh : '#FFFFFF'}
            />
          </View>
        </View>

        {/* ═══ Earn with MX (customers only) ═══ */}
        {user?.role === 'CUSTOMER' ? (
          <PressableScale onPress={() => router.push('/wallet/index' as any)} scaleTo={0.97} style={styles.earnPress}>
            <LinearGradient colors={[colors.accent, colors.accentDim]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.earnCard}>
              <View style={styles.earnIconBox}>
                <Wallet size={24} color={colors.background} weight="fill" />
              </View>
              <View style={styles.earnBody}>
                <Text style={styles.earnTitle}>{t('account.earnWithMX')}</Text>
                <Text style={styles.earnSub}>{t('account.earnWithMXSub')}</Text>
              </View>
              <CaretRight size={18} color={colors.background} weight="bold" />
            </LinearGradient>
          </PressableScale>
        ) : null}

        {/* ═══ Danger zone ═══ */}
        <SectionLabel label={t('account.dangerZone')} />
        <PressableScale onPress={handleDelete} scaleTo={0.97} style={styles.dangerPress}>
          <View style={styles.dangerRow}>
            {deleting ? (
              <Text style={styles.dangerText}>{t('common.loading')}</Text>
            ) : (
              <>
                <Trash size={19} color={colors.error} weight="bold" />
                <Text style={styles.dangerText}>{t('account.deleteAccount')}</Text>
              </>
            )}
          </View>
        </PressableScale>
        <PressableScale onPress={handleLogout} scaleTo={0.97} style={styles.dangerPress}>
          <View style={styles.dangerRow}>
            <SignOut size={19} color={colors.error} weight="bold" />
            <Text style={styles.dangerText}>{t('account.logout')}</Text>
          </View>
        </PressableScale>

        <Text style={styles.version}>{t('profile.version', { version: '1.0.0' })}</Text>
      </ScrollView>
    </SafeAreaView>
  )
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing.xl, paddingHorizontal: spacing.md, paddingTop: spacing.sm },

  profileHeader: { alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.lg, gap: 2 },
  avatarPress: { position: 'relative' },
  avatarBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.background,
  },
  avatarHint: { fontSize: 11, marginTop: 6 },
  name: { ...typography.h2, marginTop: spacing.sm },
  sub: { ...typography.bodyMuted, fontSize: 14 },

  tierPress: { borderRadius: radius.lg, ...(shadows as any).card, marginBottom: spacing.md },
  tierCard: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderRadius: radius.lg,
  },
  tierIconBox: {
    width: 52, height: 52, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  tierBody: { flex: 1, marginLeft: spacing.md },
  tierLabel: { fontSize: 13, fontFamily: 'Outfit_500Medium', color: 'rgba(255,255,255,0.85)' },
  tierName: { ...typography.h3, fontSize: 19, color: '#FFFFFF', marginTop: 2 },

  sectionLabel: {
    fontSize: 12, fontFamily: 'Outfit_600SemiBold', textTransform: 'uppercase', letterSpacing: 1,
    color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.md,
  },

  menuPress: { borderRadius: radius.md },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: radius.md,
    backgroundColor: colors.surface, marginBottom: 8,
  },
  menuIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  menuLabel: { fontSize: 15, fontFamily: 'Outfit_500Medium', color: colors.textPrimary, flex: 1 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, marginRight: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  earnPress: { borderRadius: radius.lg, ...(shadows as any).card, marginTop: spacing.lg },
  earnCard: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderRadius: radius.lg,
  },
  earnIconBox: {
    width: 46, height: 46, borderRadius: radius.sm * 1.5, backgroundColor: 'rgba(11,12,18,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  earnBody: { flex: 1, marginLeft: spacing.md },
  earnTitle: { ...typography.h3, fontSize: 17, color: colors.background, fontFamily: 'Outfit_700Bold' },
  earnSub: { ...typography.caption, color: 'rgba(11,12,18,0.7)', marginTop: 2 },

  dangerPress: { borderRadius: radius.md, marginBottom: 8 },
  dangerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 16, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.error + '55',
    backgroundColor: colors.surface, marginBottom: 8,
  },
  dangerText: { fontSize: 16, fontFamily: 'Outfit_600SemiBold', color: colors.error },

  version: { textAlign: 'center', fontSize: 12, fontFamily: 'Outfit_400Regular', color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
})
