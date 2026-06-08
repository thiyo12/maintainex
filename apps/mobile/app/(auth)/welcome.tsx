import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Logo from '../../components/ui/Logo'
import { useColors } from '../../lib/ThemeContext'
import { fonts, fontSizes } from '../../lib/fonts'
import { spacing, borderRadius } from '../../lib/tokens'

const roles = [
  {
    id: 'CUSTOMER',
    icon: 'person-outline' as const,
    title: 'I need work done',
    subtitle: 'Post jobs, hire taskers & companies',
    bg: '#EFF6FF',
    border: '#3B82F6',
    accent: '#3B82F6',
  },
  {
    id: 'TASKER',
    icon: 'construct-outline' as const,
    title: 'I am a tasker',
    subtitle: 'Find jobs & send quotes',
    bg: '#FFFBEB',
    border: '#F59E0B',
    accent: '#F59E0B',
  },
  {
    id: 'COMPANY',
    icon: 'business-outline' as const,
    title: 'We are a company',
    subtitle: 'Manage team & bid on projects',
    bg: '#F5F3FF',
    border: '#8B5CF6',
    accent: '#8B5CF6',
  },
]

export default function WelcomeScreen() {
  const colors = useColors()
  const router = useRouter()

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.logoWrapper}>
          <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
            <Ionicons name="briefcase" size={28} color="#111" />
          </View>
        </View>

        <Text style={[styles.heading, { color: colors.ink }]}>Welcome to{'\n'}Maintainex</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
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
                <Text style={[styles.cardSub, { color: colors.ink }]}>{role.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={role.accent} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.bottom}>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={[styles.signIn, { color: colors.muted }]}>
              Already have an account? <Text style={[styles.signInLink, { color: colors.primary }]}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: spacing.xxl, justifyContent: 'center' },
  logoWrapper: { alignItems: 'center', marginBottom: spacing.md },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { fontSize: fontSizes.h1, fontFamily: fonts.heading, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { fontSize: fontSizes.bodySmall, fontFamily: fonts.body, textAlign: 'center', marginBottom: spacing.xxxl, lineHeight: 22 },
  cardList: { gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    minHeight: 64,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: fontSizes.bodySmall, fontFamily: fonts.bodyMedium, marginBottom: spacing.xxs },
  cardSub: { fontSize: fontSizes.captionSmall, fontFamily: fonts.body, opacity: 0.6 },
  bottom: { alignItems: 'center', marginTop: spacing.xxxxl },
  signIn: { fontSize: fontSizes.bodySmall, fontFamily: fonts.body },
  signInLink: { fontFamily: fonts.label },
})
