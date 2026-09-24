import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { notifications as api } from './api'

let Notifications: any = null
let Device: any = null
try {
  if (Platform.OS !== 'web') {
    Notifications = require('expo-notifications')
    Device = require('expo-device')
  }
} catch {}

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  })
}

let registeredToken: string | null = null

async function configureAndroidChannels() {
  if (!Notifications || Platform.OS !== 'android') return

  await Promise.all([
    Notifications.setNotificationChannelAsync('job_offers', {
      name: 'New job offers',
      description: 'High-priority alerts when a matching job is available.',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 300, 180, 300],
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }),
    Notifications.setNotificationChannelAsync('job_updates', {
      name: 'Job updates',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 180],
    }),
    Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    }),
    Notifications.setNotificationChannelAsync('payments', {
      name: 'Payments',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    }),
    Notifications.setNotificationChannelAsync('default', {
      name: 'MaintainEX',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    }),
  ])
}

export async function registerForPushNotifications() {
  if (!Notifications || !Device?.isDevice) return null

  try {
    await configureAndroidChannels()

    const { status: existing } = await Notifications.getPermissionsAsync()
    let finalStatus = existing

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      console.log('[push] permission not granted')
      return null
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync()
    const token = tokenData.data

    if (registeredToken !== token) {
      await api.registerPush(token)
      registeredToken = token
      console.log('[push] registered with backend')
    }

    return token
  } catch (error) {
    console.log('[push] registration failed', error)
    return null
  }
}

export function resetPushRegistration() {
  registeredToken = null
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
