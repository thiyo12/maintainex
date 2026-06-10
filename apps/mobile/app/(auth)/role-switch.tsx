import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../lib/auth'
import { spacing, borderRadius } from '../../lib/tokens'

const ROLE_INFO: Record<string, { icon: string; label: string; desc: string }> = {
  TASKER: { icon: 'construct-outline', label: 'Work as a Tasker', desc: 'Find jobs, set your rates, and get hired by customers' },
  CUSTOMER: { icon: 'person-outline', label: 'Hire a Professional', desc: 'Post jobs and find the right expert for your needs' },
}

export default function RoleSwitchScreen() {
  const { target } = useLocalSearchParams<{ target: string }>()
  const { user, switchRole } = useAuth()
  const router = useRouter()
  const [switching, setSwitching] = useState(false)

  const targetRole = target === 'TASKER' ? 'TASKER' : 'CUSTOMER'
  const info = ROLE_INFO[targetRole]
  if (!info) return null

  const handleSwitch = async () => {
    setSwitching(true)
    try {
      await switchRole(targetRole)
      if (targetRole === 'TASKER') router.replace('/(tasker)')
      else router.replace('/(customer)')
    } catch {
      setSwitching(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Ionicons name="arrow-back" size={22} color="#111827" />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name={info.icon as any} size={40} color="#F59E0B" />
        </View>
        <Text style={styles.heading}>Switch to</Text>
        <Text style={styles.roleName}>{info.label}</Text>
        <Text style={styles.desc}>{info.desc}</Text>

        <View style={styles.oldRole}>
          <Ionicons name="swap-horizontal" size={16} color="#9CA3AF" />
          <Text style={styles.oldRoleText}>
            Currently: <Text style={styles.bold}>{user?.role === 'TASKER' ? 'Work as a Tasker' : 'Hire a Professional'}</Text>
          </Text>
        </View>

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
          <Text style={styles.noteText}>
            Your existing profile data will be preserved. You can switch back anytime.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.switchBtn, switching && styles.switchBtnDisabled]}
          onPress={handleSwitch}
          disabled={switching}
          activeOpacity={0.8}
        >
          {switching ? (
            <ActivityIndicator color="#111" />
          ) : (
            <Text style={styles.switchBtnText}>Confirm Switch</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  back: { padding: spacing.lg },
  content: { flex: 1, paddingHorizontal: spacing.xxl, justifyContent: 'center', alignItems: 'center' },
  iconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  heading: { fontSize: 16, color: '#6B7280', marginBottom: 4 },
  roleName: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: spacing.sm },
  desc: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: spacing.xxl },
  oldRole: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.lg },
  oldRoleText: { fontSize: 13, color: '#9CA3AF' },
  bold: { fontWeight: '700', color: '#6B7280' },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFFBEB', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.xxl, width: '100%' },
  noteText: { fontSize: 13, color: '#92400E', flex: 1, lineHeight: 18 },
  switchBtn: { backgroundColor: '#F59E0B', paddingVertical: 16, borderRadius: borderRadius.lg, alignItems: 'center', width: '100%' },
  switchBtnDisabled: { opacity: 0.6 },
  switchBtnText: { fontSize: 16, fontWeight: '700', color: '#111' },
})
