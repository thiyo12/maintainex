import { Stack } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../lib/ThemeContext'

export default function TaskerLayout() {
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
      <Stack.Screen name="settings/edit-profile" options={{ headerShown: true, headerTitle: t('tasker.editProfile'), headerBackTitle: t('common.back'), headerTintColor: colors.amberDark, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/v2/browse" options={{ headerShown: true, headerTitle: t('tasker.browse'), headerBackTitle: t('common.back'), headerTintColor: colors.amberDark, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/v2/quote/[id]" options={{ headerShown: true, headerTitle: t('tasker.submitQuote'), headerBackTitle: t('common.back'), headerTintColor: colors.amberDark, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/v2/my-jobs" options={{ headerShown: true, headerTitle: t('tasker.myJobs'), headerBackTitle: t('common.back'), headerTintColor: colors.amberDark, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/v2/manage/[id]" options={{ headerShown: true, headerTitle: t('tasker.manage'), headerBackTitle: t('common.back'), headerTintColor: colors.amberDark, headerStyle: { backgroundColor: colors.white } }} />
    </Stack>
  )
}
