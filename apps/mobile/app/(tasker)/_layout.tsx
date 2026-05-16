import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
}

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    home: '🏠',
    jobs: '📋',
    earnings: '💰',
    profile: '👤',
  }
  return <Text style={[styles.icon, focused && styles.iconActive]}>{icons[name] || '📄'}</Text>
}

export default function TaskerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveTintColor: colors.dark,
        tabBarInactiveTintColor: colors.gray,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ focused }) => <TabIcon name="jobs" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ focused }) => <TabIcon name="earnings" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    paddingTop: 8,
    paddingBottom: 24,
    height: 80,
  },
  tabLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  icon: { fontSize: 22 },
  iconActive: {},
})
