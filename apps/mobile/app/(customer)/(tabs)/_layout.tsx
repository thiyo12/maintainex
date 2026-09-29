import { Tabs } from 'expo-router'
import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { House, ClockCounterClockwise, Bell, User } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import TabIcon from '../../../components/ui/TabIcon'
import { notifications } from '@/api/notifications'
import { colors, typography } from '../../../lib/design'

const tabConfigs = [
  { name: 'index', key: 'customer.home', tabIcon: House },
  { name: 'activity', key: 'customer.activity', tabIcon: ClockCounterClockwise },
  { name: 'notifications', key: 'customer.notifications', tabIcon: Bell, badge: true },
  { name: 'account', key: 'customer.account', tabIcon: User },
]

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const bottomPad = Math.max(insets.bottom, 4)
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
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 60 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
          ...Platform.select({
            ios: { position: 'absolute', bottom: 0, left: 0, right: 0 },
            default: { elevation: 8 },
          }),
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: colors.textSecondary },
        tabBarShowLabel: true,
      }}
    >
      {tabConfigs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.key),
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={tab.tabIcon} focused={focused} badge={tab.badge ? unread : 0} />
            ),
          }}
        />
      ))}
    </Tabs>
  )
}