import { useRef, useEffect } from 'react'
import { View, Text, StyleSheet, Animated, Easing, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { HourglassSimple, CheckCircle, Info } from 'phosphor-react-native'
import { useRouter } from 'expo-router'
import PressableScale from '../../components/ui/PressableScale'

export default function PendingApprovalScreen() {
  const router = useRouter()
  const rotateAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    loop.start()
    return () => loop.stop()
  }, [])

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  })

  const steps = [
    'Identity verification',
    'Skills & experience check',
    'Profile quality review',
  ]

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[styles.iconWrap, { transform: [{ rotate: rotation }] }]}>
          <HourglassSimple size={64} color="#F5A623" weight="fill" />
        </Animated.View>

        <Text style={styles.title}>Profile Under Review</Text>
        <Text style={styles.subtitle}>Our team will verify your profile within 24 hours</Text>
        <Text style={styles.hint}>You'll receive a notification once approved</Text>

        <View style={styles.stepsCard}>
          {steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <CheckCircle size={18} color="#F5A623" weight="fill" />
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={styles.infoBox}>
          <Info size={16} color="#F5A623" weight="fill" />
          <Text style={styles.infoText}>
            You can browse the app while waiting. You'll be notified when ready to accept jobs.
          </Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <PressableScale scaleTo={0.97} onPress={() => router.replace('/(customer)')} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Browse the App</Text>
        </PressableScale>
        <PressableScale
          scaleTo={0.97}
          onPress={() => Linking.openURL('https://wa.me/94770867609')}
          style={styles.secondaryBtn}
        >
          <Text style={styles.secondaryBtnText}>Contact Support</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },

  iconWrap: { marginBottom: 24 },

  title: { fontSize: 26, fontFamily: 'Outfit_700Bold', color: '#FFFFFF', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, fontFamily: 'Outfit_400Regular', color: '#B3B3B3', textAlign: 'center', marginBottom: 4 },
  hint: { fontSize: 14, fontFamily: 'Outfit_400Regular', color: '#6B6B6B', textAlign: 'center', marginBottom: 32 },

  stepsCard: {
    width: '100%', backgroundColor: '#1C1C1C', borderRadius: 16,
    padding: 20, gap: 14, marginBottom: 20,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepText: { fontSize: 14, fontFamily: 'Outfit_500Medium', color: '#FFFFFF' },

  infoBox: {
    flexDirection: 'row', width: '100%', backgroundColor: 'rgba(245,166,35,0.12)',
    borderRadius: 16, padding: 16, gap: 10, alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: 'Outfit_400Regular', color: '#B3B3B3', lineHeight: 18 },

  bottom: { paddingHorizontal: 32, paddingBottom: 24, gap: 12 },
  primaryBtn: {
    height: 56, borderRadius: 16, backgroundColor: '#F5A623',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#F5A623', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  primaryBtnText: { fontSize: 17, fontFamily: 'Outfit_700Bold', color: '#0D0D0D' },
  secondaryBtn: {
    height: 56, borderRadius: 16, backgroundColor: 'transparent',
    borderWidth: 1, borderColor: '#F5A623',
    justifyContent: 'center', alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 17, fontFamily: 'Outfit_700Bold', color: '#F5A623' },
})
