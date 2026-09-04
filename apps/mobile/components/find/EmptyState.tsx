import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { fonts } from '../../lib/fonts'
import { useColors } from '../../lib/ThemeContext'

interface Props {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  subtitle?: string
  iconColor?: string
}

export default function EmptyState({ icon = 'search-outline', title, subtitle, iconColor }: Props) {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={iconColor || colors.border} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  title: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: colors.muted, marginTop: 12, textAlign: 'center' },
  subtitle: { fontSize: 13, fontFamily: 'Outfit_500Medium', color: colors.muted, marginTop: 4, textAlign: 'center', opacity: 0.7 },
})
