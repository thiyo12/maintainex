import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { fontSizes } from '../../../lib/tokens'
import { spacing } from '../../../lib/tokens'
import { useTranslation } from 'react-i18next'

export default function ChatScreen() {
  const { t } = useTranslation()
  const colors = useColors()
    const styles = makeStyles(colors)

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.ink }]}>{t('chat.title')}</Text>
      </View>
      <View style={styles.empty}>
        <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.muted} />
        <Text style={[styles.emptyText, { color: colors.muted }]}>{t('chat.noConversations')}</Text>
        <Text style={[styles.emptySub, { color: colors.border }]}>{t('common.noResults')}</Text>
      </View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 24, fontFamily: fonts.heading },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xxl },
  emptyText: { fontSize: fontSizes.body, fontFamily: fonts.bodyMedium },
  emptySub: { fontSize: fontSizes.caption, fontFamily: fonts.body, textAlign: 'center', lineHeight: 20 },
})
