import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/fonts'
import { spacing } from '../../../lib/tokens'

export default function MyJobsScreen() {
  const colors = useColors()
    const styles = makeStyles(colors)

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.ink }]}>My Jobs</Text>
      </View>
      <View style={styles.empty}>
        <Ionicons name="briefcase-outline" size={48} color={colors.muted} />
        <Text style={[styles.emptyText, { color: colors.muted }]}>No jobs posted yet</Text>
        <Text style={[styles.emptySub, { color: colors.border }]}>Post your first job to get started</Text>
      </View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 24, fontFamily: fonts.heading },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xxl },
  emptyText: { fontSize: 16, fontFamily: fonts.bodyMedium },
  emptySub: { fontSize: 14, fontFamily: fonts.body, textAlign: 'center' },
})
