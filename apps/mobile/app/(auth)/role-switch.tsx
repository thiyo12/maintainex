import { useState } from 'react'
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Buildings, CaretRight, House, ShieldCheck, Wrench } from 'phosphor-react-native'
import { useRouter } from 'expo-router'

import { useAuth } from '../../lib/auth'
import { v3 } from '../../theme/v3/tokens'
import AuthShell from '../../components/v3/AuthShell'
import V3NavBar from '../../components/v3/V3NavBar'

export default function RoleSwitchScreen() {
  const { user, switchRole } = useAuth()
  const router = useRouter()
  const [switching, setSwitching] = useState<'CUSTOMER' | 'TASKER' | null>(null)

  const currentRole = user?.role === 'TASKER' ? 'TASKER' : user?.role === 'COMPANY' ? 'COMPANY' : 'CUSTOMER'

  const changeRole = async (next: 'CUSTOMER' | 'TASKER') => {
    if (next === currentRole) {
      router.back()
      return
    }
    if (switching) return
    setSwitching(next)
    try {
      await switchRole(next)
      router.replace(next === 'TASKER' ? '/(tasker)' : '/(customer)')
    } catch (err: any) {
      let message = err?.message || 'Failed to switch role'
      try { message = JSON.parse(message).error || message } catch {}
      Alert.alert('Unable to switch role', message)
      setSwitching(null)
    }
  }

  return (
    <AuthShell bg={v3.colors.canvas}>
      <V3NavBar title="Switch role" onBack={() => router.back()} />
      <View style={styles.content}>
        <Text style={styles.title}>Choose your MaintainEX mode</Text>
        <Text style={styles.subtitle}>Your profile, history, badges and settings stay with you.</Text>

        {currentRole === 'CUSTOMER' ? <Text style={styles.currentEyebrow}>CURRENT · CUSTOMER</Text> : null}
        {currentRole === 'TASKER' ? <Text style={styles.currentEyebrow}>CURRENT · TASKER</Text> : null}
        {currentRole === 'COMPANY' ? <Text style={styles.currentEyebrow}>CURRENT · COMPANY</Text> : null}

        <RoleRow
          icon={<House size={20} color={v3.colors.ink} weight="bold" />}
          title="Customer"
          subtitle="Book services, compare quotes and rentals"
          current={currentRole === 'CUSTOMER'}
          loading={switching === 'CUSTOMER'}
          onPress={() => changeRole('CUSTOMER')}
        />
        <RoleRow
          icon={<Wrench size={20} color={v3.colors.ink} weight="bold" />}
          title="Tasker"
          subtitle="Find nearby work and earn with your skills"
          current={currentRole === 'TASKER'}
          loading={switching === 'TASKER'}
          onPress={() => changeRole('TASKER')}
        />
        <RoleRow
          icon={<Buildings size={20} color={v3.colors.textMuted} weight="bold" />}
          title="Company"
          subtitle="Dispatch teams, quote and manage contracts"
          current={currentRole === 'COMPANY'}
          disabled
        />

        <View style={styles.preserveCard}>
          <ShieldCheck size={18} color={v3.colors.success} weight="fill" />
          <View style={styles.preserveCopy}>
            <Text style={styles.preserveTitle}>Nothing gets deleted when you switch.</Text>
            <Text style={styles.preserveBody}>Jobs, reviews, wallet history and verification remain attached to the same MaintainEX account.</Text>
          </View>
        </View>

        <View style={styles.quickBlock}>
          <Text style={styles.quickTitle}>Quick switch</Text>
          <Text style={styles.quickBody}>You can return to Customer mode anytime from Account → Settings.</Text>
        </View>

        <View style={styles.bottom}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => currentRole === 'CUSTOMER' ? router.back() : changeRole('CUSTOMER')}
            activeOpacity={0.82}
            disabled={!!switching}
          >
            <Text style={styles.primaryButtonText}>{currentRole === 'CUSTOMER' ? 'Stay in Customer mode' : 'Switch to Customer mode'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AuthShell>
  )
}

function RoleRow({ icon, title, subtitle, current, loading, onPress, disabled = false }: {
  icon: React.ReactNode
  title: string
  subtitle: string
  current?: boolean
  loading?: boolean
  onPress?: () => void
  disabled?: boolean
}) {
  return (
    <TouchableOpacity style={[styles.roleRow, current && styles.roleRowCurrent, disabled && styles.roleRowDisabled]} onPress={onPress} disabled={disabled || loading} activeOpacity={0.72}>
      <View style={styles.iconCircle}>{icon}</View>
      <View style={styles.roleCopy}>
        <Text style={[styles.roleTitle, disabled && styles.disabledText]}>{title}</Text>
        <Text style={styles.roleSubtitle}>{subtitle}</Text>
      </View>
      {current ? <View style={styles.currentPill}><Text style={styles.currentPillText}>CURRENT</Text></View> : <CaretRight size={18} color={disabled ? v3.colors.textMuted : v3.colors.ink} />}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 18, paddingTop: 8 },
  title: { fontSize: 24, lineHeight: 29, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  subtitle: { marginTop: 6, marginBottom: 18, fontSize: 10.5, lineHeight: 16, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  currentEyebrow: { marginBottom: 7, fontSize: 8.4, fontFamily: 'Outfit_900Black', color: v3.colors.amberDark, letterSpacing: 0.45 },
  roleRow: { minHeight: 74, borderRadius: 17, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, marginBottom: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  roleRowCurrent: { borderColor: v3.colors.ink },
  roleRowDisabled: { opacity: 0.52 },
  iconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F1F1', alignItems: 'center', justifyContent: 'center' },
  roleCopy: { flex: 1 },
  roleTitle: { fontSize: 12, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  roleSubtitle: { marginTop: 3, fontSize: 8.8, lineHeight: 13, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  disabledText: { color: v3.colors.textSecondary },
  currentPill: { minHeight: 24, paddingHorizontal: 9, borderRadius: 12, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  currentPillText: { fontSize: 7.8, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.paper },
  preserveCard: { marginTop: 8, minHeight: 92, borderRadius: 17, backgroundColor: v3.colors.successSoft, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  preserveCopy: { flex: 1 },
  preserveTitle: { fontSize: 10.5, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  preserveBody: { marginTop: 5, fontSize: 8.8, lineHeight: 14, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  quickBlock: { marginTop: 18 },
  quickTitle: { fontSize: 13, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  quickBody: { marginTop: 5, fontSize: 9.2, lineHeight: 14, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  bottom: { flex: 1, justifyContent: 'flex-end', paddingBottom: 16 },
  primaryButton: { height: 52, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 12.5, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.paper },
})
