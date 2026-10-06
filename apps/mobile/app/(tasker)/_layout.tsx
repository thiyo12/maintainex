import { Stack } from 'expo-router'
import { v3 } from '../../theme/v3/tokens'

export default function TaskerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: v3.colors.canvas },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="readiness" />
      <Stack.Screen name="identity" />
      <Stack.Screen name="settings/edit-profile" />
      <Stack.Screen name="settings/job-selection" />
      <Stack.Screen name="settings/service-area" />
      <Stack.Screen name="settings/availability" />
      <Stack.Screen name="wallet/withdraw" />
      <Stack.Screen name="jobs/v2/browse" />
      <Stack.Screen name="jobs/v2/quote/[id]" />
      <Stack.Screen name="jobs/v2/my-jobs" />
      <Stack.Screen name="jobs/v2/manage/[id]" />
      <Stack.Screen name="jobs/v2/manage/[id]/verify-pin" />
      <Stack.Screen name="jobs/v2/manage/[id]/evidence" />
      <Stack.Screen name="jobs/v2/manage/[id]/inspection" />
      <Stack.Screen name="jobs/v2/manage/[id]/change-order" />
      <Stack.Screen name="jobs/v2/manage/[id]/cancel" />
      <Stack.Screen name="company-assignments" />
    </Stack>
  )
}
