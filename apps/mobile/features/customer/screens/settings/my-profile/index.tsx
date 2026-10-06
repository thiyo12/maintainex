import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CalendarBlank, Envelope, Phone, ShieldCheck, User } from 'phosphor-react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/features/auth/context/auth'
import { v3 } from '@/theme/v3/tokens'
import V3PageHeader from '@/components/v3/V3PageHeader'
import { V3SectionLabel, V3SettingsCard, V3SettingsRow } from '@/components/v3/V3SettingsUI'

export default function MyProfileScreen() {
  const { user } = useAuth()
  const router = useRouter()
  if (!user) return null

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    : '—'
  const initial = (user.name || 'M').trim().charAt(0).toUpperCase()

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <V3PageHeader title="Personal information" subtitle="Keep your account details current." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user.name}</Text>
            <View style={styles.verifiedRow}>
              <ShieldCheck size={14} color={v3.colors.success} weight="fill" />
              <Text style={styles.verifiedText}>Verified mobile</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push('/(customer)/settings/edit-profile' as any)} activeOpacity={0.75} style={styles.editBtn}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <V3SectionLabel>Profile</V3SectionLabel>
        <V3SettingsCard>
          <V3SettingsRow icon={User} title="Full name" subtitle={user.name || 'Not set'} />
          <V3SettingsRow icon={Phone} title="Mobile" subtitle={user.phone || 'Not set'} />
          <V3SettingsRow icon={Envelope} title="Email" subtitle={user.email || 'Not set'} />
          <V3SettingsRow icon={CalendarBlank} title="Member since" subtitle={memberSince} last />
        </V3SettingsCard>

        <View style={styles.privacy}>
          <Text style={styles.privacyTitle}>Privacy first</Text>
          <Text style={styles.privacyText}>Your phone and exact address stay private until a booking or safety workflow needs them.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  content: { paddingHorizontal: 18, paddingBottom: 36 },
  hero: { marginBottom: 20, padding: 16, borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 22, color: v3.colors.paper },
  name: { fontFamily: 'Outfit_800ExtraBold', fontSize: 18, color: v3.colors.ink },
  verifiedRow: { marginTop: 4, flexDirection: 'row', gap: 5, alignItems: 'center' },
  verifiedText: { fontFamily: 'Outfit_500Medium', fontSize: 11.5, color: v3.colors.textSecondary },
  editBtn: { height: 36, paddingHorizontal: 14, borderRadius: 12, backgroundColor: v3.colors.canvas, alignItems: 'center', justifyContent: 'center' },
  editText: { fontFamily: 'Outfit_700Bold', fontSize: 12, color: v3.colors.ink },
  privacy: { marginTop: 16, padding: 16, borderRadius: 18, backgroundColor: v3.colors.amberSoft },
  privacyTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 14, color: v3.colors.ink },
  privacyText: { marginTop: 4, fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 18, color: v3.colors.textSecondary },
})
