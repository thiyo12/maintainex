import { Tabs } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { notifications } from '../../../lib/api'
import { v3 } from '../../../theme/v3/tokens'

export default function TabsLayout() {
  const { t } = useTranslation()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let active = true
    const refresh = () => {
      notifications.unreadCount().then(({ count }) => {
        if (active) setUnread(count)
      }).catch(() => {})
    }
    refresh()
    const timer = setInterval(refresh, 60000)
    return () => { active = false; clearInterval(timer) }
  }, [])

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('customer.home') }} />
      <Tabs.Screen name="activity" options={{ title: t('customer.activity') }} />
      <Tabs.Screen name="account" options={{ title: t('customer.account') }} />
    </Tabs>
  )
}
