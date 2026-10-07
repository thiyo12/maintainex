import { View, Text, StyleSheet } from 'react-native'
import { Lock } from 'phosphor-react-native'
import { v3 } from '../../theme/v3/tokens'

interface Props {
  title: string
  subtitle: string
}

export default function V3InfoBanner({ title, subtitle }: Props) {
  return (
    <View style={styles.banner}>
      <Lock size={16} color={v3.colors.amberDark} weight="bold" />
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: v3.colors.amberBg,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  textWrap: { flex: 1 },
  title: {
    fontSize: 11.5,
    fontFamily: 'Outfit_700Bold',
    fontWeight: '800',
    color: v3.colors.textPrimary,
  },
  subtitle: {
    fontSize: 9.5,
    fontFamily: 'Outfit_500Medium',
    fontWeight: '600',
    color: v3.colors.textSecondary,
    marginTop: 2,
  },
})
