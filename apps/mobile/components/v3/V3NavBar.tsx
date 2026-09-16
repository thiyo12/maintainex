import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { CaretLeft } from 'phosphor-react-native'
import { v3 } from '../../theme/v3/tokens'

interface Props {
  title: string
  onBack?: () => void
  rightAction?: React.ReactNode
}

export default function V3NavBar({ title, onBack, rightAction }: Props) {
  return (
    <View style={styles.container}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <View style={styles.backCircle}>
            <CaretLeft size={16} color={v3.colors.ink} weight="bold" />
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.backBtn} />
      )}
      <Text style={styles.title}>{title}</Text>
      {rightAction ? (
        <View style={styles.backBtn}>{rightAction}</View>
      ) : (
        <View style={styles.backBtn} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 48,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Outfit_800ExtraBold',
    fontWeight: '850',
    color: v3.colors.textPrimary,
    textAlign: 'center',
  },
})
