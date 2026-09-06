import { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, Image, Alert, Modal, Pressable,
  KeyboardAvoidingView, Platform, TextInput, ActivityIndicator, TouchableOpacity,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Star, ChatCircleText, SealCheck, MapPin, PaperPlaneTilt, X, User, CalendarCheck } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { taskers, conversations } from '../../../../lib/api'
import { useAuth } from '../../../../lib/auth'
import { buildSampleProfile } from '../../../../lib/sampleTaskers'
import { colors, spacing, radius, typography, shadows } from '../../../../lib/design'
import PressableScale from '../../../../components/ui/PressableScale'

const TIME_SLOTS = ['08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00']

function dateOptions() {
  const out: { label: string; value: string }[] = []
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  for (let i = 0; i < 4; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : weekdays[d.getDay()]
    out.push({ label, value: d.toISOString().split('T')[0] })
  }
  return out
}

export default function TaskerProfileScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { taskerId, jobId } = useLocalSearchParams<{ taskerId: string; jobId?: string }>()
  const { user } = useAuth()

  const [tasker, setTasker] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [showQuote, setShowQuote] = useState(false)
  const [qDate, setQDate] = useState(dateOptions()[0].value)
  const [qSlot, setQSlot] = useState('')
  const [qMsg, setQMsg] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    if (!taskerId) return
    setLoading(true)
    setError(false)
    try {
      const data = await taskers.get(taskerId)
      setTasker(data)
    } catch {
      if (taskerId.startsWith('sample-')) {
        setTasker(buildSampleProfile(taskerId, jobId))
      } else {
        setError(true)
      }
    } finally {
      setLoading(false)
    }
  }, [taskerId, jobId])

  const didLoad = useRef(false)
  useEffect(() => {
    if (!didLoad.current) {
      didLoad.current = true
      load()
    }
  }, [load])

  const name = tasker?.user?.name || ''
  const initial = (name || 'T').charAt(0).toUpperCase()
  const rate = tasker?.hourlyRate || 0

  const openThread = async (text: string) => {
    try {
      const c = await conversations.create({ participantId: tasker.userId, initialMessage: text })
      if (c?.id) {
        if (c.existing) {
          await conversations.sendMessage(c.id, text).catch(() => {})
        }
        router.push(`/(chat)/${c.id}`)
      } else {
        router.push(`/(chat)/demo_${Date.now()}?testMsg=${encodeURIComponent(text)}&testUser=${encodeURIComponent(name)}`)
      }
    } catch {
      router.push(`/(chat)/demo_${Date.now()}?testMsg=${encodeURIComponent(text)}&testUser=${encodeURIComponent(name)}`)
    }
  }

  const sendMessage = () => {
    const msg = `Hi ${name}, I'm interested in your services. Are you available this week?`
    openThread(msg)
  }

  const sendQuoteReq = async () => {
    if (!qDate || !qSlot) {
      Alert.alert(t('common.error'), t('taskerProfile.pickDateSlot'))
      return
    }
    setSending(true)
    const text = `Quote Request\nDate: ${qDate}\nTime: ${qSlot}${qMsg ? `\n\nMessage:\n${qMsg}` : ''}`
    setShowQuote(false)
    await openThread(text)
    setSending(false)
  }

  const bookNow = () => {
    if (!jobId) return
    router.push({
      pathname: `/(customer)/find/booking/${jobId}`,
      params: { taskerId: taskerId as string, rate: String(rate || 0) },
    } as any)
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonHeader} />
        <View style={styles.skeletonRow} />
        <View style={styles.skeletonCard} />
      </View>
    )
  }

  if (error || !tasker) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: spacing.xl }]}>
        <Text style={styles.errorText}>{t('errors.generic')}</Text>
        <PressableScale onPress={load} scaleTo={0.96} style={styles.retryBtn}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </PressableScale>
      </View>
    )
  }

  const reviews = (tasker.reviews || []).slice(0, 5)

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <PressableScale scaleTo={0.96} style={styles.avatarWrap}>
            {tasker.profileImage ? (
              <Image source={{ uri: tasker.profileImage }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
            )}
            {tasker.isOnline ? <View style={styles.onlineDot} /> : null}
          </PressableScale>

          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{name}</Text>
              {tasker.isVerified ? <SealCheck size={20} color="#3B82F6" weight="fill" /> : null}
            </View>
            <View style={styles.catRow}>
              <User size={13} color={colors.textSecondary} />
              <Text style={styles.catText}>
                {(tasker.skills?.[0] || 'Tasker')} · {t(`taskerProfile.${tasker.isOnline ? 'online' : 'offline'}`)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{tasker.rating?.toFixed(1) || '—'}</Text>
            <Text style={styles.statLbl}>{t('taskerProfile.rating')}</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Text style={styles.statVal}>{tasker.completedJobs || 0}</Text>
            <Text style={styles.statLbl}>{t('taskerProfile.jobsDone')}</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Text style={styles.statVal}>{tasker.avgResponseMin != null ? `${tasker.avgResponseMin}m` : '—'}</Text>
            <Text style={styles.statLbl}>{t('taskerProfile.avgResponse')}</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Text style={styles.statVal}>{tasker.completionRate ?? '—'}%</Text>
            <Text style={styles.statLbl}>{t('taskerProfile.completionRate')}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.rateLabel}>{t('taskerProfile.rating')} & Rate</Text>
          <View style={styles.rateTop}>
            <View style={styles.rateRow}>
              <Star size={18} color={colors.accent} weight="fill" />
              <Text style={styles.rateVal}>{t('taskerProfile.fromRate', { n: rate.toLocaleString() })}</Text>
            </View>
            <View style={styles.ratingPill}>
              <Star size={12} color="#0D0D0D" weight="fill" />
              <Text style={styles.ratingPillText}>{tasker.rating?.toFixed(1) || '—'}</Text>
            </View>
          </View>
        </View>

        {tasker.skills?.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('taskerProfile.skills')}</Text>
            <View style={styles.chips}>
              {tasker.skills.map((sk: string, i: number) => (
                <View key={i} style={styles.chip}><Text style={styles.chipText}>{sk}</Text></View>
              ))}
            </View>
          </View>
        ) : null}

        {tasker.bio ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('taskerProfile.about')}</Text>
            <Text style={styles.bio}>{tasker.bio}</Text>
          </View>
        ) : null}

        {tasker.serviceAreas?.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.areaHeader}>
              <MapPin size={15} color={colors.textSecondary} />
              <Text style={styles.cardTitle}>{t('taskerProfile.serviceAreas')}</Text>
            </View>
            <Text style={styles.bio}>{tasker.serviceAreas.join(' · ')}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('taskerProfile.reviews')} ({reviews.length})</Text>
          {reviews.length === 0 ? (
            <Text style={styles.noReviews}>{t('taskerProfile.noReviews')}</Text>
          ) : (
            reviews.map((r: any) => (
              <View key={r.id} style={styles.review}>
                <View style={styles.reviewTop}>
                  <Text style={styles.reviewName}>{r.reviewerName}</Text>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={10} color={n <= r.rating ? colors.accent : colors.surfaceHigh} weight={n <= r.rating ? 'fill' : 'regular'} />
                    ))}
                  </View>
                </View>
                {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        {jobId ? (
          <PressableScale onPress={bookNow} scaleTo={0.97} style={[styles.btn, styles.btnPrimary, { flex: 1.1 }]}>
            <CalendarCheck size={18} color="#0D0D0D" weight="fill" />
            <Text style={styles.btnPrimaryText}>{t('taskerProfile.bookNow')}</Text>
          </PressableScale>
        ) : null}
        <PressableScale onPress={sendMessage} scaleTo={0.97} style={[styles.btn, styles.btnOutline]}>
          <ChatCircleText size={18} color={colors.accent} weight="fill" />
          <Text style={styles.btnOutlineText}>{t('taskerProfile.message')}</Text>
        </PressableScale>
        <PressableScale onPress={() => setShowQuote(true)} scaleTo={0.97} style={[styles.btn, styles.btnPrimary]}>
          <PaperPlaneTilt size={18} color="#0D0D0D" weight="fill" />
          <Text style={styles.btnPrimaryText}>{t('taskerProfile.requestQuote')}</Text>
        </PressableScale>
      </View>

      <Modal visible={showQuote} transparent animationType="slide" onRequestClose={() => setShowQuote(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowQuote(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('taskerProfile.quoteModalTitle')}</Text>
              <TouchableOpacity onPress={() => setShowQuote(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>{t('taskerProfile.date')}</Text>
            <View style={styles.dateRow}>
              {dateOptions().map((d) => {
                const active = qDate === d.value
                return (
                  <PressableScale key={d.value} onPress={() => setQDate(d.value)} scaleTo={0.95} style={[styles.dateChip, active && styles.dateChipActive]}>
                    <Text style={[styles.dateChipLabel, active && styles.dateChipLabelActive]}>{d.label}</Text>
                    <Text style={[styles.dateChipVal, active && styles.dateChipLabelActive]}>{d.value.slice(5)}</Text>
                  </PressableScale>
                )
              })}
            </View>

            <Text style={styles.modalLabel}>{t('taskerProfile.timeSlot')}</Text>
            <View style={styles.slotRow}>
              {TIME_SLOTS.map((slot) => {
                const active = qSlot === slot
                return (
                  <PressableScale key={slot} onPress={() => setQSlot(slot)} scaleTo={0.95} style={[styles.slotChip, active && styles.slotChipActive]}>
                    <Text style={[styles.slotChipText, active && styles.slotChipTextActive]}>{slot}</Text>
                  </PressableScale>
                )
              })}
            </View>

            <TextInput style={styles.msgInput} value={qMsg} onChangeText={setQMsg} placeholder={t('taskerProfile.optionalMsg')} placeholderTextColor={colors.textSecondary} multiline numberOfLines={3} />

            <PressableScale onPress={sendQuoteReq} scaleTo={0.97} style={[styles.btn, styles.btnPrimary, { width: '100%' }]} disabled={sending}>
              {sending ? <ActivityIndicator color="#0D0D0D" /> : <Text style={styles.btnPrimaryText}>{t('taskerProfile.sendRequest')}</Text>}
            </PressableScale>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 120 },

  skeletonHeader: { height: 90, borderRadius: radius.lg, backgroundColor: colors.surface, marginBottom: spacing.md },
  skeletonRow: { height: 70, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: spacing.md },
  skeletonCard: { height: 140, borderRadius: radius.lg, backgroundColor: colors.surface },
  errorText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
  retryBtn: { backgroundColor: colors.accentSoft, paddingHorizontal: spacing.xl, paddingVertical: 12, borderRadius: radius.full },
  retryText: { ...typography.body, color: colors.accent, fontFamily: 'Outfit_700Bold', fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.md,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 66, height: 66, borderRadius: 33, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.accent },
  avatarImage: { width: 66, height: 66, borderRadius: 33, borderWidth: 2, borderColor: colors.accent },
  avatarText: { fontSize: 26, fontFamily: 'Outfit_700Bold', color: colors.accent },
  onlineDot: {
    position: 'absolute', right: 0, bottom: 0, width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#34D399', borderWidth: 2.5, borderColor: colors.surface,
  },
  nameBlock: { flex: 1, marginLeft: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...typography.h3, fontSize: 20, margin: 0 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  catText: { ...typography.caption, color: colors.textSecondary, fontSize: 13 },

  statsRow: {
    flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, paddingVertical: spacing.md, marginBottom: spacing.md,
  },
  stat: { flex: 1, alignItems: 'center' },
  statDiv: { width: 1, backgroundColor: colors.border },
  statVal: { ...typography.body, color: colors.accent, fontSize: 17, fontFamily: 'Outfit_700Bold' },
  statLbl: { ...typography.caption, color: colors.textSecondary, fontSize: 11, marginTop: 2, textAlign: 'center' },

  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  cardTitle: { ...typography.caption, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'Outfit_700Bold', fontSize: 12, marginBottom: 12 },
  rateLabel: { display: 'none' },
  rateTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rateVal: { ...typography.h3, fontSize: 20, color: colors.accent, fontFamily: 'Outfit_700Bold' },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  ratingPillText: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: '#0D0D0D' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full },
  chipText: { fontSize: 12, fontFamily: 'Outfit_500Medium', color: colors.textPrimary },
  bio: { ...typography.body, fontSize: 14, color: colors.textPrimary, lineHeight: 21 },
  areaHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },

  noReviews: { ...typography.bodyMuted, fontSize: 13, color: colors.textSecondary },
  review: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  reviewName: { ...typography.body, fontSize: 14, fontFamily: 'Outfit_600SemiBold' },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewComment: { ...typography.caption, color: colors.textSecondary, fontSize: 13, lineHeight: 19 },

  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', gap: spacing.sm,
    backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border,
    padding: spacing.md, paddingBottom: spacing.lg,
    ...shadows.md,
  },
  btn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: radius.lg },
  btnOutline: { borderWidth: 1.5, borderColor: colors.accent, backgroundColor: 'transparent' },
  btnOutlineText: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: colors.accent },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: '#0D0D0D' },

  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject as any, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  modalTitle: { ...typography.h3, fontSize: 18 },
  modalLabel: { ...typography.caption, color: colors.textSecondary, fontFamily: 'Outfit_600SemiBold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  dateRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  dateChip: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceHigh },
  dateChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dateChipLabel: { fontSize: 12, fontFamily: 'Outfit_600SemiBold', color: colors.textSecondary },
  dateChipVal: { fontSize: 11, fontFamily: 'Outfit_400Regular', color: colors.textSecondary, marginTop: 1 },
  dateChipLabelActive: { color: '#0D0D0D' },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  slotChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceHigh },
  slotChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  slotChipText: { fontSize: 12, fontFamily: 'Outfit_500Medium', color: colors.textSecondary },
  slotChipTextActive: { color: '#0D0D0D', fontFamily: 'Outfit_700Bold' },
  msgInput: {
    backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: 14, fontSize: 14, color: colors.textPrimary, fontFamily: 'Outfit_400Regular',
    textAlignVertical: 'top', minHeight: 84, marginBottom: spacing.md,
  },
})