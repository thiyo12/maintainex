import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  CaretRight, ChatCircle, CreditCard, House, Lifebuoy, MapPin,
  Medal, SignOut, Trash, UserCircle, Buildings,
} from 'phosphor-react-native'
import { useAuth } from '../../../lib/auth'
import { auth, upload } from '../../../lib/api'
import { v2Trust } from '../../../lib/api-v2'
import { v3 } from '../../../theme/v3/tokens'
import V3CustomerBottomNav from '../../../components/v3/V3CustomerBottomNav'

type AccountRowProps = {
  icon: any
  title: string
  subtitle: string
  onPress: () => void
}

function AccountRow({ icon: Icon, title, subtitle, onPress }: AccountRowProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.72} style={styles.row}>
      <View style={styles.rowIcon}>
        <Icon size={20} color={v3.colors.ink} weight="fill" />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <CaretRight size={18} color={v3.colors.textMuted} weight="bold" />
    </TouchableOpacity>
  )
}

export default function AccountScreen() {
  const router = useRouter()
  const { user, logout, refreshUser } = useAuth()
  const [trust, setTrust] = useState<any>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let active = true
    v2Trust.get()
      .then((result) => { if (active) setTrust(result) })
      .catch(() => { if (active) setTrust(null) })
    return () => { active = false }
  }, [])

  const pickProfilePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (permission.status !== 'granted') {
      Alert.alert('Photo access needed', 'Allow photo access to update your profile picture.')
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
    } catch (error: any) {
      Alert.alert('Could not update photo', error?.message || 'Please try again.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete account?',
      'This permanently removes your MaintainEX account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            try {
              await auth.deleteAccount()
              await logout()
              router.replace('/(auth)/welcome')
            } catch (error: any) {
              Alert.alert('Could not delete account', error?.message || 'Please try again.')
            } finally {
              setDeleting(false)
            }
          },
        },
      ],
    )
  }

  const handleLogout = async () => {
    await logout()
    router.replace('/(auth)/welcome')
  }

  const completed = Number(trust?.completedJobs ?? 0)
  const cancelled = Number(trust?.cancelledJobs ?? 0)
  const tierLabel = trust?.level === 'trusted' || trust?.level === 'high'
    ? 'Priority Booker'
    : 'Verified customer'

  const avatarUri = (user as any)?.profileImage || (user as any)?.avatar
  const initial = (user?.name || 'M').trim().charAt(0).toUpperCase()

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>Account</Text>

        <TouchableOpacity onPress={pickProfilePhoto} activeOpacity={0.82} style={styles.profileCard}>
          <View style={styles.avatar}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
            {uploadingPhoto ? (
              <View style={styles.avatarLoading}>
                <ActivityIndicator size="small" color={v3.colors.ink} />
              </View>
            ) : null}
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{user?.name || 'MaintainEX customer'}</Text>
            <Text style={styles.profileMeta}>Customer · Verified mobile</Text>
          </View>
          <CaretRight size={18} color={v3.colors.textMuted} weight="bold" />
        </TouchableOpacity>

        <View style={styles.tierCard}>
          <View style={styles.tierBadge}>
            <Medal size={15} color={v3.colors.amberDark} weight="fill" />
            <Text style={styles.tierBadgeText}>{tierLabel.toUpperCase()}</Text>
          </View>
          <Text style={styles.tierTitle}>{tierLabel}</Text>
          <Text style={styles.tierMeta}>
            {trust ? `${completed} completed · ${cancelled} cancelled` : 'Your booking history and trust status'}
          </Text>
          <TouchableOpacity onPress={() => router.push('/settings/my-profile')} activeOpacity={0.7}>
            <Text style={styles.badgesLink}>View profile ›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listCard}>
          <AccountRow
            icon={UserCircle}
            title="Personal information"
            subtitle="Profile & phone"
            onPress={() => router.push('/settings/my-profile')}
          />
          <AccountRow
            icon={MapPin}
            title="Addresses"
            subtitle="Home and saved locations"
            onPress={() => router.push('/settings/addresses')}
          />
          <AccountRow
            icon={CreditCard}
            title="Payment & wallet"
            subtitle="Cards, vouchers, balance"
            onPress={() => router.push('/(customer)/wallet' as any)}
          />
          <AccountRow
            icon={Medal}
            title="Membership"
            subtitle="Benefits and offers"
            onPress={() => router.push('/settings/membership')}
          />
          <AccountRow
            icon={Buildings}
            title="Property"
            subtitle="Saved stays & your listings"
            onPress={() => router.push('/real-estate' as any)}
          />
          <AccountRow
            icon={ChatCircle}
            title="Messages"
            subtitle="Chats with taskers and owners"
            onPress={() => router.push('/(chat)' as any)}
          />
          <AccountRow
            icon={Lifebuoy}
            title="Help & safety"
            subtitle="Support, disputes, emergency info"
            onPress={() => router.push('/settings/help')}
          />
        </View>

        <View style={styles.secondaryCard}>
          <AccountRow
            icon={House}
            title="Switch to tasker"
            subtitle="Offer services with MaintainEX"
            onPress={() => router.push('/(auth)/role-switch?target=TASKER' as any)}
          />
          <TouchableOpacity onPress={handleLogout} activeOpacity={0.7} style={styles.secondaryAction}>
            <SignOut size={18} color={v3.colors.ink} weight="bold" />
            <Text style={styles.secondaryText}>Sign out</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} activeOpacity={0.7} style={styles.secondaryAction}>
            {deleting ? (
              <ActivityIndicator size="small" color={v3.colors.error} />
            ) : (
              <Trash size={18} color={v3.colors.error} weight="bold" />
            )}
            <Text style={styles.deleteText}>Delete account</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 106 }} />
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
  scroll: { paddingHorizontal: 18, paddingTop: 8 },
  pageTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 28,
    color: v3.colors.ink,
    marginBottom: 18,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: v3.colors.paper,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: v3.colors.line,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: v3.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 58, height: 58 },
  avatarText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 24,
    color: v3.colors.paper,
  },
  avatarLoading: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCopy: { flex: 1, marginLeft: 14 },
  name: { fontFamily: 'Outfit_800ExtraBold', fontSize: 20, color: v3.colors.ink },
  profileMeta: {
    marginTop: 3,
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: v3.colors.textSecondary,
  },
  tierCard: {
    marginTop: 12,
    padding: 18,
    borderRadius: 20,
    backgroundColor: v3.colors.amberSoft,
    borderWidth: 1,
    borderColor: '#F3D89E',
  },
  tierBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: v3.colors.paper,
  },
  tierBadgeText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 10,
    letterSpacing: 0.6,
    color: v3.colors.amberDark,
  },
  tierTitle: {
    marginTop: 12,
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 18,
    color: v3.colors.ink,
  },
  tierMeta: {
    marginTop: 3,
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: v3.colors.textSecondary,
  },
  badgesLink: {
    marginTop: 10,
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: v3.colors.ink,
  },
  listCard: {
    marginTop: 16,
    backgroundColor: v3.colors.paper,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: v3.colors.line,
    overflow: 'hidden',
  },
  row: {
    minHeight: 72,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: v3.colors.line,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: v3.colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowCopy: { flex: 1 },
  rowTitle: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: v3.colors.ink },
  rowSubtitle: {
    marginTop: 2,
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: v3.colors.textSecondary,
  },
  secondaryCard: {
    marginTop: 16,
    backgroundColor: v3.colors.paper,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: v3.colors.line,
    overflow: 'hidden',
  },
  secondaryAction: {
    minHeight: 54,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: v3.colors.line,
  },
  secondaryText: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: v3.colors.ink },
  deleteText: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: v3.colors.error },
})
