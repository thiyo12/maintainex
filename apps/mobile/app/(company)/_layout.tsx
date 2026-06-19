import { Stack } from 'expo-router'
import { useColors } from '../../lib/ThemeContext'

export default function CompanyLayout() {
  const colors = useColors()
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.cream },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="team/index" options={{ headerShown: true, headerTitle: 'Team', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.cream } }} />
      <Stack.Screen name="team/invite" options={{ headerShown: true, headerTitle: 'Invite Member', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.cream } }} />
      <Stack.Screen name="settings/edit-profile" options={{ headerShown: true, headerTitle: 'Edit Company Profile', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="settings/subscription" options={{ headerShown: true, headerTitle: 'Subscription', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.cream } }} />
    </Stack>
  )
}
