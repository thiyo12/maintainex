import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { MapPin, Bell } from 'phosphor-react-native'
import { v3 } from '../../theme/v3/tokens'

interface Props {
  region: string
  greeting: string
  firstName: string
  unreadCount: number
  onLocationPress: () => void
  onBellPress: () => void
}

export default function V3CustomerAppBar({ region, greeting, firstName, unreadCount, onLocationPress, onBellPress }: Props) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.locPill} onPress={onLocationPress} activeOpacity={0.7}>
        <MapPin size={14} color={v3.colors.textSecondary} weight="fill" />
        <Text style={styles.locText} numberOfLines={1}>{region}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.bellBtn} onPress={onBellPress} activeOpacity={0.7}>
        <Bell size={20} color={v3.colors.ink} weight="regular" />
        {unreadCount > 0 ? <View style={styles.badge} /> : null}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 4,
  },
  locPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: v3.colors.surfaceGray,
    borderWidth: 1,
    borderColor: v3.colors.line,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: v3.radius.full,
    flexShrink: 1,
  },
  locText: {
    fontSize: 10.5,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.textSecondary,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: v3.colors.surfaceWhite,
    borderWidth: 1,
    borderColor: v3.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: v3.colors.amber,
    borderWidth: 1.5,
    borderColor: v3.colors.paper,
  },
})
