import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import TabIcon from '../../../components/ui/TabIcon'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { SquaresFour, FileText, ChatCircleDots, Flag, Users, CurrencyCircleDollar, User, Truck } from 'phosphor-react-native'

const tabConfigs = [
  { name: 'index', key: 'company.dashboard', icon: SquaresFour },
  { name: 'contracts-list', key: 'company.contracts', icon: FileText },
  { name: 'inbox', key: 'company.inbox', icon: ChatCircleDots },
  { name: 'milestones-list', key: 'company.milestones', icon: Flag },
  { name: 'team', key: 'company.team', icon: Users },
  { name: 'dispatch', key: 'company.workforce.dispatch', icon: Truck },
  { name: 'earnings-list', key: 'company.earnings', icon: CurrencyCircleDollar },
  { name: 'profile', key: 'company.profile', icon: User },
]

export default function CompanyTabs() {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const colors = useColors()
  const bottomPad = Math.max(insets.bottom, 4)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0D0D0D',
          borderTopWidth: 1,
          borderTopColor: '#2E2E2E',
          height: 52 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
          ...Platform.select({
            ios: { position: 'absolute', bottom: 0, left: 0, right: 0 },
            default: { elevation: 8 },
          }),
        },
        tabBarActiveTintColor: '#F5A623',
        tabBarInactiveTintColor: '#6F6B6B',
        tabBarLabelStyle: { fontSize: 9, fontFamily: fonts.bodySemiBold, color: '#6F6B6B' },
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
    </Tabs>
  )
}
