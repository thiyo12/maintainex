import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { User, Wrench, ArrowRight } from 'phosphor-react-native'
import PressableScale from '../../components/ui/PressableScale'

export default function WelcomeScreen() {
  const router = useRouter()
  const titleOp = useRef(new Animated.Value(0)).current
  const titleY = useRef(new Animated.Value(14)).current
  const cardsOp = useRef(new Animated.Value(0)).current
  const cardsY = useRef(new Animated.Value(20)).current
  const footerOp = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(titleOp, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardsOp, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(cardsY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.delay(150),
      Animated.timing(footerOp, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topSection}>
        <Animated.Text style={[styles.heading, { opacity: titleOp, transform: [{ translateY: titleY }] }]}>
          What are you{'\n'}looking for?
        </Animated.Text>
        <Animated.Text style={[styles.headingSub, { opacity: titleOp, transform: [{ translateY: titleY }] }]}>
          Choose how you want to use MΛINTΛINEX
        </Animated.Text>
      </View>

      <Animated.View style={[styles.cardsSection, { opacity: cardsOp, transform: [{ translateY: cardsY }] }]}>
        <PressableScale
          scaleTo={0.97}
          onPress={() => router.push({ pathname: '/(auth)/register', params: { role: 'CUSTOMER' } })}
        >
          <View style={styles.findCard}>
            <View style={styles.findIconCircle}>
              <User size={24} color="#0D0D0D" weight="fill" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.findTitle}>Find a service</Text>
              <Text style={styles.findSub}>Book trusted professionals for cleaning, repairs, home maintenance and more.</Text>
            </View>
            <ArrowRight size={20} color="#0D0D0D" weight="bold" />
          </View>
        </PressableScale>

        <PressableScale
          scaleTo={0.97}
          onPress={() => router.push({ pathname: '/(auth)/register', params: { role: 'TASKER' } })}
        >
          <View style={styles.offerCard}>
            <View style={styles.offerIconCircle}>
              <Wrench size={24} color="#F5A623" weight="fill" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.offerTitle}>Offer a service</Text>
              <Text style={styles.offerSub}>Earn money with your skills. Set your own hours and grow your business.</Text>
            </View>
            <ArrowRight size={20} color="#F5A623" weight="bold" />
          </View>
        </PressableScale>
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: footerOp }]}>
        <View style={styles.signInRow}>
          <Text style={styles.signInLabel}>Already have an account? </Text>
          <PressableScale onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.signInLink}>Sign In</Text>
          </PressableScale>
        </View>

        <View style={styles.termsRow}>
          <Text style={styles.termsText}>By continuing, you agree to our </Text>
          <Text style={styles.termsLink}>Terms of Service</Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D', paddingHorizontal: 24 },

  topSection: {
    flex: 2, justifyContent: 'flex-end', paddingBottom: 12,
  },
  heading: {
    fontSize: 30, fontFamily: 'Outfit_800ExtraBold', color: '#FFFFFF',
    lineHeight: 36, marginBottom: 8,
  },
  headingSub: {
    fontSize: 15, fontFamily: 'Outfit_400Regular', color: '#B3B3B3',
  },

  cardsSection: {
    flex: 5, justifyContent: 'center', gap: 24,
  },

  findCard: {
    flexDirection: 'row', alignItems: 'center', padding: 18,
    backgroundColor: '#F5A623', borderRadius: 20,
    shadowColor: '#F5A623', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 14, elevation: 6,
  },
  findIconCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(13,13,13,0.15)',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  cardContent: { flex: 1 },
  findTitle: { fontSize: 18, fontFamily: 'Outfit_700Bold', color: '#0D0D0D', marginBottom: 3 },
  findSub: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: 'rgba(13,13,13,0.6)', lineHeight: 18 },

  offerCard: {
    flexDirection: 'row', alignItems: 'center', padding: 18,
    backgroundColor: '#1C1C1C', borderWidth: 1.5, borderColor: '#2E2E2E',
    borderRadius: 20,
  },
  offerIconCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(245,166,35,0.12)',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  offerTitle: { fontSize: 18, fontFamily: 'Outfit_700Bold', color: '#FFFFFF', marginBottom: 3 },
  offerSub: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: '#B3B3B3', lineHeight: 18 },

  footer: {
    flex: 1, justifyContent: 'flex-end', paddingBottom: 12, alignItems: 'center',
  },

  signInRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 16,
  },
  signInLabel: { fontSize: 15, fontFamily: 'Outfit_400Regular', color: '#B3B3B3' },
  signInLink: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: '#F5A623' },

  termsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  termsText: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: '#6B6B6B' },
  termsLink: { fontSize: 12, fontFamily: 'Outfit_600SemiBold', color: '#F5A623' },
})
