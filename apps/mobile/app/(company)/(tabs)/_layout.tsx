import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import TabIcon from '../../../components/ui/TabIcon'
import { fonts } from '../../../lib/fonts'
import { House, Truck, Users, ChatCircleDots, User } from 'phosphor-react-native'

const tabConfigs = [
  { name: 'index', key: 'company.dashboard', icon: House },
  { name: 'dispatch', key: 'company.workforce.dispatch', icon: Truck },
  { name: 'team', key: 'company.team', icon: Users },
  { name: 'inbox', key: 'company.inbox', icon: ChatCircleDots },
  { name: 'profile', key: 'company.profile', icon: User },
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
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E5E5',
          height: 52 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
          ...Platform.select({
            ios: { position: 'absolute', bottom: 0, left: 0, right: 0 },
            default: { elevation: 8 },
          }),
        },
        tabBarActiveTintColor: '#F5A623',
        tabBarInactiveTintColor: '#8A8A8A',
        tabBarLabelStyle: { fontSize: 9, fontFamily: fonts.bodySemiBold, color: '#8A8A8A' },
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
              <TabIcon icon={tab.icon} focused={focused} activeColor="#F5A623" />
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
