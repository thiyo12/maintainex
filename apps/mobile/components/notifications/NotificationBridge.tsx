import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { BellRinging, Briefcase, X } from 'phosphor-react-native'
import { useAuth } from '../../lib/auth'
import {
  addNotificationListeners,
  registerForPushNotifications,
  resetPushRegistration,
} from '../../lib/notifications'
import { v3 } from '../../theme/v3/tokens'

type Offer = {
  title: string
  body: string
  data: Record<string, any>
}

function routeFor(data: Record<string, any>, role?: string) {
  const type = String(data?.type || '')
  const jobId = data?.jobId || data?.referenceId

  if (type === 'CHAT_MESSAGE' && (data?.id || data?.conversationId)) {
    return `/(chat)/${data.id || data.conversationId}`
  }

  if ((type === 'QUOTE_SUBMITTED' || type === 'QUOTE_REVISED') && jobId) {
    return `/(customer)/jobs/v2/quotes/${jobId}`
  }

  if (type === 'NEW_JOB' && jobId) {
    if (data?.companyId || role === 'COMPANY') {
      return `/(company)/jobs/v2/quote/${jobId}`
    }
    return `/(tasker)/jobs/v2/quote/${jobId}`
  }

  if (type === 'COMPANY_ASSIGNMENT' && jobId) {
    return `/(tasker)/jobs/v2/manage/${jobId}`
  }

  if (jobId && role === 'CUSTOMER') return `/(customer)/jobs/v2/${jobId}`
  if (jobId && role === 'COMPANY') return `/(company)/jobs/v2/manage/${jobId}`
  if (jobId && role === 'TASKER') return `/(tasker)/jobs/v2/manage/${jobId}`

  return '/notifications'
}

export default function NotificationBridge() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const [offer, setOffer] = useState<Offer | null>(null)
  const pulse = useRef(new Animated.Value(1)).current
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated || !user) {
      resetPushRegistration()
      setOffer(null)
      return
    }

    registerForPushNotifications().catch(() => {})
  }, [isAuthenticated, isLoading, user?.id])

  useEffect(() => {
    if (!isAuthenticated || !user) return

    const cleanup = addNotificationListeners(
      notification => {
        const content = notification?.request?.content
        const data = (content?.data || {}) as Record<string, any>
        if (data?.type !== 'NEW_JOB') return
        if (!['ring', 'urgent_foreground'].includes(String(data?.alertMode || ''))) return

        if (timerRef.current) clearTimeout(timerRef.current)
        setOffer({
          title: content?.title || 'New job available',
          body: content?.body || 'A matching job is ready to review.',
          data,
        })

        Vibration.vibrate([0, 300, 140, 300, 140, 600])
        timerRef.current = setTimeout(() => setOffer(null), 45_000)
      },
      response => {
        const data = (response?.notification?.request?.content?.data || {}) as Record<string, any>
        setOffer(null)
        router.push(routeFor(data, user.role) as any)
      },
    )

    return () => {
      cleanup()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isAuthenticated, user?.id, user?.role, router])

  useEffect(() => {
    if (!offer) {
      pulse.stopAnimation()
      pulse.setValue(1)
      return
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.86,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 550,
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [offer, pulse])

  if (!offer) return null

  const openOffer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const target = routeFor(offer.data, user?.role)
    setOffer(null)
    router.push(target as any)
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOffer(null)}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { transform: [{ scale: pulse }] }]}>
          <View style={styles.topRow}>
            <View style={styles.iconWrap}>
              <BellRinging size={24} color={v3.colors.ink} weight="fill" />
            </View>
            <View style={styles.copy}>
              <Text style={styles.eyebrow}>LIVE JOB OFFER</Text>
              <Text style={styles.title} numberOfLines={2}>{offer.title}</Text>
            </View>
            <TouchableOpacity style={styles.close} onPress={() => setOffer(null)}>
              <X size={18} color={v3.colors.textSecondary} weight="bold" />
            </TouchableOpacity>
          </View>

          <Text style={styles.body} numberOfLines={3}>{offer.body}</Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondary} onPress={() => setOffer(null)}>
              <Text style={styles.secondaryText}>Not now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primary} onPress={openOffer}>
              <Briefcase size={17} color={v3.colors.paper} weight="bold" />
              <Text style={styles.primaryText}>View job</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.note}>Review the request before sending a quote. Offers are never auto-accepted.</Text>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: v3.colors.paper,
    borderRadius: 26,
    padding: 18,
    borderWidth: 2,
    borderColor: v3.colors.amber,
  },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: v3.colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, marginLeft: 12 },
  eyebrow: { ...v3.typography.smallBold, color: v3.colors.amberDark, letterSpacing: 1 },
  title: { ...v3.typography.title, color: v3.colors.ink, marginTop: 2 },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: v3.colors.surfaceGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    ...v3.typography.body,
    color: v3.colors.textSecondary,
    lineHeight: 19,
    marginTop: 14,
  },
  actions: { flexDirection: 'row', gap: 9, marginTop: 18 },
  secondary: {
    flex: 1,
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: v3.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { ...v3.typography.bodyBold, color: v3.colors.ink },
  primary: {
    flex: 1.35,
    height: 50,
    borderRadius: 15,
    backgroundColor: v3.colors.ink,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { ...v3.typography.bodyBold, color: v3.colors.paper },
  note: {
    ...v3.typography.small,
    color: v3.colors.textMuted,
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 10,
  },
})
