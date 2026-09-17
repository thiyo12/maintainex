import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CheckCircle, PaperPlaneTilt } from 'phosphor-react-native'
import { v3 } from '../../../../theme/v3/tokens'

export default function BookingConfirmed() {
  const router = useRouter()
  const { jobId, taskerId } = useLocalSearchParams<{ jobId: string; taskerId: string }>()

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.center}>
        {/* ═══ Check Animation ═══ */}
        <View style={styles.checkCircle}>
          <CheckCircle size={48} color={v3.colors.success} weight="fill" />
        </View>

        {/* ═══ Badge ═══ */}
        <View style={styles.badge}>
          <PaperPlaneTilt size={12} color={v3.colors.paper} weight="fill" />
          <Text style={styles.badgeText}>REQUEST SENT</Text>
        </View>

        {/* ═══ Title ═══ */}
        <Text style={styles.title}>Booking Confirmed</Text>

        {/* ═══ Subtitle ═══ */}
        <Text style={styles.subtitle}>
          Your booking request has been sent to the provider. They will confirm shortly.
        </Text>

        {/* ═══ CTA ═══ */}
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => router.replace('/(customer)/(tabs)')}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },

  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: v3.colors.surfaceWhite,
    borderWidth: 1,
    borderColor: v3.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: v3.colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: v3.radius.full,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.paper,
    letterSpacing: 0.8,
  },

  title: {
    fontSize: 26,
    fontFamily: 'Outfit_900Black',
    color: v3.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    color: v3.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },

  ctaBtn: {
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.full,
    height: 54,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.paper,
  },
})
