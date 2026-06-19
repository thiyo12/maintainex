import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import type { ComponentProps } from 'react'

type IoniconProps = ComponentProps<typeof Ionicons>
type MCIconProps = ComponentProps<typeof MaterialCommunityIcons>

export function HandshakeIcon(props: IoniconProps) {
  return <MaterialCommunityIcons name="handshake-outline" size={props.size || 24} color={props.color || '#6B7280'} {...props as any} />
}

export function PartyPopperIcon(props: IoniconProps) {
  return <MaterialCommunityIcons name="party-popper" size={props.size || 24} color={props.color || '#6B7280'} {...props as any} />
}

export function TextRecognitionIcon(props: IoniconProps) {
  return <MaterialCommunityIcons name="text-recognition" size={props.size || 24} color={props.color || '#6B7280'} {...props as any} />
}

export function AirConditionerIcon(props: IoniconProps) {
  return <MaterialCommunityIcons name="air-conditioner" size={props.size || 24} color={props.color || '#6B7280'} {...props as any} />
}

export function PowerPlugIcon(props: IoniconProps) {
  return <MaterialCommunityIcons name="power-plug-outline" size={props.size || 24} color={props.color || '#6B7280'} {...props as any} />
}

export function BulbIcon(props: IoniconProps) {
  return <Ionicons name="bulb-outline" size={props.size || 24} color={props.color || '#6B7280'} {...props} />
}

export const iconMap = {
  briefcase: 'briefcase-outline' as const,
  bell: 'notifications-outline' as const,
  sparkles: 'sparkles-outline' as const,
  star: 'star-outline' as const,
  starFilled: 'star' as const,
  wallet: 'wallet-outline' as const,
  grid: 'grid-outline' as const,
  droplet: 'water-outline' as const,
  bolt: 'flash-outline' as const,
  hammer: 'hammer-outline' as const,
  laptop: 'laptop-outline' as const,
  location: 'location-outline' as const,
  send: 'paper-plane-outline' as const,
  bookmark: 'bookmark-outline' as const,
  circleCheck: 'checkmark-circle-outline' as const,
  clock: 'time-outline' as const,
  receipt: 'receipt-outline' as const,
  arrowsSort: 'swap-vertical-outline' as const,
  chat: 'chatbubble-ellipses-outline' as const,
  check: 'checkmark' as const,
  tool: 'construct-outline' as const,
  flag: 'flag-outline' as const,
  lock: 'lock-closed-outline' as const,
  arrowLeft: 'arrow-back-outline' as const,
  arrowRight: 'arrow-forward-outline' as const,
  info: 'information-circle-outline' as const,
  pencil: 'create-outline' as const,
  settings: 'settings-outline' as const,
  photo: 'image-outline' as const,
  shieldCheck: 'shield-checkmark-outline' as const,
  id: 'card-outline' as const,
  certificate: 'ribbon-outline' as const,
  shield: 'shield-outline' as const,
  building: 'business-outline' as const,
  category: 'apps-outline' as const,
  listDetails: 'list-outline' as const,
  user: 'person-outline' as const,
  userCircle: 'person-circle-outline' as const,
  camera: 'camera-outline' as const,
  mail: 'mail-outline' as const,
  options: 'options-outline' as const,
  inbox: 'file-tray-outline' as const,
  home: 'home-outline' as const,
  homeFilled: 'home' as const,
  search: 'search-outline' as const,
}
