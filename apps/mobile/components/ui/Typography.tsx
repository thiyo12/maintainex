import React from 'react'
import { Text as RNText, TextProps as RNTextProps } from 'react-native'
import { useColors } from '../../lib/theme'
import { fontSizes, lineHeights } from '../../lib/tokens'
import { fonts } from '../../lib/fonts'

type Tone = 'primary' | 'secondary' | 'muted' | 'amber' | 'success' | 'error' | 'info'

interface TypeProps extends RNTextProps {
  tone?: Tone
  children: React.ReactNode
}

function useTone(tone: Tone): string {
  const colors = useColors()
  switch (tone) {
    case 'secondary':
      return colors.textSecondary
    case 'muted':
      return colors.muted
    case 'amber':
      return colors.amber
    case 'success':
      return colors.success
    case 'error':
      return colors.error
    case 'info':
      return colors.info
    case 'primary':
    default:
      return colors.textPrimary
  }
}

function makeText(size: number, lineHeight: number, fontFamily: string) {
  return function TypedText({ tone = 'primary', style, children, ...rest }: TypeProps) {
    const color = useTone(tone)
    return (
      <RNText style={[{ fontSize: size, lineHeight, fontFamily, color }, style]} {...rest}>
        {children}
      </RNText>
    )
  }
}

/** Canonical V2 typography primitives. Tones guarantee readable contrast on dark surfaces. */
export const Display = makeText(fontSizes.display, lineHeights.display, fonts.heading)
export const H1 = makeText(fontSizes.h1, lineHeights.h1, fonts.heading)
export const H2 = makeText(fontSizes.h2, lineHeights.h2, fonts.heading)
export const H3 = makeText(fontSizes.h3, lineHeights.h3, fonts.semibold)
export const Body = makeText(fontSizes.body, lineHeights.body, fonts.body)
export const BodySmall = makeText(fontSizes.bodySmall, lineHeights.bodySmall, fonts.body)
export const Caption = makeText(fontSizes.caption, lineHeights.caption, fonts.body)
export const Label = makeText(fontSizes.label, lineHeights.label, fonts.semibold)
