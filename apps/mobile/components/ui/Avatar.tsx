import React from 'react'
import { View, Image, Text } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SealCheck } from 'phosphor-react-native'
import { useColors } from '../../lib/theme'
import { fonts } from '../../lib/fonts'

export interface CanonicalAvatarProps {
  /** Photo URL. When absent, a gradient (or solid `color`) initial tile renders. */
  uri?: string | null
  /** @deprecated Use `uri`. Kept for legacy `Avatar` callers. */
  imageUrl?: string | null
  name?: string
  size?: number
  /** Solid background override (e.g. company blue). Defaults to amber gradient. */
  color?: string | null
  /** @deprecated Use `showOnline`. Kept for legacy `Avatar` callers. */
  online?: boolean
  showOnline?: boolean
  showVerified?: boolean
  verified?: boolean
}

/**
 * Canonical V2 avatar — the single avatar component for the app.
 * Merges legacy `Avatar` (flat tile, `imageUrl`/`color`/`online` props) and
 * `AvatarCircle` (gradient circle, verified badge). Both legacy files now
 * re-export this implementation with prop mapping, so all existing callers
 * render byte-identical visuals with zero import changes.
 */
export default function Avatar({
  uri,
  imageUrl,
  name,
  size = 48,
  color,
  online = false,
  showOnline = false,
  showVerified = false,
  verified = false,
}: CanonicalAvatarProps) {
  const colors = useColors()
  const photo = uri ?? imageUrl ?? null
  const withOnline = showOnline || online
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'
  const initials = (name || '?')
    .split(' ')
    .map(s => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  return (
    <View style={{ width: size, height: size }}>
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : color ? (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: size * 0.4, color: colors.background, fontFamily: fonts.bold }}>{initials}</Text>
        </View>
      ) : (
        <LinearGradient
          colors={[colors.accentDim, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: size * 0.42, color: colors.background, fontFamily: fonts.bold }}>{initial}</Text>
        </LinearGradient>
      )}

      {withOnline && (
        <View
          style={{
            position: 'absolute',
            backgroundColor: colors.success,
            borderWidth: 2,
            borderColor: colors.background,
            width: size * 0.24,
            height: size * 0.24,
            borderRadius: size * 0.12,
            right: 0,
            bottom: 0,
          }}
        />
      )}
      {showVerified && verified && (
        <View style={{ position: 'absolute', borderRadius: 9999, backgroundColor: colors.background, left: 0, bottom: 0 }}>
          <SealCheck size={size * 0.26} color={colors.accent} weight="fill" />
        </View>
      )}
    </View>
  )
}
