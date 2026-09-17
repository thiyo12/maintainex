import { View, StyleSheet } from 'react-native'
import { Ticket } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../lib/ThemeContext'
import EmptyState from '../../../components/ui/EmptyState'

export default function VouchersScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <EmptyState
        title={t('vouchers.emptyTitle')}
        subtitle={t('vouchers.emptySub')}
        FallbackIcon={Ticket}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
})
