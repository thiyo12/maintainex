import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import TabIcon from '../../../components/ui/TabIcon'
import { colors } from '../../../lib/design'

const tabConfigs = [
  { name: 'index', key: 'tasker.browse', icon: 'compass-outline' as const },
  { name: 'my-jobs', key: 'tasker.myJobs', icon: 'briefcase-outline' as const },
  { name: 'profile', key: 'tasker.profile', icon: 'person-outline' as const },
]

export default function TaskerTabs() {
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
      <Tabs.Screen name="earnings" options={{ href: null }} />
    </Tabs>
  )
}
