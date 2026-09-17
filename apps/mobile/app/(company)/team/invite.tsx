import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { CaretLeft, PaperPlaneRight } from 'phosphor-react-native'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { v2Team } from '../../../lib/api-v2'
import { useTranslation } from 'react-i18next'

export default function InviteTeamMember() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('MEMBER')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!name) {
      Alert.alert(t('common.error'), t('errors.enterMemberName'))
      return
    }
    if (!email && !phone) {
      Alert.alert(t('common.error'), t('errors.enterEmailOrPhone'))
      return
    }
    setSending(true)
    try {
      await v2Team.invite({
        name,
        email: email || undefined,
        phone: phone || undefined,
        role,
      })
      Alert.alert(t('common.success'), t('common.success'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ])
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('errors.generic'))
    } finally {
      setSending(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <CaretLeft size={24} color={colors.ink} />
      </TouchableOpacity>

      <Text style={styles.title}>{t('company.inviteMember')}</Text>
      <Text style={styles.subtitle}>
        {t('auth.onboarding.inviteTeamDesc')}
      </Text>

      <Text style={styles.label}>{t('profile.fullName')} *</Text>
      <TextInput
        style={styles.input}
        placeholder={t('auth.register.namePlaceholder')}
        placeholderTextColor={colors.muted}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>{t('profile.email')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('auth.register.emailPlaceholder')}
        placeholderTextColor={colors.muted}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>{t('profile.phone')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('auth.register.phonePlaceholder')}
        placeholderTextColor={colors.muted}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>{t('profile.role')}</Text>
      <View style={styles.roleRow}>
        <TouchableOpacity
          style={[styles.rolePill, role === 'MEMBER' && styles.rolePillActive]}
          onPress={() => setRole('MEMBER')}
        >
            <Text style={[styles.roleText, role === 'MEMBER' && styles.roleTextActive]}>{t('team.memberRole')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.rolePill, role === 'ADMIN' && styles.rolePillActive]}
          onPress={() => setRole('ADMIN')}
        >
          <Text style={[styles.roleText, role === 'ADMIN' && styles.roleTextActive]}>{t('team.adminRole')}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.sendBtn, (!name || sending) && styles.sendBtnDisabled]}
        onPress={handleSend}
        disabled={!name || sending}
      >
        {sending ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            <PaperPlaneRight size={18} color={colors.white} />
            <Text style={styles.sendText}>{t('company.inviteMember')}</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 24, paddingBottom: 48 },
  backBtn: { marginBottom: 16, alignSelf: 'flex-start' },
  title: { fontSize: 24, fontFamily: fonts.headingBold, color: colors.ink, marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: fonts.body, color: colors.muted, marginBottom: 24, lineHeight: 20 },
  label: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.ink, marginBottom: 6 },
  input: {
    backgroundColor: colors.white, borderRadius: 12, padding: 14, fontSize: 15,
    fontFamily: fonts.body, color: colors.ink, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  rolePill: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border,
  },
  rolePillActive: { borderColor: colors.amber, backgroundColor: colors.amberBg },
  roleText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.muted },
  roleTextActive: { color: colors.amberDark },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.amber, paddingVertical: 16, borderRadius: 16,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.white },
})
