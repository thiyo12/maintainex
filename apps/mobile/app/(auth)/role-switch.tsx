import { useState } from 'react'
import { View, Text, StyleSheet, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { v3 } from '../../theme/v3/tokens'
import AuthShell from '../../components/v3/AuthShell'
import V3NavBar from '../../components/v3/V3NavBar'
import V3RoleCard from '../../components/v3/V3RoleCard'
import V3Button from '../../components/v3/V3Button'

export default function RoleSwitchScreen() {
  const { target } = useLocalSearchParams<{ target?: string }>()
  const { user, switchRole } = useAuth()
  const router = useRouter()
  const [switching, setSwitching] = useState(false)

  const currentRole = user?.role || 'CUSTOMER'
  const [selected, setSelected] = useState<'CUSTOMER' | 'TASKER' | null>(
    target === 'TASKER' ? 'TASKER' : target === 'CUSTOMER' ? 'CUSTOMER' : null
  )

  const handleSwitch = async () => {
    if (!selected || selected === currentRole) return
    setSwitching(true)
    try {
      await switchRole(selected)
      if (selected === 'TASKER') router.replace('/(tasker)')
      else router.replace('/(customer)')
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to switch role')
      setSwitching(false)
    }
  }

  return (
    <AuthShell bg={v3.colors.canvas}>
      <V3NavBar title="Switch role" onBack={() => router.back()} />

      <View style={styles.content}>
        <Text style={styles.title}>Switch your account mode</Text>
        <Text style={styles.subtitle}>You can change roles anytime.</Text>

        <View style={styles.roles}>
          <V3RoleCard
            icon={<Text style={{ fontSize: 18 }}>👤</Text>}
            iconBg={v3.colors.amberSoft}
            title="Customer mode"
            subtitle="Browse services and book taskers."
            badge={currentRole === 'CUSTOMER' ? 'Current' : 'Customer'}
            badgeColor={currentRole === 'CUSTOMER' ? v3.colors.success : v3.colors.amberDark}
            badgeBg={currentRole === 'CUSTOMER' ? '#E8FAF0' : v3.colors.amberSoft}
            selected={selected === 'CUSTOMER'}
            onPress={() => setSelected('CUSTOMER')}
          />
          <V3RoleCard
            icon={<Text style={{ fontSize: 18 }}>🛠</Text>}
            iconBg={v3.colors.infoSoft}
            title="Tasker mode"
            subtitle="Find work and earn with your skills."
            badge={currentRole === 'TASKER' ? 'Current' : 'Tasker'}
            badgeColor={currentRole === 'TASKER' ? v3.colors.success : v3.colors.info}
            badgeBg={currentRole === 'TASKER' ? '#E8FAF0' : v3.colors.infoSoft}
            selected={selected === 'TASKER'}
            onPress={() => setSelected('TASKER')}
          />
          <V3RoleCard
            icon={<Text style={{ fontSize: 18 }}>🏢</Text>}
            iconBg={v3.colors.surfaceGray}
            title="Company mode"
            subtitle="Manage team and dispatch jobs."
            badge="Coming soon"
            badgeColor={v3.colors.textMuted}
            badgeBg={v3.colors.surfaceGray}
            disabled
          />
        </View>

        <V3Button
          label="Switch role"
          onPress={handleSwitch}
          loading={switching}
          disabled={!selected || selected === currentRole}
        />
      </View>
    </AuthShell>
  )
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 18,
    gap: 0,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Outfit_900Black',
    fontWeight: '900',
    color: v3.colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    fontWeight: '600',
    color: v3.colors.textSecondary,
    marginBottom: 20,
  },
  roles: {
    flex: 1,
    gap: 12,
  },
})
