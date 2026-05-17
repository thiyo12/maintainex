import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'

const colors = {
  purple: '#7C3AED',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  white: '#FFFFFF',
}

const tabs = [
  { name: 'index', title: 'Home', icon: '🏠' },
  { name: 'explore', title: 'Explore', icon: '🗺️' },
  { name: 'jobs/new', title: 'Post', icon: '➕' },
  { name: 'inbox', title: 'Chat', icon: '💬' },
  { name: 'settings', title: 'Profile', icon: '👤' },
]

export default function CustomerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.purple,
        tabBarInactiveTintColor: colors.gray,
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused }) => (
              <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
                <Text style={[styles.tabIcon, focused && { color: colors.purple }]}>
                  {tab.icon}
                </Text>
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    paddingTop: 6,
    paddingBottom: 24,
    height: 80,
  },
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    marginTop: -8,
  },
  tabIcon: {
    fontSize: 24,
  },
})
