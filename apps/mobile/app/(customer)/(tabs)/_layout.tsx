import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'

const tabConfigs = [
  { name: 'index', key: 'home.browse', icon: 'home-outline' as const },
  { name: 'explore', key: 'customer.explore', icon: 'compass-outline' as const },
  { name: 'inbox', key: 'customer.messages', icon: 'chatbubble-ellipses-outline' as const },
  { name: 'settings', key: 'profile.myProfile', icon: 'person-outline' as const },
]

export default function TabsLayout() {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const bottomPad = Math.max(insets.bottom, 4)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.cream,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 56 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
          ...Platform.select({
            ios: { position: 'absolute', bottom: 0, left: 0, right: 0 },
            default: { elevation: 8 },
          }),
        },
        tabBarActiveTintColor: colors.amber,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.bodyMedium },
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
              <Ionicons name={tab.icon} size={22} color={focused ? colors.amber : colors.muted} />
            ),
          }}
        />
      ))}
    </Tabs>
  )
}
