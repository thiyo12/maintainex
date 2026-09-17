import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Buildings, CaretRight, House, Wrench } from 'phosphor-react-native'
import { useRouter } from 'expo-router'

import { v3 } from '../../theme/v3/tokens'
import AuthShell from '../../components/v3/AuthShell'
import V3NavBar from '../../components/v3/V3NavBar'

export default function RoleSelectScreen() {
  const router = useRouter()

  return (
    <AuthShell bg={v3.colors.canvas}>
      <V3NavBar title="Choose your experience" onBack={() => router.back()} />
      <View style={styles.content}>
        <Text style={styles.title}>How will you use MaintainEX?</Text>
        <Text style={styles.subtitle}>You can switch later from Account.</Text>

        <RoleRow
          icon={<House size={22} color={v3.colors.ink} weight="bold" />}
          title="I need something done"
          subtitle="Post jobs, compare offers, hire taskers"
          onPress={() => router.push({ pathname: '/(auth)/register', params: { role: 'CUSTOMER' } } as any)}
        />
        <RoleRow
          icon={<Wrench size={21} color={v3.colors.ink} weight="bold" />}
          title="I want to earn"
          subtitle="Find jobs and send quotes"
          onPress={() => router.push({ pathname: '/(auth)/register', params: { role: 'TASKER' } } as any)}
        />
        <RoleRow
          icon={<Buildings size={21} color={v3.colors.textMuted} weight="bold" />}
          title="I run a company"
          subtitle="Manage teams, dispatch and contracts · registration unavailable"
          disabled
        />

        <Text style={styles.companyNote}>Existing company accounts can sign in normally. New company self-registration is disabled until the company onboarding backend is available.</Text>
      </View>
    </AuthShell>
  )
}

function RoleRow({ icon, title, subtitle, onPress, disabled = false }: { icon: React.ReactNode; title: string; subtitle: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity style={[styles.row, disabled && styles.rowDisabled]} onPress={onPress} disabled={disabled} activeOpacity={0.72}>
      <View style={styles.iconCircle}>{icon}</View>
      <View style={styles.copy}>
        <Text style={[styles.rowTitle, disabled && styles.disabledText]}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <CaretRight size={20} color={disabled ? v3.colors.textMuted : v3.colors.ink} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: { fontSize: 26, lineHeight: 31, fontFamily: 'Outfit_900Black', color: v3.colors.ink },
  subtitle: { marginTop: 6, marginBottom: 24, fontSize: 12, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  row: { minHeight: 84, borderRadius: 18, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, paddingHorizontal: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowDisabled: { opacity: 0.56 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F1F1', alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  rowTitle: { fontSize: 14, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  rowSubtitle: { marginTop: 4, fontSize: 10.5, lineHeight: 15, fontFamily: 'Outfit_600SemiBold', color: v3.colors.textSecondary },
  disabledText: { color: v3.colors.textSecondary },
  companyNote: { marginTop: 2, fontSize: 9, lineHeight: 14, fontFamily: 'Outfit_500Medium', color: v3.colors.textMuted },
})
