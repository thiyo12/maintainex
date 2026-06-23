import { Stack } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../lib/ThemeContext'

export default function CompanyLayout() {
  const colors = useColors()
  const { t } = useTranslation()
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.cream },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="team/index" options={{ headerShown: true, headerTitle: t('company.team'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.cream } }} />
      <Stack.Screen name="team/invite" options={{ headerShown: true, headerTitle: t('company.inviteMember'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.cream } }} />
      <Stack.Screen name="settings/edit-profile" options={{ headerShown: true, headerTitle: t('company.editProfile'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="settings/subscription" options={{ headerShown: true, headerTitle: t('company.subscription'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.cream } }} />
    </Stack>
  )
}
