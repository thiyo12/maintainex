import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { User, Wrench, Buildings } from 'phosphor-react-native'
import { v3 } from '../../theme/v3/tokens'
import AuthShell from '../../components/v3/AuthShell'
import V3NavBar from '../../components/v3/V3NavBar'
import V3RoleCard from '../../components/v3/V3RoleCard'
import V3Button from '../../components/v3/V3Button'

export default function RoleSelectScreen() {
  const router = useRouter()
  const [selected, setSelected] = useState<'CUSTOMER' | 'TASKER' | null>(null)

  const handleContinue = () => {
    if (!selected) return
    router.push({ pathname: '/(auth)/register', params: { role: selected } })
  }

  return (
    <AuthShell bg={v3.colors.canvas}>
      <V3NavBar title="Select role" onBack={() => router.back()} />

      <View style={styles.content}>
        <Text style={styles.title}>How will you use MaintainEX?</Text>
        <Text style={styles.subtitle}>You can switch later from your profile.</Text>

        <View style={styles.roles}>
          <V3RoleCard
            icon={<User size={18} color={v3.colors.amberDark} weight="fill" />}
            iconBg={v3.colors.amberSoft}
            title="I need services"
            subtitle="Post jobs and book trusted professionals."
            badge="Customer"
            badgeColor={v3.colors.amberDark}
            badgeBg={v3.colors.amberSoft}
            selected={selected === 'CUSTOMER'}
            onPress={() => setSelected('CUSTOMER')}
          />
          <V3RoleCard
            icon={<Wrench size={18} color={v3.colors.info} weight="fill" />}
            iconBg={v3.colors.infoSoft}
            title="I offer services"
            subtitle="Earn with your skills as a tasker."
            badge="Tasker"
            badgeColor={v3.colors.info}
            badgeBg={v3.colors.infoSoft}
            selected={selected === 'TASKER'}
            onPress={() => setSelected('TASKER')}
          />
          <V3RoleCard
            icon={<Buildings size={18} color={v3.colors.textMuted} weight="fill" />}
            iconBg={v3.colors.surfaceGray}
            title="I manage a team"
            subtitle="Assign jobs and grow your business."
            badge="Coming soon"
            badgeColor={v3.colors.textMuted}
            badgeBg={v3.colors.surfaceGray}
            disabled
          />
        </View>

        <V3Button
          label="Continue"
          onPress={handleContinue}
          disabled={!selected}
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
