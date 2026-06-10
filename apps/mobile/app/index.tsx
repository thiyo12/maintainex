import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'expo-router'
import { useAuth } from '../lib/auth'
import { LoadingScreen } from '../components/ui/LoadingScreen'

export default function SplashScreen() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const navigated = useRef(false)
  const animationReady = useRef(false)

  const navigate = useCallback(() => {
    if (navigated.current) return
    if (isLoading) return
    if (!animationReady.current) return
    navigated.current = true
    if (isAuthenticated) {
      if (user?.role === 'TASKER' && user?.needsOnboarding) router.replace('/(auth)/onboarding/tasker-services')
      else if (user?.role === 'COMPANY' && user?.needsOnboarding) router.replace('/(auth)/onboarding/company-setup')
      else if (user?.role === 'TASKER') router.replace('/(tasker)')
      else if (user?.role === 'COMPANY') router.replace('/(company)')
      else router.replace('/(customer)')
    } else {
      router.replace('/(auth)/welcome')
    }
  }, [isAuthenticated, isLoading, user, router])

  useEffect(() => {
    if (!isLoading) navigate()
  }, [isLoading, navigate])

  return <LoadingScreen onDone={() => { animationReady.current = true; navigate() }} />
}
