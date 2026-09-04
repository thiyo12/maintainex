import { Stack } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../lib/ThemeContext'

export default function CustomerLayout() {
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
      <Stack.Screen name="settings/my-profile" options={{ headerShown: true, headerTitle: t('profile.myProfile'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="settings/edit-profile" options={{ headerShown: true, headerTitle: t('profile.edit'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: '#0B0C12' }, headerShadowVisible: false }} />
      <Stack.Screen name="settings/notifications" options={{ headerShown: true, headerTitle: t('profile.notifications'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="settings/payment" options={{ headerShown: true, headerTitle: t('profile.payment'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="settings/membership" options={{ headerShown: true, headerTitle: t('account.membership'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: '#0B0C12' }, headerShadowVisible: false }} />
      <Stack.Screen name="settings/vouchers" options={{ headerShown: true, headerTitle: t('account.vouchers'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: '#0B0C12' }, headerShadowVisible: false }} />
      <Stack.Screen name="settings/addresses" options={{ headerShown: true, headerTitle: t('profile.savedAddresses'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="settings/help" options={{ headerShown: true, headerTitle: t('profile.helpSupport'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="settings/terms" options={{ headerShown: true, headerTitle: t('profile.termsPrivacy'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="settings/about" options={{ headerShown: true, headerTitle: t('profile.aboutApp'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/posted-confirm" options={{ headerShown: true, headerTitle: t('postJob.published'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/quotes" options={{ headerShown: true, headerTitle: t('quotes.title'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="booking/confirmed" options={{ headerShown: true, headerTitle: t('booking.confirmed'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="tracking/[id]" options={{ headerShown: true, headerTitle: t('tracking.title'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/complete/[id]" options={{ headerShown: true, headerTitle: t('jobComplete.jobInReview'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/receipt/[id]" options={{ headerShown: true, headerTitle: t('receipt.title'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/review/[id]" options={{ headerShown: true, headerTitle: t('receipt.leaveReview'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/dispute/[id]" options={{ headerShown: true, headerTitle: t('dispute.title'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/v2/create" options={{ headerShown: false }} />
      <Stack.Screen name="jobs/waiting/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="jobs/v2/index" options={{ headerShown: true, headerTitle: t('customer.myJobs'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/v2/[id]" options={{ headerShown: true, headerTitle: t('jobs.details'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/v2/quotes/[id]" options={{ headerShown: true, headerTitle: t('quotes.title'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="jobs/v2/confirm/[id]" options={{ headerShown: true, headerTitle: t('booking.confirm'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="wallet/index" options={{ headerShown: true, headerTitle: t('wallet.title'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="find/index" options={{ headerShown: true, headerTitle: t('find.title'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="find/[categoryId]" options={{ headerShown: true, headerTitle: t('find.title'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="find/job/[jobId]" options={{ headerShown: true, headerTitle: t('jobDetail.seller'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="find/taskers/[jobId]" options={{ headerShown: true, headerTitle: t('find.title'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
      <Stack.Screen name="find/tasker-profile/[taskerId]" options={{ headerShown: true, headerTitle: t('profile.tasker'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: '#0B0C12' }, headerShadowVisible: false }} />
      <Stack.Screen name="find/booking/[jobId]" options={{ headerShown: true, headerTitle: t('booking.confirm'), headerBackTitle: t('common.back'), headerTintColor: colors.amber, headerStyle: { backgroundColor: colors.white } }} />
    </Stack>
  )
}
