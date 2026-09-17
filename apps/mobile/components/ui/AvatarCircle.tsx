import React from 'react'
import { View, Image, Text, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SealCheck } from 'phosphor-react-native'

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
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: rad }}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={['#A86D00', '#F5A623']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: size, height: size, borderRadius: rad, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={[styles.initial, { fontSize: size * 0.42, color: '#0D0D0D' }]}>{initial}</Text>
        </LinearGradient>
      )}

      {showOnline && (
        <View style={[styles.onlineDot, { width: size * 0.24, height: size * 0.24, borderRadius: size * 0.12, right: 0, bottom: 0, borderColor: '#0D0D0D' }]} />
      )}
      {showVerified && verified && (
        <View style={[styles.verifiedBadge, { left: 0, bottom: 0 }]}>
          <SealCheck size={size * 0.26} color="#F5A623" weight="fill" />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  initial: { fontSize: 20, fontFamily: 'Outfit_700Bold' },
  onlineDot: {
    position: 'absolute',
    backgroundColor: '#22C55E',
    borderWidth: 2,
  },
  verifiedBadge: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: '#0D0D0D',
  },
})
