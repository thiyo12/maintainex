import { useEffect, useState } from 'react'
import { View, Text, TextInput, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { conversations } from '@/lib/api'
import { useTheme } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'

type Props = {
  visible: boolean
  onClose: () => void
  recipient?: { id: string; name: string } | null
  jobId?: string
  jobTitle?: string
  prefilled?: string
}

export default function NewChatModal({ visible, onClose, recipient, jobId, jobTitle, prefilled }: Props) {
  const { colors, isDark } = useTheme()
  const router = useRouter()
  const [message, setMessage] = useState(prefilled || '')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (visible) setMessage(prefilled || '')
  }, [visible, prefilled])

  const handleSend = async () => {
    if (!recipient?.id || sending) return
    setSending(true)
    try {
      const res = await conversations.create({
        participantId: recipient.id,
        jobId,
        initialMessage: message.trim() || undefined,
      })
      onClose()
      router.push(`/(chat)/${res.id}` as any)
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not start the chat.')
    } finally {
      setSending(false)
    }
  }

  if (!recipient) return null

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.sheet, { backgroundColor: colors.white }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={[styles.title, { color: colors.ink }]}>Message {recipient.name}</Text>
              {jobTitle ? <Text style={[styles.sub, { color: colors.muted }]} numberOfLines={1}>{jobTitle}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.ink, borderColor: colors.border }]}
            value={message}
            onChangeText={setMessage}
            placeholder="Write a message…"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.send, { backgroundColor: colors.amber, opacity: sending ? 0.6 : 1 }]}
            onPress={handleSend}
            disabled={sending || !message.trim()}
          >
            {sending ? (
              <ActivityIndicator color="#0D0D0D" size="small" />
            ) : (
              <Text style={styles.sendText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerLeft: { flex: 1, marginRight: 12 },
  title: { fontSize: 17, fontFamily: fonts.bodyBold },
  sub: { fontSize: 12, fontFamily: fonts.body, marginTop: 2 },
  input: {
    minHeight: 110,
    maxHeight: 180,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontFamily: fonts.body,
    textAlignVertical: 'top',
  },
  send: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  sendText: { fontSize: 15, fontFamily: fonts.bodyBold, color: '#0D0D0D' },
})