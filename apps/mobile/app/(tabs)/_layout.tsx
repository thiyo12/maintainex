import { useRouter, usePathname, Slot } from 'expo-router'
import { SafeAreaView, StyleSheet } from 'react-native'
import { useAuth } from '../../lib/auth'
import BottomNav from '../../components/shared/BottomNav'

export default function TabLayout() {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  const role = (user?.role === 'COMPANY' ? 'company' : 'tasker') as 'tasker' | 'company'

  const getActiveTab = () => {
    if (pathname.startsWith('/home')) return 'home'
    if (pathname.startsWith('/find') || pathname.startsWith('/explore')) return 'explore'
    if (pathname.startsWith('/jobs')) return 'jobs'
    if (pathname.startsWith('/chat')) return 'chat'
    if (pathname.startsWith('/profile') || pathname.startsWith('/settings/my-profile')) return 'profile'
    if (pathname.startsWith('/company') || pathname.startsWith('/team')) return 'company'
    return 'home'
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Slot />
      <BottomNav
        role={role}
        active={getActiveTab()}
        onPress={(tab) => {
          if (tab === 'post') { router.push('/post-job'); return }
          const routes: Record<string, string> = {
            home: '/(tabs)/home',
            explore: '/(tabs)/find/index',
            jobs: '/(tabs)/jobs/index',
            chat: '/(tabs)/chat/index',
            profile: '/settings/my-profile',
            company: '/(company)/team',
          }
          router.push(routes[tab] as any)
        }}
        unreadMessages={0}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
})
