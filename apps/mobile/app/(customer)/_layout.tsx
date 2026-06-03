import { Stack } from 'expo-router'
import { colors } from '../../lib/colors'

export default function CustomerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.cream },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings/my-profile" options={{ headerShown: true, headerTitle: 'My Profile', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="settings/edit-profile" options={{ headerShown: true, headerTitle: 'Edit Profile', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="settings/notifications" options={{ headerShown: true, headerTitle: 'Notifications', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="settings/payment" options={{ headerShown: true, headerTitle: 'Payment Methods', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="settings/addresses" options={{ headerShown: true, headerTitle: 'Saved Addresses', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="settings/help" options={{ headerShown: true, headerTitle: 'Help & Support', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="settings/terms" options={{ headerShown: true, headerTitle: 'Terms & Privacy', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="settings/about" options={{ headerShown: true, headerTitle: 'About', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/new" options={{ headerShown: true, headerTitle: 'Post a Job', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/posted-confirm" options={{ headerShown: true, headerTitle: 'Job Posted', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/quotes" options={{ headerShown: true, headerTitle: 'Quotes', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="booking/confirm" options={{ headerShown: true, headerTitle: 'Confirm Booking', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="booking/confirmed" options={{ headerShown: true, headerTitle: 'Booking Confirmed', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="tracking/[id]" options={{ headerShown: true, headerTitle: 'Tracking', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/complete/[id]" options={{ headerShown: true, headerTitle: 'Complete Job', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/receipt/[id]" options={{ headerShown: true, headerTitle: 'Receipt', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/review/[id]" options={{ headerShown: true, headerTitle: 'Review', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/dispute/[id]" options={{ headerShown: true, headerTitle: 'Dispute', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/v2/create" options={{ headerShown: true, headerTitle: 'Post a Job', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/v2/index" options={{ headerShown: true, headerTitle: 'My Jobs', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/v2/[id]" options={{ headerShown: true, headerTitle: 'Job Details', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/v2/quotes/[id]" options={{ headerShown: true, headerTitle: 'Quotes', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/v2/confirm/[id]" options={{ headerShown: true, headerTitle: 'Confirm Booking', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="wallet/index" options={{ headerShown: true, headerTitle: 'Wallet', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="find/index" options={{ headerShown: true, headerTitle: 'Find a Tasker', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="find/[categoryId]" options={{ headerShown: true, headerTitle: 'Services', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="find/job/[jobId]" options={{ headerShown: true, headerTitle: 'Service Details', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="find/taskers/[jobId]" options={{ headerShown: true, headerTitle: 'Available Taskers', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="find/tasker-profile/[taskerId]" options={{ headerShown: true, headerTitle: 'Tasker Profile', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="find/booking/[jobId]" options={{ headerShown: true, headerTitle: 'Quick Booking', headerBackTitle: 'Back', headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
    </Stack>
  )
}
