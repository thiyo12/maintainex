import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../lib/colors'

const tabs = [
  { name: 'index', title: 'Home', icon: '🏠' },
  { name: 'explore', title: 'Explore', icon: '🗺️' },
  { name: 'jobs/new', title: 'Post', icon: '➕' },
  { name: 'inbox', title: 'Chat', icon: '💬' },
  { name: 'settings', title: 'Profile', icon: '👤' },
]

export default function CustomerLayout() {
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 }],
        tabBarActiveTintColor: colors.primary,
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
                <Text style={[styles.tabIcon, focused && { color: colors.primary }]}>
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
    height: 64,
  },
  tabIconWrap: { alignItems: 'center', justifyContent: 'center' },
  tabIconActive: { marginTop: -4 },
  tabIcon: { fontSize: 24 },
})
