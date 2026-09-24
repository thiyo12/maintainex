import { useEffect } from 'react'
import { AppState } from 'react-native'
import { Stack } from 'expo-router'
import { v3 } from '../../theme/v3/tokens'
import { taskers } from '../../lib/api'

export default function TaskerLayout() {
  useEffect(() => {
    let active = AppState.currentState === 'active'

    const setPresence = async (isOnline: boolean) => {
      try {
        await taskers.setOnline(isOnline)
      } catch {
        // Presence is best-effort; auth/navigation must never be blocked by it.
      }
    }

    if (active) setPresence(true)

    const heartbeat = setInterval(() => {
      if (active) setPresence(true)
    }, 60_000)

    const subscription = AppState.addEventListener('change', (nextState) => {
      const nextActive = nextState === 'active'
      if (nextActive !== active) {
        active = nextActive
        setPresence(nextActive)
      }
    })

    return () => {
      clearInterval(heartbeat)
      subscription.remove()
      if (active) setPresence(false)
    }
  }, [])

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
    </Stack>
  )
}
