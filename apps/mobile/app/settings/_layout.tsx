import { Stack } from 'expo-router'

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="my-profile/index" />
      <Stack.Screen name="edit-profile/index" />
      <Stack.Screen name="notifications/index" />
      <Stack.Screen name="payment/index" />
      <Stack.Screen name="addresses/index" />
      <Stack.Screen name="help/index" />
      <Stack.Screen name="terms/index" />
      <Stack.Screen name="about/index" />
    </Stack>
  )
}
