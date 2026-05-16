import { Tabs } from 'expo-router'
import { Text, StyleSheet } from 'react-native'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
}

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    home: '📊',
    taskers: '👷',
    bookings: '📋',
    jobs: '📌',
    settings: '⚙️',
  }
  return <Text style={[styles.icon, focused && styles.iconActive]}>{icons[name] || '📄'}</Text>
}

export default function AdminLayout() {
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
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} /> }} />
      <Tabs.Screen name="taskers" options={{ title: 'Taskers', tabBarIcon: ({ focused }) => <TabIcon name="taskers" focused={focused} /> }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings', tabBarIcon: ({ focused }) => <TabIcon name="bookings" focused={focused} /> }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: ({ focused }) => <TabIcon name="jobs" focused={focused} /> }} />
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
