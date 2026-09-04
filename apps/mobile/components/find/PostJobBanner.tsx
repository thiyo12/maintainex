import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../lib/ThemeContext'

interface Props {
  onPress: () => void
}

export default function PostJobBanner({ onPress }: Props) {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.banner}>
      <View style={styles.iconWrap}>
        <Ionicons name="add-circle-outline" size={22} color={colors.amber} />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title}>{t('find.postJobBanner')}</Text>
        <Text style={styles.subtitle}>{t('find.postJobBannerSubtitle')}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </TouchableOpacity>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.amber + '1F',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  textCol: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 1 },
})