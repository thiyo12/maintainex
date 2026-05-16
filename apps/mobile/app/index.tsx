import { useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../lib/auth'
import { LoadingScreen } from '../components/ui/LoadingScreen'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  background: '#F9FAFB',
  white: '#FFFFFF',
}

export default function SplashScreen() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (isAuthenticated) {
      if (user?.role === 'ADMIN') router.replace('/(admin)')
      else if (user?.role === 'TASKER') router.replace('/(tasker)')
      else router.replace('/(customer)')
    }
  }, [isAuthenticated, isLoading, user])

  if (isLoading) return <LoadingScreen />

  return (
    <View style={styles.container}>
      <View style={styles.logoSection}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>M</Text>
        </View>
        <Text style={styles.title}>Maintainex</Text>
        <Text style={styles.subtitle}>Professional Services at Your Doorstep</Text>
      </View>

      <View style={styles.buttonSection}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={styles.secondaryButtonText}>Create Account</Text>
        </TouchableOpacity>

        <Text style={styles.roleHint}>
          Customer • Tasker • Admin
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 48,
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 40,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.dark,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.dark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray,
    textAlign: 'center',
  },
  buttonSection: {
    gap: 16,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.dark,
  },
  secondaryButton: {
    backgroundColor: colors.white,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.lightGray,
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.dark,
  },
  roleHint: {
    textAlign: 'center',
    color: colors.gray,
    fontSize: 13,
  },
})
