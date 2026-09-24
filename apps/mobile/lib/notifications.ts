import { Platform } from 'react-native'
import { notifications as api } from './api'

let Notifications: any = null
try {
  if (Platform.OS !== 'web') Notifications = require('expo-notifications')
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

async function setupChannels() {
  if (!Notifications || Platform.OS !== 'android') return
  await Promise.all([
    Notifications.setNotificationChannelAsync('default', {
      name: 'MaintainEX',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 200, 120, 200],
    }),
    Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 160],
    }),
    Notifications.setNotificationChannelAsync('jobs', {
      name: 'Job opportunities',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 300, 120, 300, 120, 300],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }),
  ])
}

export async function registerForPushNotifications() {
  if (registered || !Notifications) return
  try {
    await setupChannels()

    let Device: any = null
    try { Device = require('expo-device') } catch {}
    if (Device && Device.isDevice === false) {
      console.log('[push] remote push requires a physical device')
      return
    }

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
  } catch (error) {
    console.log('[push] registration failed', String(error))
  }
}

export function addNotificationListeners(
  onReceived?: (notification: any) => void,
  onResponse?: (response: any) => void,
) {
  if (!Notifications) return () => {}
  const receivedSub = Notifications.addNotificationReceivedListener((notification: any) => {
    onReceived?.(notification)
  })
  const responseSub = Notifications.addNotificationResponseReceivedListener((response: any) => {
    onResponse?.(response)
  })
  return () => {
    receivedSub.remove()
    responseSub.remove()
  }
}
