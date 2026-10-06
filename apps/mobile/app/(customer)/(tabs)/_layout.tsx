import { Tabs } from 'expo-router'
import { useTranslation } from 'react-i18next'

export default function TabsLayout() {
  const { t } = useTranslation()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('customer.home') }} />
      <Tabs.Screen name="activity" options={{ title: t('customer.activity') }} />
      <Tabs.Screen name="account" options={{ title: t('customer.account') }} />
    </Tabs>
  )
}
