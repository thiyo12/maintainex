import { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { House, MapPin, Users, ChatCircleDots, User } from 'phosphor-react-native'
import { fonts } from '../../../lib/fonts'
import { v3 } from '../../../theme/v3/tokens'

const tabs = [
  { name: 'index', label: 'Home', Icon: House },
  { name: 'dispatch', label: 'Dispatch', Icon: MapPin },
  { name: 'team', label: 'Team', Icon: Users },
  { name: 'inbox', label: 'Inbox', Icon: ChatCircleDots },
  { name: 'profile', label: 'Profile', Icon: User },
] as const

export default function CompanyTabs() {
  const insets = useSafeAreaInsets()
  const bottom = Math.max(insets.bottom, 0)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 78 + bottom,
          paddingTop: 11,
          paddingBottom: bottom + 8,
          backgroundColor: v3.colors.paper,
          borderTopWidth: 1,
          borderTopColor: v3.colors.line,
          elevation: 0,
        },
        tabBarItemStyle: {
          paddingTop: 0,
        },
        tabBarActiveTintColor: v3.colors.ink,
        tabBarInactiveTintColor: v3.colors.textMuted,
        tabBarLabelStyle: {
          marginTop: 6,
          fontSize: 9,
          lineHeight: 11,
          fontFamily: fonts.bodySemiBold,
        },
        tabBarShowLabel: true,
      }}
    >
      {tabs.map(({ name, label, Icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: label,
            tabBarIcon: ({ color, focused }) => (
              <Icon size={18} color={color} weight={focused ? 'bold' : 'regular'} />
            ),
          }}
        />
      ))}
      <Tabs.Screen name="contracts-list" options={{ href: null }} />
      <Tabs.Screen name="milestones-list" options={{ href: null }} />
      <Tabs.Screen name="earnings-list" options={{ href: null }} />
    </Tabs>
  )
}
