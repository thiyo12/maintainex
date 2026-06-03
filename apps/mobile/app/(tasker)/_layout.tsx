import { Stack } from 'expo-router'
import { colors } from '../../lib/colors'

export default function TaskerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings/edit-profile" options={{ headerShown: true, headerTitle: 'Edit Profile', headerBackTitle: 'Back', headerTintColor: colors.primary, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/v2/browse" options={{ headerShown: true, headerTitle: 'Open Jobs', headerBackTitle: 'Back', headerTintColor: colors.primary, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/v2/quote/[id]" options={{ headerShown: true, headerTitle: 'Submit Quote', headerBackTitle: 'Back', headerTintColor: colors.primary, headerStyle: { backgroundColor: colors.white } }} />
    </Stack>
  )
}
