import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import LottieView from 'lottie-react-native'
import { Icon } from 'phosphor-react-native'
import PressableScale from './PressableScale'
import { useColors } from '../../lib/theme'
import { borderRadius, fontSizes, lineHeights, spacing } from '../../lib/tokens'
import { fonts } from '../../lib/fonts'

const LottieAnimation = LottieView as any

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
  const colors = useColors()
  const themed = useStyles()
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
            {FallbackIcon ? <FallbackIcon size={iconSize} color={colors.muted} weight="duotone" /> : null}
          </View>
        ) : null}
        {lottieUrl && !failed ? (
          <LottieAnimation
            source={{ uri: lottieUrl } as any}
            style={styles.lottie}
            autoPlay
            loop
            speed={1}
            onLoad={() => setLoaded(true)}
          />
        ) : null}
      </View>
      <Text style={themed.title}>{title}</Text>
      {subtitle ? <Text style={themed.subtitle}>{subtitle}</Text> : null}
      {ctaText && onCta ? (
        <PressableScale onPress={onCta} scaleTo={0.96} style={themed.ctaWrap}>
          <View style={themed.cta}>
            <Text style={themed.ctaText}>{ctaText}</Text>
          </View>
        </PressableScale>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.sm },
  animBox: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  fallback: { ...(StyleSheet.absoluteFill as any), alignItems: 'center', justifyContent: 'center' },
  lottie: { width: 140, height: 140 },
})

function useStyles() {
  const colors = useColors()
  return StyleSheet.create({
    title: { fontSize: fontSizes.h3, lineHeight: lineHeights.h3, fontFamily: fonts.semibold, color: colors.textPrimary, textAlign: 'center' },
    subtitle: { fontSize: fontSizes.body, lineHeight: lineHeights.body, fontFamily: fonts.body, color: colors.textSecondary, textAlign: 'center' },
    ctaWrap: { marginTop: spacing.md, alignSelf: 'stretch', alignItems: 'center' },
    cta: {
      backgroundColor: colors.amber,
      paddingVertical: 14,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.full,
    },
    ctaText: { fontSize: fontSizes.body, lineHeight: lineHeights.body, fontFamily: fonts.bold, color: '#111111' },
  })
}