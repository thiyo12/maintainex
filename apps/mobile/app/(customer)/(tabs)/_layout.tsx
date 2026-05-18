import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../lib/colors'

const tabs = [
  { name: 'index', title: 'Home', icon: 'home-outline' as const },
  { name: 'explore', title: 'Explore', icon: 'compass-outline' as const },
  { name: 'inbox', title: 'Chat', icon: 'chatbubble-ellipses-outline' as const },
  { name: 'settings', title: 'Profile', icon: 'person-outline' as const },
]

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const bottomPad = Math.max(insets.bottom, 4)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: colors.lightGray,
          height: 56 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
          ...Platform.select({
            ios: { position: 'absolute', bottom: 0, left: 0, right: 0 },
            default: { elevation: 8 },
          }),
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
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
              <Ionicons name={tab.icon} size={22} color={focused ? colors.primary : colors.gray} />
            ),
          }}
        />
      ))}
    </Tabs>
  )
}
