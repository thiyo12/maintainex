import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { v3 } from '../../theme/v3/tokens'

export default function WelcomeScreen() {
  const router = useRouter()
  const markOp = useRef(new Animated.Value(0)).current
  const markScale = useRef(new Animated.Value(0.9)).current
  const textOp = useRef(new Animated.Value(0)).current
  const textY = useRef(new Animated.Value(16)).current
  const heroOp = useRef(new Animated.Value(0)).current
  const heroY = useRef(new Animated.Value(20)).current
  const btnsOp = useRef(new Animated.Value(0)).current
  const btnsY = useRef(new Animated.Value(14)).current

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(markOp, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(markScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(textOp, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(textY, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(heroOp, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(heroY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.delay(150),
      Animated.parallel([
        Animated.timing(btnsOp, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(btnsY, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
    ]).start()
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topArea}>
        <Animated.View style={[styles.markWrap, { opacity: markOp, transform: [{ scale: markScale }] }]}>
          <Image source={require('../../assets/logo.png')} style={styles.mark} resizeMode="contain" />
        </Animated.View>

        <Animated.View style={[styles.brandWrap, { opacity: textOp, transform: [{ translateY: textY }] }]}>
          <Text style={styles.brand}>MΛINTΛINEX</Text>
        </Animated.View>
      </View>

      <View style={styles.midArea}>
        <Animated.View style={[styles.heroWrap, { opacity: heroOp, transform: [{ translateY: heroY }] }]}>
          <Text style={styles.heroLine1}>Get things done,</Text>
          <Text style={styles.heroLine2}>without the runaround.</Text>
          <Text style={styles.heroSub}>Book trusted people, get quotes fast, and find places to rent.</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.btnArea, { opacity: btnsOp, transform: [{ translateY: btnsY }] }]}>
        <Animated.View style={[styles.btnPrimary, { opacity: btnsOp }]}>
          <Text
            style={styles.btnPrimaryText}
            onPress={() => router.push('/(auth)/register')}
          >
            Continue
          </Text>
        </Animated.View>

        <Animated.View style={[styles.btnSecondary, { opacity: btnsOp }]}>
          <Text
            style={styles.btnSecondaryText}
            onPress={() => router.push('/(auth)/login')}
          >
            I already have an account
          </Text>
        </Animated.View>
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 24,
  },
  topArea: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
  },
  markWrap: {},
  mark: { width: 60, height: 60 },
  brandWrap: { marginTop: 16 },
  brand: {
    fontSize: 23,
    fontFamily: 'Outfit_900Black',
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  midArea: {
    flex: 4,
    justifyContent: 'center',
    paddingBottom: 20,
  },
  heroWrap: {},
  heroLine1: {
    fontSize: 30,
    fontFamily: 'Outfit_900Black',
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0,
  },
  heroLine2: {
    fontSize: 30,
    fontFamily: 'Outfit_900Black',
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0,
    marginTop: 4,
  },
  heroSub: {
    fontSize: 11.5,
    fontFamily: 'Outfit_500Medium',
    fontWeight: '600',
    color: '#B9B9B9',
    marginTop: 14,
    lineHeight: 18,
  },
  btnArea: {
    flex: 2,
    justifyContent: 'flex-end',
    paddingBottom: 24,
    gap: 14,
  },
  btnPrimary: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontSize: 13.5,
    fontFamily: 'Outfit_800ExtraBold',
    fontWeight: '850',
    color: '#000000',
  },
  btnSecondary: {
    height: 52,
    borderRadius: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    fontSize: 13.5,
    fontFamily: 'Outfit_800ExtraBold',
    fontWeight: '850',
    color: '#FFFFFF',
  },
})
