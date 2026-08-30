import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import TabIcon from '../../../components/ui/TabIcon'
import { colors } from '../../../lib/design'

const tabConfigs = [
  { name: 'index', key: 'company.dashboard', icon: 'grid-outline' as const },
  { name: 'contracts-list', key: 'company.contracts', icon: 'document-text-outline' as const },
  { name: 'inbox', key: 'company.inbox', icon: 'chatbubble-ellipses-outline' as const },
  { name: 'milestones-list', key: 'company.milestones', icon: 'flag-outline' as const },
  { name: 'team', key: 'company.team', icon: 'people-outline' as const },
  { name: 'earnings-list', key: 'company.earnings', icon: 'cash-outline' as const },
  { name: 'profile', key: 'company.profile', icon: 'person-outline' as const },
]

export default function CompanyTabs() {
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
          height: 52 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
          ...Platform.select({
            ios: { position: 'absolute', bottom: 0, left: 0, right: 0 },
            default: { elevation: 8 },
          }),
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 9, fontFamily: 'Outfit_600SemiBold', color: colors.textSecondary },
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
              <TabIcon name={tab.icon} focused={focused} activeColor={colors.accent} />
            ),
          }}
        />
      ))}
    </Tabs>
  )
}
