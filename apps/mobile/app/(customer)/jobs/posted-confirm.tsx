import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const colors = {
  green: '#10B981',
  purple: '#7C3AED',
  dark: '#1A1A2E',
  gray: '#6B7280',
  primary: '#F59E0B',
  white: '#FFFFFF',
}

export default function JobPostedConfirmation() {
  const router = useRouter()
  const scaleAnim = useRef(new Animated.Value(0)).current
  const countAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 60,
      useNativeDriver: true,
    }).start()

    Animated.timing(countAnim, {
      toValue: 24,
      duration: 1500,
      useNativeDriver: false,
    }).start()
  }, [])

  const count = countAnim.interpolate({
    inputRange: [0, 24],
    outputRange: [0, 24],
  })

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.circle, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.checkmark}>✓</Text>
      </Animated.View>
      <Text style={styles.heading}>Job posted successfully</Text>
      <Text style={styles.subtitle}>Taskers and companies near you have been notified</Text>
      <Animated.Text style={styles.counter}>{Math.round(count as any)}</Animated.Text>
      <Text style={styles.counterLabel}>workers notified</Text>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(customer)/jobs/quotes')}>
          <Text style={styles.primaryBtnText}>View my job</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.outlineBtn} onPress={() => router.replace('/(customer)')}>
          <Text style={styles.outlineBtnText}>Go to home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  circle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.green,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  checkmark: { fontSize: 40, color: colors.white, fontWeight: '700' },
  heading: { fontSize: 26, fontWeight: '800', color: colors.dark, textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, color: colors.gray, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  counter: {
    fontSize: 56,
    fontWeight: '800',
    color: colors.purple,
    marginBottom: 4,
  },
  counterLabel: { fontSize: 14, color: colors.gray, fontWeight: '500', marginBottom: 48 },
  buttons: { width: '100%', gap: 14 },
  primaryBtn: {
    backgroundColor: colors.purple,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
  outlineBtn: {
    backgroundColor: colors.white,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  outlineBtnText: { fontSize: 17, fontWeight: '700', color: colors.dark },
})
