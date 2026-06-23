import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { fontSizes } from '../../../lib/tokens'
import { spacing } from '../../../lib/tokens'

export default function FindJobsScreen() {
  const colors = useColors()
    const { t } = useTranslation()
    const styles = makeStyles(colors)

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.ink }]}>{t('find.findJobs')}</Text>
      </View>
      <View style={styles.empty}>
        <Ionicons name="search-outline" size={48} color={colors.muted} />
        <Text style={[styles.emptyText, { color: colors.muted }]}>{t('find.searchInYourArea')}</Text>
      </View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 24, fontFamily: fonts.heading },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  emptyText: { fontSize: fontSizes.body, fontFamily: fonts.body },
})
