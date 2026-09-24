import { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native'
import { router } from 'expo-router'
import { BellRinging, X } from 'phosphor-react-native'
import { addNotificationListeners, registerForPushNotifications } from '../../lib/notifications'
import { useAuth } from '../../lib/auth'
import { v3 } from '../../theme/v3/tokens'

type JobAlert = {
  jobId: string
  title: string
  body: string
}

function routeFromPayload(data: any, role?: string | null) {
  if (!data) return

  if (data.type === 'CHAT_MESSAGE' && data.conversationId) {
    router.push(`/(chat)/${data.conversationId}` as any)
    return
  }

  const jobId = data.jobId || (data.referenceType === 'JOB' || data.referenceType === 'JOB_MATCH' ? data.referenceId : null)
  if (!jobId) {
    router.push('/notifications' as any)
    return
  }

  if (data.type === 'QUOTE_RECEIVED' || data.type === 'QUOTE_REVISED') {
    router.push(`/(customer)/jobs/v2/quotes/${jobId}` as any)
    return
  }

  if (role === 'COMPANY') {
    if (data.type === 'NEW_JOB' || data.type === 'JOB_MATCH') router.push(`/(company)/jobs/v2/quote/${jobId}` as any)
    else router.push(`/(company)/jobs/v2/manage/${jobId}` as any)
    return
  }

  if (role === 'TASKER') {
    if (data.type === 'NEW_JOB' || data.type === 'JOB_MATCH') router.push(`/(tasker)/jobs/v2/quote/${jobId}` as any)
    else router.push(`/(tasker)/jobs/v2/manage/${jobId}` as any)
    return
  }

  router.push(`/(customer)/jobs/v2/${jobId}` as any)
}

export default function NotificationBridge() {
  const { user } = useAuth()
  const [alert, setAlert] = useState<JobAlert | null>(null)
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    registerForPushNotifications()
    return addNotificationListeners(
      notification => {
        const content = notification?.request?.content
        const data = content?.data || {}
        if (data.type === 'NEW_JOB' && data.alertMode === 'FOREGROUND_URGENT' && data.jobId) {
          setAlert({
            jobId: String(data.jobId),
            title: content?.title || 'New job opportunity',
            body: content?.body || 'A matching customer request is available now.',
          })
          Vibration.vibrate([0, 260, 120, 260])
        }
      },
      response => routeFromPayload(response?.notification?.request?.content?.data, user?.role),
    )
  }, [user?.role])

  useEffect(() => {
    if (!alert) {
      pulse.stopAnimation()
      pulse.setValue(1)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 450, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
      { iterations: 8 },
    )
    loop.start()
    const timer = setTimeout(() => setAlert(null), 20000)
    return () => {
      clearTimeout(timer)
      loop.stop()
    }
  }, [alert])

  if (!alert) return null

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View style={styles.wrap}>
        <Animated.View style={[styles.card, { opacity: pulse }]}>
          <View style={styles.icon}>
            <BellRinging size={22} color={v3.colors.ink} weight="fill" />
          </View>
          <TouchableOpacity
            style={styles.copy}
            activeOpacity={0.8}
            onPress={() => {
              const jobId = alert.jobId
              setAlert(null)
              routeFromPayload({ type: 'NEW_JOB', jobId }, user?.role)
            }}
          >
            <Text style={styles.title}>{alert.title}</Text>
            <Text style={styles.body} numberOfLines={2}>{alert.body}</Text>
            <Text style={styles.cta}>Open job →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.close} onPress={() => setAlert(null)}>
            <X size={16} color={v3.colors.textSecondary} weight="bold" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 58,
    left: 14,
    right: 14,
    zIndex: 9999,
  },
  card: {
    minHeight: 94,
    borderRadius: 20,
    padding: 12,
    backgroundColor: v3.colors.amber,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 12,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: v3.colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, marginHorizontal: 11 },
  title: { ...v3.typography.bodyLarge, color: v3.colors.ink },
  body: { ...v3.typography.caption, color: '#5D430D', lineHeight: 16, marginTop: 2 },
  cta: { ...v3.typography.captionBold, color: v3.colors.ink, marginTop: 5 },
  close: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
})
