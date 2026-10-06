import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { v3 } from '../../theme/v3/tokens'

interface Props {
  icon: React.ReactNode
  name: string
  onPress: () => void
}

export default function V3ServiceCard({ icon, name, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.iconWrap}>
        {icon}
      </View>
      <Text style={styles.name} numberOfLines={2}>{name}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    width: 82,
    alignItems: 'center',
    backgroundColor: v3.colors.surfaceWhite,
    borderWidth: 1,
    borderColor: v3.colors.line,
    borderRadius: v3.radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: v3.colors.surfaceGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 9,
    fontFamily: 'Outfit_600SemiBold',
    color: v3.colors.textPrimary,
    textAlign: 'center',
    lineHeight: 12,
  },
})
