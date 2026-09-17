import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import LottieView from 'lottie-react-native'
import { Icon } from 'phosphor-react-native'
import PressableScale from './PressableScale'

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
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!lottieUrl) return
    setFailed(false)
    setLoaded(false)
    const timeout = setTimeout(() => setFailed(true), 4000)
    return () => clearTimeout(timeout)
  }, [lottieUrl])

  return (
    <View style={styles.wrap}>
      <View style={styles.animBox}>
        {!loaded || failed ? (
          <View style={styles.fallback}>
            {FallbackIcon ? <FallbackIcon size={iconSize} color="#6F6B6B" weight="duotone" /> : null}
          </View>
        ) : null}
        {lottieUrl && !failed ? (
          <LottieView
            source={{ uri: lottieUrl }}
            style={styles.lottie}
            autoPlay
            loop
            speed={1}
            onLoad={() => setLoaded(true)}
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
  fallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  lottie: { width: 140, height: 140 },
  title: { fontSize: 20, fontFamily: 'Outfit_600SemiBold', color: '#FFFFFF', textAlign: 'center' },
  subtitle: { fontSize: 16, fontFamily: 'Outfit_400Regular', color: '#B3B3B3', textAlign: 'center' },
  ctaWrap: { marginTop: 16, alignSelf: 'stretch', alignItems: 'center' },
  cta: {
    backgroundColor: '#F5A623',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 9999,
  },
  ctaText: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: '#0D0D0D' },
})
