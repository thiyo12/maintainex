import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../lib/auth'
import { v2Team } from '../lib/api-v2'
import { useColors } from '../lib/ThemeContext'
import { fonts } from '../lib/fonts'

const PENDING_INVITE_KEY = 'pending_company_invite'

export default function CompanyInviteScreen() {
  const router = useRouter()
  const colors = useColors()
  const styles = makeStyles(colors)
  const params = useLocalSearchParams<{ token?: string }>()
  const { isAuthenticated, isLoading, refreshUser } = useAuth()
  const [token, setToken] = useState('')
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    ;(async () => {
      const incoming = typeof params.token === 'string' ? params.token.trim() : ''
      if (incoming) {
        setToken(incoming)
        await SecureStore.setItemAsync(PENDING_INVITE_KEY, incoming)
        return
      }
      const saved = await SecureStore.getItemAsync(PENDING_INVITE_KEY)
      if (saved) setToken(saved)
    })().catch(() => {})
  }, [params.token])

  const handleSignIn = async () => {
    if (token) await SecureStore.setItemAsync(PENDING_INVITE_KEY, token)
    router.push('/(auth)/welcome')
  }

  const handleAccept = async () => {
    if (!token) {
      Alert.alert('Invalid invite', 'This company invitation link is missing or invalid.')
      return
    }

    setAccepting(true)
    try {
      const result = await v2Team.acceptInvite(token)
      await SecureStore.deleteItemAsync(PENDING_INVITE_KEY)
      await refreshUser()
      Alert.alert(
        'Invitation accepted',
        `You joined ${result.teamMember?.companyName || 'the company'} in MaintainEX.`,
        [{ text: 'Open Assignments', onPress: () => router.replace('/(company)/(tabs)/dispatch') }]
      )
    } catch (error: any) {
      Alert.alert('Could not accept invitation', error?.message || 'Please ask the company to send a new invitation.')
    } finally {
      setAccepting(false)
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.amber} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.icon}>
          <Ionicons name="business-outline" size={34} color={colors.amberDark} />
        </View>
        <Text style={styles.title}>Company Team Invitation</Text>
        <Text style={styles.body}>
          This secure invitation links your MaintainEX account to a company team. Only the email or phone number the company invited can claim it.
        </Text>

        {!isAuthenticated ? (
          <>
            <Text style={styles.note}>Sign in or register with the invited email/phone first. The invite will be kept for you.</Text>
            <TouchableOpacity style={styles.primary} onPress={handleSignIn}>
              <Text style={styles.primaryText}>Sign In to Continue</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.primary, accepting && { opacity: 0.6 }]}
            onPress={handleAccept}
            disabled={accepting}
          >
            {accepting ? <ActivityIndicator color="#111" /> : <Text style={styles.primaryText}>Accept Company Invitation</Text>}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.secondary} onPress={() => router.replace('/')}>
          <Text style={styles.secondaryText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.amberBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.headingBold,
    color: colors.ink,
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.body,
    color: colors.muted,
    marginBottom: 18,
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    marginBottom: 16,
  },
  primary: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: 15,
    fontFamily: fonts.headingBold,
    color: '#111',
  },
  secondary: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.muted,
  },
})
