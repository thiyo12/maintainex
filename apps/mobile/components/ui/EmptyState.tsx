import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import LottieView from 'lottie-react-native'
import { Icon } from 'phosphor-react-native'
import PressableScale from './PressableScale'
import { v3 } from '../../theme/v3/tokens'

interface Props {
  lottieUrl?: string | null
  title: string
  subtitle?: string
  ctaText?: string
  onCta?: () => void
  FallbackIcon?: Icon
  iconSize?: number
}

export default function EmptyState({
  lottieUrl,
  title,
  subtitle,
  ctaText,
  onCta,
  FallbackIcon,
  iconSize = 64,
}: Props) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!lottieUrl) return
    setFailed(false)
    // Remote Lottie failures are not reported consistently on every native
    // platform. Fall back after a bounded load window rather than leaving an
    // empty box forever.
    const timeout = setTimeout(() => setFailed(true), 8000)
    return () => clearTimeout(timeout)
  }, [lottieUrl])

  const showFallback = !lottieUrl || failed

  return (
    <View style={styles.wrap}>
      <View style={styles.animBox}>
        {showFallback ? (
          <View style={[StyleSheet.absoluteFill, styles.fallback]}>
            {FallbackIcon ? <FallbackIcon size={iconSize} color={v3.colors.textMuted} weight="duotone" /> : null}
          </View>
        ) : null}
        {lottieUrl && !failed ? (
          <LottieView
            source={{ uri: lottieUrl }}
            style={styles.lottie}
            autoPlay
            loop
            speed={1}
          />
        ) : null}
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {ctaText && onCta ? (
        <PressableScale onPress={onCta} scaleTo={0.96} style={styles.ctaWrap}>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>{ctaText}</Text>
          </View>
        </PressableScale>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, gap: 8 },
  animBox: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  lottie: { width: 140, height: 140 },
  title: { fontSize: 20, fontFamily: 'Outfit_700Bold', color: v3.colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 16, fontFamily: 'Outfit_400Regular', color: v3.colors.textSecondary, textAlign: 'center' },
  ctaWrap: { marginTop: 16, alignSelf: 'stretch', alignItems: 'center' },
  cta: {
    backgroundColor: v3.colors.ink,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: v3.radius.full,
  },
  ctaText: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: v3.colors.paper },
})
