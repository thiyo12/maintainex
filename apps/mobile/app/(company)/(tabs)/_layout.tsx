import { Tabs } from 'expo-router'
import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import TabIcon from '../../../components/ui/TabIcon'
import { v3 } from '../../../theme/v3/tokens'
import { getActiveCompanyContext } from '@/api/companies'
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
  const [companyRole, setCompanyRole] = useState<string | null>(null)

  useEffect(() => {
    getActiveCompanyContext()
      .then((context) => setCompanyRole(context?.role || null))
      .catch(() => setCompanyRole(null))
  }, [])

  const visibleTabs = new Set(
    companyRole === 'WORKER'
      ? ['dispatch', 'inbox', 'profile']
      : companyRole === 'DISPATCHER'
        ? ['dispatch', 'inbox', 'team', 'profile']
        : companyRole === 'FINANCE'
          ? ['earnings-list', 'team', 'profile']
          : tabConfigs.map((tab) => tab.name)
  )

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: v3.colors.paper,
          borderTopWidth: 1,
          borderTopColor: v3.colors.line,
          height: 78 + bottomPad,
          paddingTop: 11,
          paddingBottom: bottomPad + 8,
          ...Platform.select({
            ios: { position: 'absolute', bottom: 0, left: 0, right: 0 },
            default: { elevation: 0 },
          }),
        },
        tabBarActiveTintColor: v3.colors.ink,
        tabBarInactiveTintColor: v3.colors.textMuted,
        tabBarLabelStyle: { fontSize: 9, lineHeight: 11, fontFamily: 'Outfit_600SemiBold', marginTop: 6, color: v3.colors.textSecondary },
        tabBarShowLabel: true,
      }}
    >
      {tabConfigs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.key),
            tabBarButton: visibleTabs.has(tab.name) ? undefined : () => null,
            tabBarIcon: ({ focused, color }) => (
              <TabIcon icon={tab.icon} focused={focused} activeColor={v3.colors.ink} inactiveColor={String(color)} />
            ),
          }}
        />
      ))}
    </Tabs>
  )
}
