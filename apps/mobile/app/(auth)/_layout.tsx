import { Stack } from 'expo-router'

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="onboarding/tasker-services" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="onboarding/company-setup" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  )
}
