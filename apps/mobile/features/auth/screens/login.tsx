import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/features/auth/context/auth'
import { v3 } from '@/theme/v3/tokens'
import CountryPicker, { COUNTRIES, Country } from '@/components/ui/CountryPicker'
import V3Button from '@/components/v3/V3Button'

export default function LoginScreen() {
  const router = useRouter()
  const { sendLoginOtp } = useAuth()
  const [country, setCountry] = useState<Country>(COUNTRIES[0])
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)

  const phoneDigits = phone.replace(/\D/g, '')
  const localDigits = phoneDigits.replace(/^0+/, '')
  const fullPhone = `${country.dial}${localDigits}`
  const canSend = phoneDigits.length >= 7

  const handleContinue = async () => {
    if (!canSend) return
    setSending(true)
    try {
      await sendLoginOtp(fullPhone)
      router.push({
        pathname: '/(auth)/otp',
        params: {
          phone: fullPhone,
          maskedPhone: maskPhone(fullPhone),
        },
      })
    } catch (err: any) {
      let message = err?.message || 'Something went wrong'
      try { message = JSON.parse(message).error || message } catch {}
      Alert.alert('Error', message)
    } finally {
      setSending(false)
    }
  }

  const maskPhone = (num: string) => {
    const d = num.replace(/\D/g, '')
    if (d.length < 6) return num
    const prefix = d.slice(0, d.length - 4)
    const suffix = d.slice(-2)
    return `${prefix}•••${suffix}`
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.markWrap}>
          <Image source={require('@/assets/logo.png')} style={{ width: 60, height: 60 }} resizeMode="contain" />
        </View>
        <Text style={styles.brand}>MΛINTΛINEX</Text>
      </View>

      <View style={styles.card}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Use your mobile number. MaintainEX opens the right Customer, Individual, or Company workspace automatically.</Text>

          <Text style={styles.label}>Mobile number</Text>
          <View style={styles.phoneRow}>
            <CountryPicker selected={country} onChange={setCountry} />
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={setPhone}
              placeholder={country.code === 'LK' ? '77 123 4567' : '416 234 5678'}
              placeholderTextColor={v3.colors.textPlaceholder}
              keyboardType="phone-pad"
              maxLength={15}
            />
          </View>

          <V3Button
            label="Continue"
            onPress={handleContinue}
            loading={sending}
            disabled={!canSend}
          />

          <Text style={styles.orText}>or</Text>

          <TouchableOpacity
            style={styles.socialBtn}
            disabled
            accessibilityState={{ disabled: true }}
            accessibilityLabel="Continue with Apple or Google — coming soon"
          >
            <Text style={styles.socialBtnText}>Continue with Apple / Google</Text>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Coming soon</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerLabel}>New to MaintainEX?</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/role-select')}>
              <Text style={styles.footerLink}>Create an account</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.legal}>By continuing you agree to Terms & Privacy.</Text>
        </ScrollView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.paper },
  header: {
    height: 275,
    backgroundColor: v3.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  markWrap: { marginBottom: 16 },
  brand: {
    fontSize: 17,
    fontFamily: 'Outfit_900Black',
    fontWeight: '900',
    color: v3.colors.paper,
    letterSpacing: 0.8,
  },
  card: {
    flex: 1,
    backgroundColor: v3.colors.paper,
    borderTopLeftRadius: v3.radius.xxl,
    borderTopRightRadius: v3.radius.xxl,
    marginTop: -30,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 28,
    gap: 0,
  },
  title: {
    fontSize: 26,
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
    marginBottom: 24,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    fontWeight: '800',
    color: '#4F4F4F',
    marginBottom: 6,
  },
  phoneRow: {
    flexDirection: 'row',
    height: v3.components.input.height,
    borderRadius: v3.components.input.borderRadius,
    backgroundColor: v3.colors.canvas,
    borderWidth: 1,
    borderColor: v3.colors.line,
    overflow: 'hidden',
    marginBottom: 20,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 14,
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    fontWeight: '600',
    color: v3.colors.textPrimary,
  },
  orText: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    fontWeight: '700',
    color: v3.colors.textSecondary,
    textAlign: 'center',
    marginVertical: 16,
  },
  socialBtn: {
    height: v3.components.ctaSmall.height,
    borderRadius: v3.components.ctaSmall.borderRadius,
    borderWidth: 1,
    borderColor: v3.colors.line,
    backgroundColor: v3.colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  socialBtnText: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    fontWeight: '700',
    color: v3.colors.textPrimary,
  },
  comingSoonBadge: {
    position: 'absolute',
    top: -8,
    right: 12,
    backgroundColor: v3.colors.amberSoft,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  comingSoonText: {
    fontSize: 8,
    fontFamily: 'Outfit_700Bold',
    fontWeight: '800',
    color: v3.colors.amberDark,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
    gap: 4,
  },
  footerLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    fontWeight: '600',
    color: v3.colors.textSecondary,
  },
  footerLink: {
    fontSize: 12,
    fontFamily: 'Outfit_800ExtraBold',
    fontWeight: '800',
    color: v3.colors.textPrimary,
  },
  legal: {
    fontSize: 9,
    fontFamily: 'Outfit_500Medium',
    fontWeight: '600',
    color: v3.colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
  },
})
