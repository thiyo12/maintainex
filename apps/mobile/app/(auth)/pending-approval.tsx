import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Check } from 'phosphor-react-native'
import { useRouter } from 'expo-router'

import { useAuth } from '../../lib/auth'
import { v3 } from '../../theme/v3/tokens'
import AuthShell from '../../components/v3/AuthShell'

export default function PendingApprovalScreen() {
  const router = useRouter()
  const { logout } = useAuth()

  const backToLogin = async () => {
    await logout()
    router.replace('/(auth)/login')
  }

  return (
    <AuthShell bg={v3.colors.paper}>
      <View style={styles.content}>
        <View style={styles.logoDot} />
        <View style={styles.checkCircle}><Check size={28} color={v3.colors.ink} weight="bold" /></View>
        <View style={styles.badge}><Text style={styles.badgeText}>REVIEW IN PROGRESS</Text></View>
        <Text style={styles.title}>We’re checking your details</Text>
        <Text style={styles.body}>You can continue setting up your profile.{`\n`}We’ll notify you as soon as your provider{`\n`}account is approved.</Text>

        <View style={styles.bottom}>
          <TouchableOpacity style={styles.button} onPress={backToLogin} activeOpacity={0.82}>
            <Text style={styles.buttonText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AuthShell>
  )
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 72 },
  logoDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: v3.colors.ink, marginBottom: 58 },
  checkCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: v3.colors.successSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  badge: { minHeight: 26, paddingHorizontal: 12, borderRadius: 13, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 8.5, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.paper, letterSpacing: 0.5 },
  title: { marginTop: 24, fontSize: 24, lineHeight: 29, fontFamily: 'Outfit_900Black', color: v3.colors.ink, textAlign: 'center' },
  body: { marginTop: 12, fontSize: 10.5, lineHeight: 17, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary, textAlign: 'center' },
  bottom: { flex: 1, width: '100%', justifyContent: 'flex-end', paddingBottom: 24 },
  button: { height: 52, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 12.5, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.paper },
})
