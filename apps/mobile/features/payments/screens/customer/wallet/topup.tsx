import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useColors } from '@/lib/ThemeContext'
import { fonts } from '@/lib/fonts'

/**
 * Customer wallet top-up is intentionally unavailable until a canonical,
 * reconciled funding flow is implemented. Do not expose placeholder bank
 * details or retired payment providers.
 */
export default function TopUpScreen() {
  const colors = useColors()
  const router = useRouter()
  const styles = makeStyles(colors)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={32} color={colors.amberDark} />
        </View>
        <Text style={styles.title}>Wallet top-up is not available yet</Text>
        <Text style={styles.body}>
          MaintainEX will enable wallet funding only after the payment, ledger,
          reconciliation and refund lifecycle is fully supported. No payment
          details are required on this screen.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Back to wallet</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.amberBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontFamily: fonts.headingBold,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.muted,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 22,
  },
  button: {
    width: '100%',
    backgroundColor: colors.amber,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
  },
})
