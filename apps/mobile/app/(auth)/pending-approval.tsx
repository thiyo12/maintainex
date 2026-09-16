import { View, Text, StyleSheet, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { v3 } from '../../theme/v3/tokens'
import AuthShell from '../../components/v3/AuthShell'
import V3NavBar from '../../components/v3/V3NavBar'
import V3ListRow from '../../components/v3/V3ListRow'
import V3Button from '../../components/v3/V3Button'

export default function PendingApprovalScreen() {
  const router = useRouter()
  const { logout } = useAuth()

  const handleBackToLogin = async () => {
    await logout()
    router.replace('/(auth)/login')
  }

  const steps = [
    { title: 'Identity verification', subtitle: 'We check your ID and background.' },
    { title: 'Skills & experience check', subtitle: 'We review your qualifications.' },
    { title: 'Profile quality review', subtitle: 'We ensure your profile is complete.' },
  ]

  return (
    <AuthShell bg={v3.colors.paper}>
      <V3NavBar title="Approval pending" onBack={() => router.back()} />

      <View style={styles.content}>
        <Text style={styles.title}>Your account is under review</Text>
        <Text style={styles.subtitle}>
          We are verifying your identity and experience.
        </Text>

        <View style={styles.steps}>
          {steps.map((step, i) => (
            <V3ListRow
              key={i}
              number={i + 1}
              title={step.title}
              subtitle={step.subtitle}
            />
          ))}
        </View>

        <View style={styles.bottom}>
          <V3Button
            label="Back to login"
            onPress={handleBackToLogin}
            variant="secondary"
          />
        </View>
      </View>
    </AuthShell>
  )
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 18,
    gap: 0,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Outfit_900Black',
    fontWeight: '900',
    color: v3.colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    fontWeight: '600',
    color: v3.colors.textSecondary,
    marginBottom: 24,
  },
  steps: {
    gap: 10,
  },
  bottom: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 16,
  },
})
