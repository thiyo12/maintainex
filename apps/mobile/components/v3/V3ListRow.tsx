import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { v3 } from '../../theme/v3/tokens'

interface Props {
  number: number
  title: string
  subtitle?: string
  onPress?: () => void
}

export default function V3ListRow({ number, title, subtitle, onPress }: Props) {
  const content = (
    <View style={styles.row}>
      <View style={styles.numberCircle}>
        <Text style={styles.number}>{number}</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </View>
  )

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        {content}
      </TouchableOpacity>
    )
  }

  return content
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: v3.components.listRow.height,
    borderRadius: v3.components.listRow.borderRadius,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    paddingHorizontal: 16,
    gap: 12,
  },
  numberCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: v3.colors.surfaceGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontSize: 10,
    fontFamily: 'Outfit_900Black',
    fontWeight: '900',
    color: v3.colors.textPrimary,
  },
  textWrap: { flex: 1 },
  title: {
    fontSize: 11.2,
    fontFamily: 'Outfit_700Bold',
    fontWeight: '800',
    color: v3.colors.textPrimary,
  },
  subtitle: {
    fontSize: 8.8,
    fontFamily: 'Outfit_500Medium',
    fontWeight: '600',
    color: v3.colors.textSecondary,
    marginTop: 1,
  },
  chevron: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    fontWeight: '800',
    color: v3.colors.textSecondary,
  },
})
