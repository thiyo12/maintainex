import React from 'react'
import { View, Image, Text, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SealCheck } from 'phosphor-react-native'
import { v3 } from '../../theme/v3/tokens'

interface Props {
  uri?: string | null
  name?: string
  size?: number
  showOnline?: boolean
  showVerified?: boolean
  verified?: boolean
}

export default function AvatarCircle({
  uri,
  name,
  size = 48,
  showOnline = false,
  showVerified = false,
  verified = false,
}: Props) {
  const rad = size / 2
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'

  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: rad }} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={['#E7E7E7', '#D5D5D5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: size, height: size, borderRadius: rad, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
        </LinearGradient>
      )}

      {showOnline ? (
        <View
          style={[
            styles.onlineDot,
            {
              width: size * 0.24,
              height: size * 0.24,
              borderRadius: size * 0.12,
              right: 0,
              bottom: 0,
            },
          ]}
        />
      ) : null}
      {showVerified && verified ? (
        <View style={styles.verifiedBadge}>
          <SealCheck size={size * 0.28} color={v3.colors.success} weight="fill" />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  initial: { fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  onlineDot: {
    position: 'absolute',
    backgroundColor: v3.colors.success,
    borderWidth: 2,
    borderColor: v3.colors.paper,
  },
  verifiedBadge: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    borderRadius: 9999,
    backgroundColor: v3.colors.paper,
  },
})
