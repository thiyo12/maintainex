import { Platform } from 'react-native'
import { notifications as api } from './api'

let Notifications: any = null
try {
  if (Platform.OS !== 'web') {
    Notifications = require('expo-notifications')
  }
} catch {}

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  })
}

let registered = false

export async function registerForPushNotifications() {
  if (registered || !Notifications) return
  try {
    const { status: existing } = await Notifications.getPermissionsAsync()
    let finalStatus = existing
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== 'granted') {
      console.log('[push] permission not granted')
      return
    }

    const tokenData = await Notifications.getExpoPushTokenAsync()
    const token = tokenData.data

    await api.registerPush(token)
    registered = true
    console.log('[push] registered with backend')

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      })
    }
  } catch (_e) {
  }
}

export function addNotificationListeners(
  onReceived?: (notification: any) => void,
  onResponse?: (response: any) => void,
) {
  if (!Notifications) return () => {}
  const receivedSub = Notifications.addNotificationReceivedListener((n: any) => {
    console.log('[push] received:', n.request.content.title)
    onReceived?.(n)
  })
  const responseSub = Notifications.addNotificationResponseReceivedListener((r: any) => {
    console.log('[push] tapped:', r.notification.request.content.data)
    onResponse?.(r)
  })
  return () => {
    receivedSub.remove()
    responseSub.remove()
  }
}
