import { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, Image, Alert, Modal, Pressable,
  KeyboardAvoidingView, Platform, TextInput, ActivityIndicator, TouchableOpacity,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Star, ChatCircleText, SealCheck, MapPin, PaperPlaneTilt, X, User, CalendarCheck } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'
import { taskers, conversations } from '../../../../lib/api'
import { useAuth } from '../../../../lib/auth'
import { buildSampleProfile } from '../../../../lib/sampleTaskers'
import { v3 } from '../../../../theme/v3/tokens'

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

export default function ProviderProfile() {
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
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.skeletonHeader} />
        <View style={styles.skeletonRow} />
        <View style={styles.skeletonCard} />
      </SafeAreaView>
    )
  }

  if (error || !tasker) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 32 }]} edges={['top']}>
        <Text style={styles.errorText}>{t('errors.generic')}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.7}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const reviews = (tasker.reviews || []).slice(0, 5)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ═══ Profile Header ═══ */}
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            {tasker.profileImage ? (
              <Image source={{ uri: tasker.profileImage }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
            )}
            {tasker.isOnline ? <View style={styles.onlineDot} /> : null}
          </View>

          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{name}</Text>
              {tasker.isVerified ? <SealCheck size={18} color={v3.colors.info} weight="fill" /> : null}
            </View>
            <View style={styles.catRow}>
              <User size={12} color={v3.colors.textMuted} />
              <Text style={styles.catText}>
                {(tasker.skills?.[0] || 'Tasker')} · {tasker.isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
        </View>

        {/* ═══ Stats ═══ */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{tasker.rating?.toFixed(1) || '—'}</Text>
            <Text style={styles.statLbl}>Rating</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Text style={styles.statVal}>{tasker.completedJobs || 0}</Text>
            <Text style={styles.statLbl}>Jobs done</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Text style={styles.statVal}>{tasker.avgResponseMin != null ? `${tasker.avgResponseMin}m` : '—'}</Text>
            <Text style={styles.statLbl}>Response</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Text style={styles.statVal}>{tasker.completionRate ?? '—'}%</Text>
            <Text style={styles.statLbl}>Completion</Text>
          </View>
        </View>

        {/* ═══ Rate Card ═══ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rate</Text>
          <View style={styles.rateTop}>
            <View style={styles.rateRow}>
              <Star size={16} color={v3.colors.amber} weight="fill" />
              <Text style={styles.rateVal}>LKR {rate.toLocaleString()}/hr</Text>
            </View>
            <View style={styles.ratingPill}>
              <Star size={11} color={v3.colors.ink} weight="fill" />
              <Text style={styles.ratingPillText}>{tasker.rating?.toFixed(1) || '—'}</Text>
            </View>
          </View>
        </View>

        {/* ═══ Skills ═══ */}
        {tasker.skills?.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Skills</Text>
            <View style={styles.chips}>
              {tasker.skills.map((sk: string, i: number) => (
                <View key={i} style={styles.chip}><Text style={styles.chipText}>{sk}</Text></View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ═══ About ═══ */}
        {tasker.bio ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>About</Text>
            <Text style={styles.bio}>{tasker.bio}</Text>
          </View>
        ) : null}

        {/* ═══ Service Areas ═══ */}
        {tasker.serviceAreas?.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.areaHeader}>
              <MapPin size={14} color={v3.colors.textMuted} />
              <Text style={styles.cardTitle}>Service Areas</Text>
            </View>
            <Text style={styles.bio}>{tasker.serviceAreas.join(' · ')}</Text>
          </View>
        ) : null}

        {/* ═══ Reviews ═══ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reviews ({reviews.length})</Text>
          {reviews.length === 0 ? (
            <Text style={styles.noReviews}>No reviews yet</Text>
          ) : (
            reviews.map((r: any) => (
              <View key={r.id} style={styles.review}>
                <View style={styles.reviewTop}>
                  <Text style={styles.reviewName}>{r.reviewerName}</Text>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={10} color={n <= r.rating ? v3.colors.amber : v3.colors.surfaceGray} weight={n <= r.rating ? 'fill' : 'regular'} />
                    ))}
                  </View>
                </View>
                {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* ═══ Bottom CTA ═══ */}
      <View style={styles.bottomBar}>
        {jobId ? (
          <TouchableOpacity style={[styles.btn, styles.btnPrimary, { flex: 1.1 }]} onPress={bookNow} activeOpacity={0.8}>
            <CalendarCheck size={16} color={v3.colors.paper} weight="fill" />
            <Text style={styles.btnPrimaryText}>Book</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={sendMessage} activeOpacity={0.8}>
          <ChatCircleText size={16} color={v3.colors.ink} weight="fill" />
          <Text style={styles.btnOutlineText}>Message</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnAccent]} onPress={() => setShowQuote(true)} activeOpacity={0.8}>
          <PaperPlaneTilt size={16} color={v3.colors.paper} weight="fill" />
          <Text style={styles.btnAccentText}>Quote</Text>
        </TouchableOpacity>
      </View>

      {/* ═══ Quote Modal ═══ */}
      <Modal visible={showQuote} transparent animationType="slide" onRequestClose={() => setShowQuote(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowQuote(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request a quote</Text>
              <TouchableOpacity onPress={() => setShowQuote(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={v3.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Date</Text>
            <View style={styles.dateRow}>
              {dateOptions().map((d) => {
                const active = qDate === d.value
                return (
                  <TouchableOpacity key={d.value} onPress={() => setQDate(d.value)} activeOpacity={0.7} style={[styles.dateChip, active && styles.dateChipActive]}>
                    <Text style={[styles.dateChipLabel, active && styles.dateChipLabelActive]}>{d.label}</Text>
                    <Text style={[styles.dateChipVal, active && styles.dateChipLabelActive]}>{d.value.slice(5)}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <Text style={styles.modalLabel}>Time Slot</Text>
            <View style={styles.slotRow}>
              {TIME_SLOTS.map((slot) => {
                const active = qSlot === slot
                return (
                  <TouchableOpacity key={slot} onPress={() => setQSlot(slot)} activeOpacity={0.7} style={[styles.slotChip, active && styles.slotChipActive]}>
                    <Text style={[styles.slotChipText, active && styles.slotChipTextActive]}>{slot}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <TextInput style={styles.msgInput} value={qMsg} onChangeText={setQMsg} placeholder="Optional message" placeholderTextColor={v3.colors.textMuted} multiline numberOfLines={3} />

            <TouchableOpacity style={[styles.btn, styles.btnAccent, { width: '100%' }]} onPress={sendQuoteReq} activeOpacity={0.8} disabled={sending}>
              {sending ? <ActivityIndicator color={v3.colors.paper} /> : <Text style={styles.btnAccentText}>Send Request</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  content: { padding: 18, paddingBottom: 120 },

  skeletonHeader: { height: 90, borderRadius: v3.radius.lg, backgroundColor: v3.colors.surfaceGray, marginBottom: 16 },
  skeletonRow: { height: 70, borderRadius: v3.radius.md, backgroundColor: v3.colors.surfaceGray, marginBottom: 16 },
  skeletonCard: { height: 140, borderRadius: v3.radius.lg, backgroundColor: v3.colors.surfaceGray },
  errorText: { fontSize: 14, fontFamily: 'Outfit_500Medium', color: v3.colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: v3.colors.surfaceGray, paddingHorizontal: 24, paddingVertical: 12, borderRadius: v3.radius.full },
  retryText: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: v3.colors.textPrimary },

  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: v3.colors.surfaceWhite,
    borderWidth: 1, borderColor: v3.colors.line, borderRadius: v3.radius.lg,
    padding: 16, marginBottom: 16,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 66, height: 66, borderRadius: 33, backgroundColor: v3.colors.surfaceGray, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: v3.colors.ink },
  avatarImage: { width: 66, height: 66, borderRadius: 33, borderWidth: 2, borderColor: v3.colors.ink },
  avatarText: { fontSize: 26, fontFamily: 'Outfit_700Bold', color: v3.colors.ink },
  onlineDot: {
    position: 'absolute', right: 0, bottom: 0, width: 16, height: 16, borderRadius: 8,
    backgroundColor: v3.colors.success, borderWidth: 2.5, borderColor: v3.colors.paper,
  },
  nameBlock: { flex: 1, marginLeft: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 20, fontFamily: 'Outfit_900Black', color: v3.colors.textPrimary },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  catText: { fontSize: 12, fontFamily: 'Outfit_500Medium', color: v3.colors.textMuted },

  statsRow: {
    flexDirection: 'row', backgroundColor: v3.colors.surfaceWhite, borderWidth: 1, borderColor: v3.colors.line,
    borderRadius: v3.radius.lg, paddingVertical: 14, marginBottom: 16,
  },
  stat: { flex: 1, alignItems: 'center' },
  statDiv: { width: 1, backgroundColor: v3.colors.line },
  statVal: { fontSize: 17, fontFamily: 'Outfit_700Bold', color: v3.colors.textPrimary },
  statLbl: { fontSize: 10, fontFamily: 'Outfit_500Medium', color: v3.colors.textMuted, marginTop: 2, textAlign: 'center' },

  card: { backgroundColor: v3.colors.surfaceWhite, borderWidth: 1, borderColor: v3.colors.line, borderRadius: v3.radius.lg, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: v3.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  rateTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rateVal: { fontSize: 20, fontFamily: 'Outfit_700Bold', color: v3.colors.textPrimary },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: v3.colors.amber, paddingHorizontal: 10, paddingVertical: 5, borderRadius: v3.radius.full },
  ratingPillText: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: v3.colors.ink },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: v3.colors.surfaceGray, borderWidth: 1, borderColor: v3.colors.line, paddingHorizontal: 12, paddingVertical: 7, borderRadius: v3.radius.full },
  chipText: { fontSize: 12, fontFamily: 'Outfit_500Medium', color: v3.colors.textPrimary },
  bio: { fontSize: 13, fontFamily: 'Outfit_500Medium', color: v3.colors.textPrimary, lineHeight: 20 },
  areaHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },

  noReviews: { fontSize: 13, fontFamily: 'Outfit_500Medium', color: v3.colors.textMuted },
  review: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: v3.colors.line },
  reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  reviewName: { fontSize: 13, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textPrimary },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewComment: { fontSize: 12, fontFamily: 'Outfit_500Medium', color: v3.colors.textSecondary, lineHeight: 18 },

  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', gap: 8,
    backgroundColor: v3.colors.paper, borderTopWidth: 1, borderTopColor: v3.colors.line,
    padding: 18, paddingBottom: 36,
  },
  btn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: v3.radius.full },
  btnOutline: { borderWidth: 1.5, borderColor: v3.colors.ink, backgroundColor: 'transparent' },
  btnOutlineText: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: v3.colors.ink },
  btnPrimary: { backgroundColor: v3.colors.ink },
  btnPrimaryText: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: v3.colors.paper },
  btnAccent: { backgroundColor: v3.colors.amber },
  btnAccentText: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: v3.colors.paper },

  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject as any, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { backgroundColor: v3.colors.paper, borderTopLeftRadius: v3.radius.xl, borderTopRightRadius: v3.radius.xl, padding: 18, paddingBottom: 36 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.textPrimary },
  modalLabel: { fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dateChip: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: v3.radius.md, borderWidth: 1, borderColor: v3.colors.line, backgroundColor: v3.colors.surfaceWhite },
  dateChipActive: { backgroundColor: v3.colors.ink, borderColor: v3.colors.ink },
  dateChipLabel: { fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textMuted },
  dateChipVal: { fontSize: 10, fontFamily: 'Outfit_400Regular', color: v3.colors.textMuted, marginTop: 1 },
  dateChipLabelActive: { color: v3.colors.paper },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  slotChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: v3.radius.full, borderWidth: 1, borderColor: v3.colors.line, backgroundColor: v3.colors.surfaceWhite },
  slotChipActive: { backgroundColor: v3.colors.ink, borderColor: v3.colors.ink },
  slotChipText: { fontSize: 11, fontFamily: 'Outfit_500Medium', color: v3.colors.textMuted },
  slotChipTextActive: { color: v3.colors.paper, fontFamily: 'Outfit_700Bold' },
  msgInput: {
    backgroundColor: v3.colors.surfaceGray, borderWidth: 1, borderColor: v3.colors.line, borderRadius: v3.radius.md,
    padding: 14, fontSize: 13, color: v3.colors.textPrimary, fontFamily: 'Outfit_400Regular',
    textAlignVertical: 'top', minHeight: 84, marginBottom: 16,
  },
})
