import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import TabIcon from '../../../components/ui/TabIcon'
import { colors } from '../../../lib/design'
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
  const bottomPad = Math.max(insets.bottom, 4)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 52 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
          ...Platform.select({
            ios: { position: 'absolute', bottom: 0, left: 0, right: 0 },
            default: { elevation: 8 },
          }),
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 9, fontFamily: 'Outfit_600SemiBold', color: colors.textSecondary },
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
              <TabIcon icon={tab.icon} focused={focused} activeColor={colors.accent} />
            ),
          }}
        />
      ))}
    </Tabs>
  )
}
