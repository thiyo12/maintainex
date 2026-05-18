import { Stack } from 'expo-router'
import { colors } from '../../lib/colors'

export default function CustomerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings/index" options={{ headerShown: true, headerTitle: 'Profile', headerBackTitle: 'Back', headerTintColor: colors.primary, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="settings/edit-profile" />
      <Stack.Screen name="settings/notifications" />
      <Stack.Screen name="jobs/new" />
      <Stack.Screen name="jobs/posted-confirm" />
      <Stack.Screen name="jobs/quotes" />
      <Stack.Screen name="booking/confirm" />
      <Stack.Screen name="booking/confirmed" />
      <Stack.Screen name="tracking/[id]" />
      <Stack.Screen name="jobs/complete/[id]" />
      <Stack.Screen name="jobs/receipt/[id]" />
      <Stack.Screen name="jobs/review/[id]" />
      <Stack.Screen name="jobs/dispute/[id]" />
      <Stack.Screen name="find/index" options={{ headerShown: true, headerTitle: 'Find a Tasker', headerBackTitle: 'Back', headerTintColor: colors.primary, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="find/[categoryId]" options={{ headerShown: true, headerTitle: 'Services', headerBackTitle: 'Back', headerTintColor: colors.primary, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="find/job/[jobId]" options={{ headerShown: true, headerTitle: 'Service Details', headerBackTitle: 'Back', headerTintColor: colors.primary, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="find/taskers/[jobId]" options={{ headerShown: true, headerTitle: 'Available Taskers', headerBackTitle: 'Back', headerTintColor: colors.primary, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="find/tasker-profile/[taskerId]" options={{ headerShown: true, headerTitle: 'Tasker Profile', headerBackTitle: 'Back', headerTintColor: colors.primary, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="find/booking/[jobId]" options={{ headerShown: true, headerTitle: 'Quick Booking', headerBackTitle: 'Back', headerTintColor: colors.primary, headerStyle: { backgroundColor: colors.white } }} />
    </Stack>
  )
}
