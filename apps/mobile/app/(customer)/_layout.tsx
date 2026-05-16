import { Tabs } from 'expo-router'
import { Text, View, StyleSheet } from 'react-native'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
}

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    home: '🏠',
    browse: '🔍',
    jobs: '📋',
    profile: '👤',
  }
  return (
    <View style={[styles.iconContainer, focused && styles.iconFocused]}>
      <Text style={[styles.icon, focused && styles.iconActive]}>{icons[name] || '📄'}</Text>
    </View>
  )
}

export default function CustomerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: true,
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
        name="browse"
        options={{
          title: 'Services',
          tabBarIcon: ({ focused }) => <TabIcon name="browse" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'My Jobs',
          tabBarIcon: ({ focused }) => <TabIcon name="jobs" focused={focused} />,
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
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  iconContainer: {
    width: 40,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFocused: {},
  icon: { fontSize: 22 },
  iconActive: {},
})
