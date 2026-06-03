import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Logo from '../../components/ui/Logo'
import { colors } from '../../lib/colors'
import { fonts } from '../../lib/fonts'

const roles = [
  {
    id: 'CUSTOMER',
    icon: 'person-outline' as const,
    title: 'I need work done',
    subtitle: 'Post jobs, hire taskers & companies',
    bg: '#EFF6FF',
    border: '#3B82F6',
    accent: colors.info as string,
  },
  {
    id: 'TASKER',
    icon: 'construct-outline' as const,
    title: 'I am a tasker',
    subtitle: 'Find jobs & send quotes',
    bg: '#FFF8E6',
    border: colors.amber as string,
    accent: colors.amber as string,
  },
  {
    id: 'COMPANY',
    icon: 'business-outline' as const,
    title: 'We are a company',
    subtitle: 'Manage team & bid on projects',
    bg: '#F5F3FF',
    border: '#8B5CF6',
    accent: colors.company as string,
  },
]

export default function WelcomeScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoWrapper}>
          <Logo size={72} />
        </View>

        <Text style={styles.heading}>Welcome to{'\n'}Maintainex</Text>
        <Text style={styles.subtitle}>
          Choose how you want to use Maintainex
        </Text>

        <View style={styles.cardList}>
          {roles.map((role) => (
            <TouchableOpacity
              key={role.id}
              style={[styles.card, { backgroundColor: role.bg, borderColor: role.border }]}
              onPress={() => router.push({ pathname: '/(auth)/register', params: { role: role.id } })}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: role.accent + '20' }]}>
                <Ionicons name={role.icon} size={22} color={role.accent} />
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: role.accent }]}>{role.title}</Text>
                <Text style={styles.cardSub}>{role.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={role.accent} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.bottom}>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.signIn}>
              Already have an account? <Text style={styles.signInLink}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  logoWrapper: { alignItems: 'center', marginBottom: 8 },
  heading: { fontSize: 32, fontFamily: fonts.heading, color: colors.ink, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, fontFamily: fonts.body, color: colors.muted, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  cardList: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    minHeight: 64,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: fonts.headingBold, marginBottom: 2 },
  cardSub: { fontSize: 12, fontFamily: fonts.body, color: colors.ink, opacity: 0.6 },
  bottom: { alignItems: 'center', marginTop: 40 },
  signIn: { fontSize: 14, fontFamily: fonts.body, color: colors.muted },
  signInLink: { fontFamily: fonts.headingBold, color: colors.amber },
})
