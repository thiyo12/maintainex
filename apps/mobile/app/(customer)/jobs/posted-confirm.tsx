import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Check } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'

export default function JobPostedConfirmation() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { jobId } = useLocalSearchParams()
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
      useNativeDriver: true,
    }).start()
  }, [])

  const count = countAnim.interpolate({
    inputRange: [0, 24],
    outputRange: [0, 24],
  })

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.circle, { transform: [{ scale: scaleAnim }] }]}>
        <Check size={40} color="#FFFFFF" weight="bold" />
      </Animated.View>
      <Text style={styles.heading}>{t('postJob.postedSuccess')}</Text>
      <Text style={styles.subtitle}>{t('postJob.postedDesc')}</Text>
      <Animated.Text style={styles.counter}>{Math.round(count as any)}</Animated.Text>
      <Text style={styles.counterLabel}>{t('postJob.workersNotified')}</Text>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push(`/(customer)/jobs/waiting/${jobId || ''}`)}>
          <Text style={styles.primaryBtnText}>{t('postJob.viewMyJob')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.outlineBtn} onPress={() => router.replace('/(customer)')}>
          <Text style={styles.outlineBtnText}>{t('postJob.goToHome')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  circle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#06C167',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#06C167',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  heading: { fontSize: 26, fontFamily: fonts.heading, color: '#FFFFFF', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, color: '#6F6B6B', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  counter: {
    fontSize: 56,
    fontFamily: fonts.heading,
    color: '#F5A623',
    marginBottom: 4,
  },
  counterLabel: { fontSize: 14, color: '#6F6B6B', fontFamily: fonts.bodyLight, marginBottom: 48 },
  buttons: { width: '100%', gap: 14 },
  primaryBtn: {
    backgroundColor: '#F5A623',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 17, fontFamily: fonts.bodyMedium, color: '#FFFFFF' },
  outlineBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2E2E2E',
  },
  outlineBtnText: { fontSize: 17, fontFamily: fonts.bodyMedium, color: '#0D0D0D' },
})
