import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import TabIcon from '../../../components/ui/TabIcon'
import { colors, typography } from '../../../lib/design'

const tabConfigs = [
  { name: 'index', key: 'home.browse', icon: 'home-outline' as const },
  { name: 'explore', key: 'customer.explore', icon: 'compass-outline' as const },
  { name: 'inbox', key: 'customer.messages', icon: 'chatbubble-ellipses-outline' as const },
  { name: 'settings', key: 'profile.myProfile', icon: 'person-outline' as const },
]

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const bottomPad = Math.max(insets.bottom, 4)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background,
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
              <TabIcon name={tab.icon} focused={focused} />
            ),
          }}
        />
      ))}
    </Tabs>
  )
}
