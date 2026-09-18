import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import TabIcon from '../../../components/ui/TabIcon'
import { fonts } from '../../../lib/fonts'
import { House, Briefcase, CurrencyCircleDollar, User } from 'phosphor-react-native'

const tabConfigs = [
  { name: 'index', key: 'tasker.browse', icon: House },
  { name: 'my-jobs', key: 'tasker.myJobs', icon: Briefcase },
  { name: 'earnings', key: 'tasker.earnings', icon: CurrencyCircleDollar },
  { name: 'profile', key: 'tasker.profile', icon: User },
]

export default function TaskerTabs() {
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
          height: 68 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 10,
          ...Platform.select({
            ios: { position: 'absolute', bottom: 0, left: 0, right: 0 },
            default: { elevation: 8 },
          }),
        },
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#8A8A8A',
        tabBarLabelStyle: { fontSize: 9, fontFamily: fonts.bodySemiBold },
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
              <TabIcon icon={tab.icon} focused={focused} activeColor="#000000" inactiveColor="#8A8A8A" />
            ),
          }}
        />
      ))}
    </Tabs>
  )
}
