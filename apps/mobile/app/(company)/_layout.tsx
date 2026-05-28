import { Stack } from 'expo-router'
import { colors } from '../../lib/colors'

export default function CompanyLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings/edit-profile" options={{ headerShown: true, headerTitle: 'Edit Company Profile', headerBackTitle: 'Back', headerTintColor: colors.primary, headerStyle: { backgroundColor: colors.white } }} />
    </Stack>
  )
}
