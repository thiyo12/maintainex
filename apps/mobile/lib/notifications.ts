import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { notifications as api } from './api'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

let registered = false

export async function registerForPushNotifications() {
  if (registered) return
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
    console.log('[push] token:', token.substring(0, 20) + '...')

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
  onReceived?: (notification: Notifications.Notification) => void,
  onResponse?: (response: Notifications.NotificationResponse) => void,
) {
  const receivedSub = Notifications.addNotificationReceivedListener(n => {
    console.log('[push] received:', n.request.content.title)
    onReceived?.(n)
  })
  const responseSub = Notifications.addNotificationResponseReceivedListener(r => {
    console.log('[push] tapped:', r.notification.request.content.data)
    onResponse?.(r)
  })
  return () => {
    receivedSub.remove()
    responseSub.remove()
  }
}
