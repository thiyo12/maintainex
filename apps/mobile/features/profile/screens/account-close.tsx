import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { accountLifecycle, type AccountClosurePreflight } from '@/api/account'
import { useAuth } from '@/features/auth/context/auth'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'

function money(minor: string, currency: string) {
  const amount = Number(minor || 0) / 100
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0)
  } catch {
    return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString() : '0'}`
  }
}

export default function CloseAccountScreen() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { logout } = useAuth()
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [preflight, setPreflight] = useState<AccountClosurePreflight | null>(null)
  const [confirmation, setConfirmation] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const response = await accountLifecycle.closurePreflight()
      setPreflight(response.preflight)
    } catch (error: any) {
      Alert.alert('Unable to check account', error?.message || 'Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const groupedDebt = useMemo(() => {
    const byCurrency = new Map<string, number>()
    for (const item of preflight?.outstandingCommission || []) {
      byCurrency.set(
        item.currency,
        (byCurrency.get(item.currency) || 0) + Number(item.amountMinor || 0),
      )
    }
    return [...byCurrency.entries()].map(([currency, amountMinor]) => ({
      currency,
      amountMinor,
    }))
  }, [preflight])

  const close = () => {
    if (!preflight?.canClose) {
      Alert.alert(
        'Account cannot close yet',
        'Resolve the listed jobs, disputes, payouts, or payment obligations first.',
      )
      return
    }
    if (confirmation.trim().toUpperCase() !== 'CLOSE ACCOUNT') {
      Alert.alert('Confirmation required', 'Type CLOSE ACCOUNT exactly to continue.')
      return
    }

    Alert.alert(
      'Close your MaintainEX account?',
      preflight.closesWithBalance
        ? 'Your login will close, but outstanding MaintainEX commission and identity/audit records will remain attached to your verified provider identity.'
        : 'Your login will close. Required financial, safety, identity and audit records will be retained.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close account',
          style: 'destructive',
          onPress: async () => {
            setClosing(true)
            try {
              await accountLifecycle.close('CLOSE ACCOUNT')
              try {
                await logout()
              } catch {
                // Server sessions are already revoked by account closure.
              }
              router.replace('/(auth)/welcome')
            } catch (error: any) {
              const serverPreflight = error?.body?.preflight
              if (serverPreflight) setPreflight(serverPreflight)
              Alert.alert(
                'Account not closed',
                error?.message || 'Please resolve the listed obligations and try again.',
              )
            } finally {
              setClosing(false)
            }
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Close account</Text>
        <TouchableOpacity style={styles.refresh} onPress={load} disabled={loading}>
          <Ionicons name="refresh" size={19} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.amber} />
          <Text style={styles.loadingText}>Checking jobs, payments and account obligations…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.warningCard}>
            <Ionicons name="warning-outline" size={24} color={colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>This closes access, not required records</Text>
              <Text style={styles.warningText}>
                MaintainEX keeps required job, finance, dispute, safety, KYC and audit records. Provider commission cannot be erased by closing a login.
              </Text>
            </View>
          </View>

          {!!preflight?.blockers.length && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Resolve before closing</Text>
              <Text style={styles.cardText}>
                These items still need an active account or operator resolution.
              </Text>
              <View style={styles.list}>
                {preflight.blockers.map(item => (
                  <View key={item.code} style={styles.row}>
                    <View style={styles.rowIcon}>
                      <Ionicons name="lock-closed-outline" size={17} color={colors.error} />
                    </View>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    <Text style={styles.rowValue}>{item.count}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {groupedDebt.length > 0 && (
            <View style={[styles.card, styles.debtCard]}>
              <Text style={styles.cardTitle}>MaintainEX commission still due</Text>
              <Text style={styles.cardText}>
                You may close the login after other blockers are cleared. This amount remains attached to your durable verified provider identity and can require review if you register again.
              </Text>
              {groupedDebt.map(item => (
                <View key={item.currency} style={styles.debtRow}>
                  <Text style={styles.debtCurrency}>{item.currency}</Text>
                  <Text style={styles.debtValue}>
                    {money(String(item.amountMinor), item.currency)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {preflight?.canClose && (
            <View style={styles.card}>
              <View style={styles.readyRow}>
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.readyTitle}>Account is eligible to close</Text>
                  <Text style={styles.cardText}>
                    Type CLOSE ACCOUNT below. All current sessions will be revoked immediately.
                  </Text>
                </View>
              </View>

              <TextInput
                value={confirmation}
                onChangeText={setConfirmation}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="Type CLOSE ACCOUNT"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />

              <TouchableOpacity
                style={[
                  styles.closeButton,
                  (closing || confirmation.trim().toUpperCase() !== 'CLOSE ACCOUNT') &&
                    styles.closeButtonDisabled,
                ]}
                disabled={closing || confirmation.trim().toUpperCase() !== 'CLOSE ACCOUNT'}
                onPress={close}
              >
                {closing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={19} color="#fff" />
                    <Text style={styles.closeButtonText}>Close my account</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {!preflight?.canClose && (
            <TouchableOpacity style={styles.refreshButton} onPress={load}>
              <Text style={styles.refreshButtonText}>Check again</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      height: 58,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.white,
    },
    back: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
    },
    refresh: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
    },
    headerTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.ink },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    loadingText: {
      marginTop: 12,
      fontSize: 13,
      fontFamily: fonts.body,
      color: colors.muted,
      textAlign: 'center',
    },
    content: { padding: 20, paddingBottom: 48, gap: 14 },
    warningCard: {
      flexDirection: 'row',
      gap: 12,
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.error,
    },
    warningTitle: { fontSize: 15, fontFamily: fonts.headingBold, color: colors.ink },
    warningText: {
      marginTop: 5,
      fontSize: 12,
      lineHeight: 18,
      fontFamily: fonts.body,
      color: colors.muted,
    },
    card: {
      padding: 17,
      borderRadius: 16,
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
    },
    debtCard: { borderColor: colors.amber },
    cardTitle: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.ink },
    cardText: {
      marginTop: 5,
      fontSize: 12,
      lineHeight: 18,
      fontFamily: fonts.body,
      color: colors.muted,
    },
    list: { marginTop: 12, gap: 8 },
    row: {
      minHeight: 46,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 12,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
    },
    rowIcon: { width: 24, alignItems: 'center' },
    rowLabel: { flex: 1, fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink },
    rowValue: { fontSize: 14, fontFamily: fonts.headingBold, color: colors.error },
    debtRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    debtCurrency: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.muted },
    debtValue: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.error },
    readyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    readyTitle: { fontSize: 15, fontFamily: fonts.headingBold, color: colors.ink },
    input: {
      marginTop: 16,
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      color: colors.ink,
      backgroundColor: colors.background,
      fontFamily: fonts.bodyMedium,
    },
    closeButton: {
      marginTop: 12,
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: colors.error,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    closeButtonDisabled: { opacity: 0.45 },
    closeButtonText: { color: '#fff', fontSize: 14, fontFamily: fonts.headingBold },
    refreshButton: {
      minHeight: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.white,
    },
    refreshButtonText: { color: colors.ink, fontSize: 14, fontFamily: fonts.bodyMedium },
  })
