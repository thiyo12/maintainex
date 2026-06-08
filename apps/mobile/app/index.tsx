import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { useAuth } from '../lib/auth'
import { LoadingScreen } from '../components/ui/LoadingScreen'

export default function SplashScreen() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (isAuthenticated) {
      if (user?.role === 'ADMIN') router.replace('/(admin)')
      else if (user?.role === 'TASKER' && user?.needsOnboarding) router.replace('/(auth)/onboarding/tasker-services')
      else if (user?.role === 'COMPANY' && user?.needsOnboarding) router.replace('/(auth)/onboarding/company-setup')
      else if (user?.role === 'TASKER') router.replace('/(tasker)')
      else if (user?.role === 'COMPANY') router.replace('/(company)')
      else router.replace('/(customer)')
      return
    }
    const timer = setTimeout(() => router.replace('/(auth)/welcome'), 2000)
    return () => clearTimeout(timer)
  }, [isAuthenticated, isLoading, user])

  return <LoadingScreen />
}
