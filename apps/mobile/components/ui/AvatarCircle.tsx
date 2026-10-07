import React from 'react'
import Avatar from './Avatar'

interface LegacyAvatarCircleProps {
  uri?: string | null
  name?: string
  size?: number
  showOnline?: boolean
  showVerified?: boolean
  verified?: boolean
}

/**
 * @deprecated Merged into canonical `Avatar` (`./Avatar`).
 * This file maps the legacy prop shape onto the canonical implementation
 * with identical visuals. Use `Avatar` directly in new code.
 */
export default function AvatarCircle({
  uri,
  name,
  size = 48,
  showOnline = false,
  showVerified = false,
  verified = false,
}: LegacyAvatarCircleProps) {
  return (
    <Avatar
      uri={uri}
      name={name}
      size={size}
      showOnline={showOnline}
      showVerified={showVerified}
      verified={verified}
    />
  )
}
