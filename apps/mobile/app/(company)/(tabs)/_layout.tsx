import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'

const tabs = [
  { name: 'index', title: 'Dashboard', icon: 'grid-outline' as const },
  { name: 'contracts-list', title: 'Contracts', icon: 'document-text-outline' as const },
  { name: 'milestones-list', title: 'Milestones', icon: 'flag-outline' as const },
  { name: 'team', title: 'Team', icon: 'people-outline' as const },
  { name: 'earnings-list', title: 'Earnings', icon: 'cash-outline' as const },
  { name: 'profile', title: 'Profile', icon: 'person-outline' as const },
]

export default function CompanyTabs() {
  const colors = useColors()
  const insets = useSafeAreaInsets()
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
        tabBarActiveTintColor: colors.companyAccent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 10, fontFamily: fonts.bodyMedium, color: colors.ink },
        tabBarShowLabel: true,
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused }) => (
              <Ionicons name={tab.icon} size={20} color={focused ? colors.companyAccent : colors.muted} />
            ),
          }}
        />
      ))}
    </Tabs>
  )
}
