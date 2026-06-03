import { Stack } from 'expo-router'
import { colors } from '../../lib/colors'

export default function CompanyLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.cream },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings/edit-profile" options={{ headerShown: true, headerTitle: 'Edit Company Profile', headerBackTitle: 'Back', headerTintColor: colors.companyAccent, headerStyle: { backgroundColor: colors.white } }} />
    </Stack>
  )
}
